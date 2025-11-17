import { StoredFile } from '../types';

declare const XLSX: any;

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

export const validateRatingsFile = async (file: StoredFile): Promise<void> => {
    const workbook = XLSX.read(file.content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
    if (data.length < 1) {
        throw new Error("Файл с рейтингами пуст или имеет неверный формат.");
    }
    const headers = data[0].map(h => String(h));

    const requiredColumns: { name: string, aliases: string[] }[] = [
        { name: 'Регион', aliases: ['Регион'] },
        { name: 'Телекомпания', aliases: ['Телекомпания'] },
        { name: 'Блок распространение', aliases: ['Блок распространения', 'Блок распространение', 'Блок'] },
        { name: 'Sales TVR', aliases: ["PBA Reg Sales TVR", "PBA Sales TVR", "Sales TVR"] },
        { name: 'GRP баинговая', aliases: ['GRP баинговая'] }
    ];

    for (const col of requiredColumns) {
        if (findColumn(headers, col.aliases) === -1) {
            throw new Error(`В файле рейтингов отсутствует обязательный столбец: "${col.name}"`);
        }
    }
    
    // Check for TA columns
    const hasTaColumnPair = headers.some(h => {
        const match = h.match(/^(.*?)__(?:AVG Reg TVR|AVG TVR)$/);
        if (match && match[1]) {
            const baseTA = match[1];
            const pbaSuffixes = ["__PBA Reg TVR", "__TVR"];
            return pbaSuffixes.some(suffix => headers.includes(`${baseTA}${suffix}`));
        }
        return false;
    });

    if (!hasTaColumnPair) {
        throw new Error("В файле рейтингов не найдено ни одной полной пары столбцов с ЦА (например, 'M 25-55BC__AVG Reg TVR' и 'M 25-55BC__PBA Reg TVR').");
    }
};

export const validateCppFile = async (file: StoredFile): Promise<void> => {
    const workbook = XLSX.read(file.content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
    if (data.length < 1) {
        throw new Error("Файл с ценами пуст или имеет неверный формат.");
    }
    const headers = data[0].map(h => String(h));

    const requiredColumns = ['Регион', 'Канал', 'CPP'];

    for (const col of requiredColumns) {
         if (findColumn(headers, col) === -1) {
            throw new Error(`В файле с ценами отсутствует обязательный столбец: "${col}"`);
        }
    }
};
