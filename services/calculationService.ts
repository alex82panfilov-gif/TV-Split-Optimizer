import { BriefData, StoredFile, CalculationResults, ChannelData, RegionSummary, SummaryKPIs } from '../types';

declare const XLSX: any; // Используем библиотеку XLSX, подключенную через CDN

// --- Вспомогательные функции ---

/**
 * Нормализует название региона для сопоставления.
 * @param name - Исходное название региона.
 * @returns Нормализованное название.
 */
const normalizeRegionName = (name: string): string => {
    if (!name) return '';

    const normalized = name
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ');

    const aliasMap: { [key: string]: string } = {
        'сетевое вещание': 'россия',
        'рф': 'россия',
        'спб': 'санкт петербург',
        'санкт петербург': 'санкт петербург', // Handles hyphenated version
    };

    return aliasMap[normalized] || normalized;
};


/**
 * Нормализует название телеканала для сопоставления данных из разных файлов.
 * Приводит к нижнему регистру, удаляет лишние символы и использует карту псевдонимов.
 * @param name - Исходное название канала.
 * @returns Нормализованное название.
 */
const normalizeChannelName = (name: string): string => {
    if (!name) return '';

    const normalizedInput = name
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ');

    const channelAliasMap: { [key: string]: string } = {
        '2x2': '2х2',
        'детский рекламный канал': 'дрк',
        'единый рекламный канал': 'ерк',
        'женский рекламный канал': 'жрк',
        'москва доверие': 'доверие',
        'москва 24': 'москва 24',
        'мужской рекламный канал': 'мрк',
        'муз тв': 'муз-тв',
        'первый канал': 'первый',
        'санкт петербург': 'тк санкт-петербург',
        'тк санкт петербург': 'тк санкт-петербург',
        'тв центр': 'твц',
        'четвертый канал': '4 канал'
    };

    return channelAliasMap[normalizedInput] || normalizedInput;
};

/**
 * Находит индекс столбца по его имени (или нескольким возможным именам) без учета регистра.
 * @param headers - Массив заголовков.
 * @param headerNames - Имя или массив имен искомого заголовка.
 * @returns Индекс столбца или -1, если не найден.
 */
const findColumn = (headers: string[], headerNames: string | string[]): number => {
    const namesToSearch = Array.isArray(headerNames) ? headerNames : [headerNames];
    for (const name of namesToSearch) {
        const index = headers.findIndex(h => h?.trim().toLowerCase() === name.toLowerCase());
        if (index !== -1) {
            return index;
        }
    }
    return -1;
};


/**
 * Находит столбец со средним TVR для указанной целевой аудитории.
 * Проверяет несколько возможных вариантов суффиксов.
 */
const findAvgTAColumn = (headers: string[], baseTA: string): number => {
    const possibleNames = ["__AVG Reg TVR", "__AVG TVR"].map(suffix => `${baseTA}${suffix}`);
    return findColumn(headers, possibleNames);
};

/**
 * Находит столбец с общим TVR (GRP) для указанной целевой аудитории.
 * Используется для расчета Affinity.
 */
const findTotalTAColumn = (headers: string[], baseTA: string): number => {
    const possibleNames = ["__PBA Reg TVR", "__TVR"].map(suffix => `${baseTA}${suffix}`);
    return findColumn(headers, possibleNames);
};

/**
 * Находит столбец с TVR по баинговой (Sales) аудитории.
 */
const findSalesTVRColumn = (headers: string[]): number => {
    const names = ["PBA Reg Sales TVR", "PBA Sales TVR", "Sales TVR"];
    return findColumn(headers, names);
};


/**
 * Парсит файл с ценами (CPP) и создает Map для быстрого доступа.
 * @returns Map, где ключ - регион, значение - Map (ключ - канал (с суффиксом для орбит), значение - CPP).
 */
const getCppMap = (cppFile: StoredFile): Map<string, Map<string, number>> => {
    const workbook = XLSX.read(cppFile.content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const headers = data[0].map(h => String(h));
    
    const blockColIdx = findColumn(headers, ["Блок распространения", "Блок"]);

    const cppMap = new Map<string, Map<string, number>>();
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const region = normalizeRegionName(row[0]);
        const rawChannelName = String(row[1] || '');
        const cpp = parseFloat(row[2]);

        if (region && rawChannelName && !isNaN(cpp)) {
            let channelKey: string;
            const blockType = (blockColIdx !== -1 && row[blockColIdx]) ? String(row[blockColIdx]) : '';
            
            const isOrbital = blockType.toLowerCase().includes('орбит') || rawChannelName.endsWith(' - 0');

            if (isOrbital) {
                 const baseName = rawChannelName.replace(' - 0', '').trim();
                 channelKey = normalizeChannelName(baseName) + ' - 0';
            } else {
                 channelKey = normalizeChannelName(rawChannelName);
            }

            if (!cppMap.has(region)) {
                cppMap.set(region, new Map<string, number>());
            }
            cppMap.get(region)!.set(channelKey, cpp);
        }
    }
    return cppMap;
};

// --- Функции, связанные с расчетами ---

/**
 * Новая функция для предварительного анализа файла с рейтингами.
 * Извлекает списки уникальных регионов и целевых аудиторий.
 * @param ratingsFile - Файл с рейтингами.
 * @returns Промис с объектом, содержащим массивы регионов и ЦА.
 */
export const preParseRatingsFile = async (ratingsFile: StoredFile): Promise<{ regions: string[], targetAudiences: string[] }> => {
    const workbook = XLSX.read(ratingsFile.content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
    const headers = data[0].map(h => String(h));

    // Извлечение регионов
    const regionColIdx = findColumn(headers, "Регион");
    if (regionColIdx === -1) throw new Error("В файле с рейтингами не найден столбец 'Регион'.");
    
    const regionSet = new Set<string>();
    for (let i = 1; i < data.length; i++) {
        const region = String(data[i][regionColIdx]).trim();
        if (region) {
            regionSet.add(region);
        }
    }
    if (regionSet.size === 0) throw new Error("В файле с рейтингами не найдено ни одного региона.");

    // Извлечение ЦА
    const taSet = new Set<string>();
    headers.forEach(h => {
        // Ищем заголовки, которые заканчиваются на стандартные суффиксы TVR
        const match = h.match(/^(.*?)__(?:AVG Reg TVR|PBA Reg TVR|AVG TVR|TVR)$/);
        if (match && match[1]) {
            taSet.add(match[1]);
        }
    });

    if (taSet.size === 0) {
        throw new Error("В файле с рейтингами не найдено ни одного столбца с целевой аудиторией (например, 'W 25-45 BC__AVG TVR').");
    }

    return {
        regions: Array.from(regionSet).sort(),
        targetAudiences: Array.from(taSet).sort()
    };
};


/**
 * Главная функция, которая обрабатывает файлы и выполняет все расчеты.
 * @param ratingsFile - Файл с рейтингами.
 * @param cppFile - Файл с ценами.
 * @param brief - Данные из брифа.
 * @returns Промис, который разрешается с объектом результатов.
 */
export const processFilesAndCalculate = async (
    ratingsFile: StoredFile,
    cppFile: StoredFile,
    brief: BriefData
): Promise<CalculationResults> => {
    
    // 1. Парсинг входных файлов
    const workbook = XLSX.read(ratingsFile.content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const headers = data[0].map(h => String(h));

    // 2. Валидация заголовков и брифа
    const briefRegionMap = new Map(Object.keys(brief.regionBriefs).map(k => [normalizeRegionName(k), k]));
    const regions = Object.keys(brief.regionBriefs);
    if (regions.length === 0) throw new Error("Необходимо указать хотя бы один регион в брифе.");

    const uniqueTAs = [...new Set(Object.values(brief.regionBriefs).map(b => b.targetAudience.trim()).filter(Boolean))];
    const avgTaColMap = new Map<string, number>();
    const totalTaColMap = new Map<string, number>();

    for (const ta of uniqueTAs) {
        const avgColIdx = findAvgTAColumn(headers, ta);
        const totalColIdx = findTotalTAColumn(headers, ta);
        
        if (avgColIdx === -1 || totalColIdx === -1) {
            const availableTAs = headers.map(h => h.match(/^(.*?)__.*TVR$/)?.[1]).filter((v, i, a) => v && a.indexOf(v) === i);
            throw new Error(`❌ Ошибка: Для ЦА '${ta}' не найдены обязательные столбцы GRP и AVG TVR. Пожалуйста, выберите одну из доступных в вашем файле ЦА: ${availableTAs.join(', ')}`);
        }
        avgTaColMap.set(ta, avgColIdx);
        totalTaColMap.set(ta, totalColIdx);
    }

    const salesTvrColIdx = findSalesTVRColumn(headers);
    if (salesTvrColIdx === -1) throw new Error("❌ Ошибка: В файле с рейтингами не найден обязательный столбец с баинговой аудиторией (например, 'PBA Reg Sales TVR' или 'Sales TVR').");

    const regionColIdx = findColumn(headers, "Регион");
    const channelColIdx = findColumn(headers, "Телекомпания");
    const blockColIdx = findColumn(headers, ["Блок распространения", "Блок распространение", "Блок"]);
    const grpBuyingColIdx = findColumn(headers, "GRP баинговая");
    const cppMap = getCppMap(cppFile);
    
    // 3. Подготовка исходных данных и расчет базовых метрик
    let initialData: ChannelData[] = [];
    const regionSortOrder = new Map(regions.map((r, i) => [r, i + 1]));

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const regionFromFile = normalizeRegionName(row[regionColIdx]);
        
        if (!regionFromFile) continue;

        const originalBriefKey = briefRegionMap.get(regionFromFile);
        if (!originalBriefKey) continue; // Пропускаем регионы, которых нет в брифе

        const regionBrief = brief.regionBriefs[originalBriefKey];
        if (!row[channelColIdx] || String(row[channelColIdx]).includes('/')) continue;
        
        const avgTaColIdx = avgTaColMap.get(regionBrief.targetAudience);
        const totalTaColIdx = totalTaColMap.get(regionBrief.targetAudience);
        if (avgTaColIdx === undefined || totalTaColIdx === undefined) continue;

        const baseChannelName = String(row[channelColIdx]).split('(')[0].trim();
        let channelForDisplay = baseChannelName;
        let channelKeyForCpp: string;
        
        const blockType = (blockColIdx !== -1 && row[blockColIdx]) ? String(row[blockColIdx]) : '';
        const isOrbital = blockType.toLowerCase().includes('орбит');

        if (isOrbital) {
            channelForDisplay += ' - 0';
            channelKeyForCpp = normalizeChannelName(baseChannelName) + ' - 0';
        } else {
            channelKeyForCpp = normalizeChannelName(baseChannelName);
        }
        
        const avgTvrTa = parseFloat(String(row[avgTaColIdx]).replace(',', '.'));
        const totalTvrTa = parseFloat(String(row[totalTaColIdx]).replace(',', '.'));
        const originalSalesTvr = parseFloat(String(row[salesTvrColIdx]).replace(',', '.'));
        
        const cpp = cppMap.get(regionFromFile)?.get(channelKeyForCpp) ?? null;
        
        const grpBuyingValue = grpBuyingColIdx !== -1 ? String(row[grpBuyingColIdx] || '').trim() : '';
        const channelType = (grpBuyingValue === 'N/A' || grpBuyingValue === 'N\\A' || grpBuyingValue === '') ? 'Мин' : 'GRP';

        const aff = (totalTvrTa > 0 && originalSalesTvr > 0) ? totalTvrTa / originalSalesTvr : null;

        let tcpp: number | null = null;
        if (channelType === 'GRP' && cpp && aff && aff > 0) {
            tcpp = cpp / aff;
        } else if (channelType === 'Мин' && cpp && avgTvrTa > 0) {
            tcpp = cpp / 3 / avgTvrTa;
        }

        const recalculatedSalesTvr = (aff && aff > 0) ? avgTvrTa / aff : null;

        initialData.push({
            region: originalBriefKey, channel: channelForDisplay, tvrTa: avgTvrTa,
            salesTvr: recalculatedSalesTvr, cpp, aff, tcpp, ta: regionBrief.targetAudience,
            sortOrder: regionSortOrder.get(originalBriefKey) ?? 99, type: channelType, 
            indexTcpp: null, selected: false,
            weightedRating: null, share: null, trp: null, comment: null
        });
    }

    // Расчет Index TCPP (отношение TCPP канала к максимальному TCPP в регионе)
    for (const region of regions) {
        const regionChannels = initialData.filter(d => d.region === region && d.tcpp !== null);
        if(regionChannels.length > 0) {
            const maxTcpp = Math.max(...regionChannels.map(d => d.tcpp!));
            initialData.forEach(d => {
                if(d.region === region && d.tcpp !== null && maxTcpp > 0) {
                    d.indexTcpp = d.tcpp / maxTcpp;
                }
            });
        }
    }
    
    // 4. Расчет четырех вариантов сплитов
    const splitConfigs = [
        { name: "Сплит (TCPP)", logic: "TCPP", applyLimits: true },
        { name: "Сплит (Affinity)", logic: "Affinity", applyLimits: true },
        { name: "Сплит (Эффективность)", logic: "Efficiency", applyLimits: true },
        { name: "Сплит (Натуральный)", logic: "Natural", applyLimits: false },
    ];
    
    const splits: { [key: string]: ChannelData[] } = {};
    for (const config of splitConfigs) {
        splits[config.name] = generateSingleSplit(JSON.parse(JSON.stringify(initialData)), brief, config.logic, config.applyLimits);
    }
    
    // 5. Генерация сводных данных для отчета
    const summaries = generateSummaries(splits, brief);
    
    return { splits, summaries, initialData };
};

/**
 * Внутренняя функция для оптимизации долей в сплите после первоначального отбора каналов.
 * Включает итеративный расчет долей и применение ограничений.
 */
const optimizeSplit = (
    data: ChannelData[],
    brief: BriefData,
    weightingLogic: string,
    applyLimits: boolean,
    weights?: { aff: number; tcpp: number; eff: number }
): ChannelData[] => {
    const regions = Object.keys(brief.regionBriefs);
    
    let changesMade;
    let iterationCount = 0;
    do {
        changesMade = false;
        iterationCount++;
        if (iterationCount > 20) break; 
        
        for (const region of regions) {
            const selectedInRegion = data.filter(d => d.region === region && d.selected);
            if(selectedInRegion.length === 0) continue;

            const avgTcpp = selectedInRegion.reduce((sum, d) => sum + (d.tcpp || 0), 0) / selectedInRegion.length;

            if (weightingLogic === 'Custom' && weights) {
                // Pre-calculate raw weighted ratings and their totals for normalization
                const wr = selectedInRegion.map(d => ({
                    ch: d.channel,
                    aff: (d.tvrTa || 0) * (d.aff || 1),
                    tcpp: (avgTcpp > 0 && d.tcpp && d.tcpp > 0) ? (d.tvrTa || 0) / (d.tcpp / avgTcpp) : 0,
                    eff: (d.cpp || 0) > 0 ? (d.tvrTa || 0) / d.cpp! : 0
                }));
                const total_wr_aff = wr.reduce((s, v) => s + v.aff, 0);
                const total_wr_tcpp = wr.reduce((s, v) => s + v.tcpp, 0);
                const total_wr_eff = wr.reduce((s, v) => s + v.eff, 0);

                selectedInRegion.forEach(d => {
                    const channelWr = wr.find(w => w.ch === d.channel);
                    if (!channelWr) return;
                    const n_wr_aff = total_wr_aff > 0 ? channelWr.aff / total_wr_aff : 0;
                    const n_wr_tcpp = total_wr_tcpp > 0 ? channelWr.tcpp / total_wr_tcpp : 0;
                    const n_wr_eff = total_wr_eff > 0 ? channelWr.eff / total_wr_eff : 0;
                    d.weightedRating = (weights.aff / 100) * n_wr_aff + (weights.tcpp / 100) * n_wr_tcpp + (weights.eff / 100) * n_wr_eff;
                });

            } else {
                 selectedInRegion.forEach(d => {
                    switch (weightingLogic) {
                        case 'Natural': d.weightedRating = d.tvrTa; break;
                        case 'Affinity': d.weightedRating = (d.tvrTa || 0) * (d.aff || 1); break;
                        case 'Efficiency': d.weightedRating = (d.cpp || 0) > 0 ? (d.tvrTa || 0) / d.cpp! : 0; break;
                        case 'TCPP': d.weightedRating = (avgTcpp > 0 && d.tcpp && d.tcpp > 0) ? (d.tvrTa || 0) / (d.tcpp / avgTcpp) : 0; break;
                        default: d.weightedRating = (d.tvrTa || 0);
                    }
                });
            }

            const totalWeightedRating = selectedInRegion.reduce((sum, d) => sum + (d.weightedRating || 0), 0);
            if (totalWeightedRating > 0) {
                data.forEach(d => {
                    if (d.region === region && d.selected) d.share = (d.weightedRating || 0) / totalWeightedRating;
                    else if (d.region === region) d.share = 0;
                });
            }
        }
        
        if (applyLimits) {
            data.forEach(d => {
                const regionBrief = brief.regionBriefs[d.region];
                if (!regionBrief) return;

                const minShare = (regionBrief.minChannelShare ?? 2) / 100;
                if (d.selected && d.share !== null && d.share < minShare) {
                    d.selected = false;
                    d.comment = `Низкая доля (<${(minShare * 100).toFixed(1)}%)`;
                    changesMade = true;
                }
            });
        }
    } while (changesMade);
    
    if (applyLimits) {
        for (const region of regions) {
            const regionBrief = brief.regionBriefs[region];
            if (!regionBrief || regionBrief.maxOrbitalShare === null) continue;

            const orbitalChannels = data.filter(d => d.region === region && d.selected && d.channel.includes(" - 0"));
            const networkChannels = data.filter(d => d.region === region && d.selected && !d.channel.includes(" - 0"));
            const totalOrbitalShare = orbitalChannels.reduce((sum, d) => sum + (d.share || 0), 0);
            
            const maxShare = regionBrief.maxOrbitalShare / 100;
            if (totalOrbitalShare > maxShare) {
                const reductionFactor = maxShare / totalOrbitalShare;
                const shareToRedistribute = totalOrbitalShare - maxShare;
                
                orbitalChannels.forEach(d => {
                    d.share! *= reductionFactor;
                    d.comment = `Доля орбит. скорр. до ${regionBrief.maxOrbitalShare}%`;
                });
                
                const totalNetworkShare = networkChannels.reduce((sum, d) => sum + (d.share || 0), 0);
                if (totalNetworkShare > 0) {
                     networkChannels.forEach(d => d.share! += (d.share! / totalNetworkShare) * shareToRedistribute);
                }
            }
        }
    }

    data.forEach(d => {
        if (d.selected) d.trp = (d.share || 0) * 1000;
        else {
            d.share = 0;
            d.trp = 0;
        }
    });

    return data.sort((a,b) => (a.sortOrder - b.sortOrder) || ((b.share || 0) - (a.share || 0)));
}

/**
 * Генерирует один вариант автоматического сплита на основе заданной логики.
 */
const generateSingleSplit = (
    data: ChannelData[],
    brief: BriefData,
    weightingLogic: string,
    applyLimits: boolean
): ChannelData[] => {
    
    const regions = Object.keys(brief.regionBriefs);
    // Первичный отбор: отсекаем N% самых дорогих каналов по Index TCPP (настраивается в брифе)
    if (weightingLogic !== "Natural") {
        for (const region of regions) {
            const regionBrief = brief.regionBriefs[region];
            const regionChannels = data.filter(d => d.region === region && d.indexTcpp !== null);
            if (regionChannels.length === 0) continue;

            regionChannels.sort((a, b) => (b.indexTcpp!) - (a.indexTcpp!));
            
            const cutoffValue = regionBrief?.expensiveChannelCutoff ?? 20; // Default to 20%
            const channelsToCut = Math.ceil(regionChannels.length * (cutoffValue / 100));
            
            const channelsToExclude = new Set(regionChannels.slice(0, channelsToCut).map(c => c.channel));

            data.forEach(d => {
                if (d.region === region) {
                    if (d.indexTcpp !== null) {
                        d.selected = !channelsToExclude.has(d.channel);
                        if (!d.selected) d.comment = "Дорогой Index TCPP";
                    } else {
                        d.selected = false;
                        d.comment = "Нет данных для расчета TCPP";
                    }
                }
            });
        }
    } else { // Для натурального сплита берем все каналы с данными
        data.forEach(d => {
            if (d.tvrTa && d.tvrTa > 0 && d.cpp !== null && d.cpp > 0) {
                 d.selected = true;
            }
            else {
                d.selected = false;
                d.comment = "Нет данных для расчета или нулевой CPP";
            }
        });
    }
    
    return optimizeSplit(data, brief, weightingLogic, applyLimits);
};

/**
 * Генерирует сплит "Конструктор" на основе выбора каналов и логики расчета долей.
 */
export const generateConstructorSplit = (
    allChannels: ChannelData[],
    brief: BriefData,
    selectedChannelNames: string[],
    weightingLogic: string,
    weights?: { aff: number, tcpp: number, eff: number }
): ChannelData[] => {
    const data = JSON.parse(JSON.stringify(allChannels));
    const selectedSet = new Set(selectedChannelNames);

    // Первичный отбор на основе выбора пользователя
    data.forEach((d: ChannelData) => {
        if(d.tcpp && d.tcpp > 0) {
            d.selected = selectedSet.has(d.channel);
            if(!d.selected) d.comment = "Не выбран пользователем";
        } else {
            d.selected = false;
            d.comment = "Нет данных для расчета TCPP"
        }
    });

    return optimizeSplit(data, brief, weightingLogic, true, weights);
};

/**
 * Генерирует сплит на основе полностью ручного ввода долей.
 */
export const generateManualSharesSplit = (
    allChannels: ChannelData[],
    brief: BriefData,
    shares: Map<string, number>
): ChannelData[] => {
    const data: ChannelData[] = JSON.parse(JSON.stringify(allChannels));
    const region = Object.keys(brief.regionBriefs)[0]; // Manual split is per-region

    data.forEach(d => {
        if (d.region === region) {
            const sharePercent = shares.get(d.channel);
            if (sharePercent !== undefined && sharePercent > 0) {
                d.selected = true;
                d.share = sharePercent / 100;
                d.trp = d.share * 1000;
                d.comment = "Доля задана вручную";
            } else {
                d.selected = false;
                d.share = 0;
                d.trp = 0;
                d.comment = shares.has(d.channel) ? "Доля 0%" : "Не выбран";
            }
        } else {
            // Reset channels from other regions
            d.selected = false;
            d.share = 0;
            d.trp = 0;
            d.comment = null;
        }
    });
    
    return data.sort((a,b) => (a.sortOrder - b.sortOrder) || ((b.share || 0) - (a.share || 0)));
};

/**
 * Генерирует сводные данные для всех регионов и сплитов.
 */
const generateSummaries = (splits: { [key: string]: ChannelData[] }, brief: BriefData): { [key: string]: RegionSummary } => {
    const summaries: { [key: string]: RegionSummary } = {};
    const splitNames = Object.keys(splits);
    const regions = Object.keys(brief.regionBriefs);

    for (const region of regions) {
        const regionSummary: RegionSummary = { region, channels: {}, kpis: {} };

        const allChannelsInRegion = new Set<string>();
        splitNames.forEach(splitName => {
            splits[splitName].filter(d => d.region === region && (d.selected || d.share > 0)).forEach(d => allChannelsInRegion.add(d.channel));
        });
        
        allChannelsInRegion.forEach(channel => {
            regionSummary.channels[channel] = {};
            splitNames.forEach(splitName => {
                const channelData = splits[splitName].find(d => d.region === region && d.channel === channel);
                regionSummary.channels[channel][splitName] = channelData?.share ?? null;
            });
        });

        const regionKpis: { [splitName: string]: SummaryKPIs } = {};

        splitNames.forEach(splitName => {
            const splitChannels = splits[splitName].filter(d => d.region === region && d.selected);
            if (splitChannels.length > 0) {
                const totalTrps = splitChannels.reduce((sum, d) => sum + (d.trp || 0), 0);
                const avrTvr = splitChannels.reduce((sum, d) => sum + (d.tvrTa || 0) * (d.share || 0), 0);
                const affinity = splitChannels.reduce((sum, d) => sum + (d.aff || 0) * (d.share || 0), 0);
                const cppTa = splitChannels.reduce((sum, d) => sum + (d.tcpp || 0) * (d.share || 0), 0);
                const budget = cppTa * totalTrps;

                regionKpis[splitName] = {
                    trps: totalTrps,
                    avrTvr,
                    affinity,
                    cppTa,
                    budget,
                    costIndex: 0 // Placeholder
                };
            }
        });
        
        const budgets = Object.values(regionKpis).map(kpi => kpi.budget).filter(b => b > 0);
        if (budgets.length > 0) {
            const maxBudget = Math.max(...budgets);
            if (maxBudget > 0) {
                Object.values(regionKpis).forEach(kpi => {
                    kpi.costIndex = kpi.budget / maxBudget;
                });
            }
        }
        
        regionSummary.kpis = regionKpis;
        summaries[region] = regionSummary;
    }

    return summaries;
};