import { CalculationResults, ChannelData, SummaryKPIs } from '../types';

declare const XLSX: any;

const createStyledSheet = (data: any[][], colWidths: {wch: number}[]) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = colWidths;

    // Style header
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFFF00" } }, // Yellow
            border: {
                bottom: { style: "thin", color: { auto: 1 } },
                top: { style: "thin", color: { auto: 1 } },
                left: { style: "thin", color: { auto: 1 } },
                right: { style: "thin", color: { auto: 1 } },
            }
        };
    }
    return ws;
};

const getGradientColorHex = (value: number, min: number, max: number): string => {
    if (max <= min || value <= 0) return "FFFFFF";
    const percent = (value - min) / (max - min);

    const red = [248, 105, 107], yellow = [255, 235, 132], green = [99, 190, 123];
    let r, g, b;

    if (percent < 0.5) {
        const p = percent * 2;
        r = red[0] + p * (yellow[0] - red[0]);
        g = red[1] + p * (yellow[1] - red[1]);
        b = red[2] + p * (yellow[2] - red[2]);
    } else {
        const p = (percent - 0.5) * 2;
        r = yellow[0] + p * (green[0] - yellow[0]);
        g = yellow[1] + p * (green[1] - yellow[1]);
        b = yellow[2] + p * (green[2] - yellow[2]);
    }
    const toHex = (c: number) => ('0' + Math.round(c).toString(16)).slice(-2);
    return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const generateExcelReport = (results: CalculationResults) => {
    const wb = XLSX.utils.book_new();
    
    const baseSplitOrder = ["Сплит (TCPP)", "Сплит (Affinity)", "Сплит (Эффективность)", "Сплит (Натуральный)"];
    const allSplitNames = [
        ...baseSplitOrder,
        ...Object.keys(results.splits).filter(name => !baseSplitOrder.includes(name)).sort()
    ];


    // --- Create Split Sheets ---
    for (const splitName of allSplitNames) {
        if (!results.splits[splitName]) continue;
        
        const sheetData: any[][] = [];
        const headers = ["Регион", "Телеканал", "Тип", "TA", "TVR TA", "Aff", "Sales TVR", "CPP", "TCPP", "Index TCPP", "Взв рейтинг", "Выбор", "Доля в сплите", "TRP", "Комментарий по сплиту"];
        sheetData.push(headers);

        results.splits[splitName].forEach((row: ChannelData) => {
            sheetData.push([
                row.region,
                row.channel,
                row.type,
                row.ta,
                row.tvrTa,
                row.aff,
                row.salesTvr,
                row.cpp,
                row.tcpp,
                row.indexTcpp,
                row.weightedRating,
                row.selected ? 'x' : '',
                row.share,
                row.trp,
                row.comment || ''
            ]);
        });
        
        const ws = createStyledSheet(sheetData, [ {wch:15}, {wch:25}, {wch:8}, {wch:20}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:12}, {wch:12}, {wch:8}, {wch:15}, {wch:10}, {wch:30} ]);
        
        // FIX: Made number formatting safer by checking for cell existence first.
        const range = XLSX.utils.decode_range(ws['!ref']!);
        for (let R = 1; R <= range.e.r; ++R) {
            const applyFormat = (c: number, format: string) => {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c });
                if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
                    ws[cellAddress].z = format;
                }
            };
            applyFormat(4, '0.00');   // TVR TA
            applyFormat(5, '0.00');   // Aff
            applyFormat(6, '0.00');   // Sales TVR
            applyFormat(7, '#,##0');    // CPP
            applyFormat(8, '#,##0');    // TCPP
            applyFormat(9, '0.00');   // Index TCPP
            applyFormat(10, '0.00');  // Взв рейтинг
            applyFormat(12, '0.00%'); // Share
            applyFormat(13, '0.0');   // TRP
        }

        XLSX.utils.book_append_sheet(wb, ws, splitName, true);
        wb.Sheets[splitName].Props = { TabColor: { R: 255, G: 192, B: 0 } }; // Orange
    }

    // --- Create Summary Sheets ---
    for (const regionName in results.summaries) {
        const summary = results.summaries[regionName];
        const sheetData: any[][] = [];
        
        const splitHeaders = allSplitNames.filter(name => summary.kpis[name]); // Only include splits that have data for this region

        sheetData.push(["Канал", ...splitHeaders]);
        const channels = Object.keys(summary.channels).sort((a, b) => {
            const shareA = summary.channels[a]["Сплит (TCPP)"] ?? 0;
            const shareB = summary.channels[b]["Сплит (TCPP)"] ?? 0;
            return shareB - shareA;
        });
        channels.forEach(ch => {
            const rowData: (string | number)[] = [ch];
            splitHeaders.forEach(sh => rowData.push(summary.channels[ch][sh] ?? 0));
            sheetData.push(rowData);
        });
        
        // FIX: Explicitly type `totalRow` to prevent type inference error when pushing a number.
        const totalRow: (string | number)[] = ["Итого"];
        splitHeaders.forEach(() => totalRow.push(1));
        sheetData.push(totalRow); // Sums
        sheetData.push([]); // Spacer row
        
        // KPIs
        const kpiRows = [
            { key: 'trps', label: 'TRP\'s' }, { key: 'avrTvr', label: 'Ср. TVR' },
            { key: 'affinity', label: 'Аффинити' }, { key: 'cppTa', label: 'CPP ЦА' },
            { key: 'costIndex', label: 'Индекс стоимости' }, { key: 'budget', label: 'Бюджет' }
        ];
        kpiRows.forEach(kpi => {
            const rowData: (string | number)[] = [kpi.label];
            splitHeaders.forEach(sh => rowData.push(summary.kpis[sh]?.[kpi.key as keyof SummaryKPIs] ?? 'N/A'));
            sheetData.push(rowData);
        });
        
        const colWidths = [{wch: 30}];
        splitHeaders.forEach(() => colWidths.push({wch: 20}));
        
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = colWidths;

        const allShares = channels.flatMap(ch => splitHeaders.map(sp => summary.channels[ch][sp]).filter(v => v !== null && v > 0) as number[]);
        const minShare = allShares.length > 0 ? Math.min(...allShares) : 0;
        const maxShare = allShares.length > 0 ? Math.max(...allShares) : 0;

        // FIX: Refactored the styling logic to be more robust, preventing crashes by ensuring cell and style objects exist before modification.
        for (let R = 0; R < sheetData.length; ++R) {
            for (let C = 0; C < sheetData[R].length; ++C) {
                const cellAddress = XLSX.utils.encode_cell({r:R, c:C});
                if(!ws[cellAddress]) continue; // Skip empty cells
                
                const cell = ws[cellAddress];
                // Ensure style objects exist before modification
                if (!cell.s) cell.s = {};
                if (!cell.s.font) cell.s.font = {};
                if (!cell.s.fill) cell.s.fill = {};

                // Header
                if (R === 0) {
                    cell.s.font.bold = true;
                }
                
                // Channel shares & conditional formatting
                if (R > 0 && R <= channels.length && C > 0) {
                    cell.z = '0.0%';
                    const value = cell.v as number;
                    cell.s.fill.fgColor = { rgb: getGradientColorHex(value, minShare, maxShare) };
                }
                // Total
                if (R === channels.length + 1) {
                    cell.s.font.bold = true;
                    if(C > 0) cell.z = '0.0%';
                }
                // KPI labels
                if (R > channels.length + 2 && C === 0) {
                    cell.s.font.bold = true;
                }
                
                // KPI values formatting
                const kpiRowIndex = R - (channels.length + 3);
                if (kpiRowIndex >= 0 && kpiRowIndex < kpiRows.length) {
                    if (C > 0) { // Only format value columns
                        const key = kpiRows[kpiRowIndex].key;
                        if (key === 'costIndex') {
                            cell.z = '0%';
                        } else if (['trps', 'cppTa', 'budget'].includes(key)) {
                            cell.z = '#,##0';
                        } else {
                            cell.z = '0.00';
                        }
                    }
                }
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws, `Свод (${regionName})`, true);
        wb.Sheets[`Свод (${regionName})`].Props = { TabColor: { R: 255, G: 0, B: 0 } }; // Red
    }

    XLSX.writeFile(wb, "Отчет_Оптимизатор_ТВ_сплитов.xlsx");
};