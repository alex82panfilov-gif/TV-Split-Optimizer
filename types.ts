/**
 * Определяет возможные шаги (экраны) приложения.
 * 'instruction' - Шаг с инструкцией и шаблонами.
 * 'upload' - Шаг загрузки и валидации файлов.
 * 'brief' - Шаг заполнения брифа.
 * 'results' - Шаг отображения результатов.
 */
export type AppStep = 'instruction' | 'brief' | 'upload' | 'results';

/**
 * Описывает параметры брифа для одного региона.
 */
export interface RegionBrief {
  targetAudience: string;      // Целевая аудитория (например, "W 25-45 BC").
  minChannelShare: number | null; // Минимальная доля канала в сплите (в процентах).
  maxOrbitalShare: number | null; // Максимальная суммарная доля орбитальных каналов (в процентах).
  expensiveChannelCutoff: number | null; // Порог отсева N% самых дорогих каналов.
}

/**
 * Описывает все данные брифа, собранные на первом шаге.
 * Ключом является название региона.
 */
export interface BriefData {
  regionBriefs: {
    [regionName: string]: RegionBrief;
  };
}

/**
 * Представляет файл, загруженный пользователем и хранящийся в состоянии.
 */
export interface StoredFile {
    name: string;        // Имя файла.
    content: ArrayBuffer; // Содержимое файла в виде ArrayBuffer для обработки.
}

/**
 * Описывает все данные и расчетные метрики для одного телеканала.
 */
export interface ChannelData {
  [key: string]: string | number | boolean | null;
  region: string;           // Регион.
  channel: string;          // Название телеканала.
  type: string;             // Тип канала ('GRP' или 'Мин').
  ta: string;               // Целевая аудитория, для которой производился расчет.
  tvrTa: number | null;     // TVR (рейтинг) по целевой аудитории.
  aff: number | null;       // Affinity Index (индекс соответствия).
  salesTvr: number | null;  // TVR по баинговой аудитории.
  cpp: number | null;       // CPP (Cost Per Point) - стоимость пункта рейтинга.
  tcpp: number | null;      // TCPP (Target Cost Per Point) - стоимость пункта рейтинга по ЦА.
  indexTcpp: number | null; // Индекс TCPP относительно самого дорогого канала в регионе.
  selected: boolean;        // Флаг, выбран ли канал для включения в сплит.
  weightedRating: number | null; // Взвешенный рейтинг, используемый для расчета доли.
  share: number | null;     // Доля канала в сплите (от 0 до 1).
  trp: number | null;       // TRP (Target Rating Points) - набранные пункты рейтинга по ЦА.
  comment: string | null;   // Комментарий (например, причина исключения из сплита).
  sortOrder: number;        // Порядок сортировки для регионов.
}

/**
 * Описывает ключевые KPI для одного варианта сплита.
 */
export interface SummaryKPIs {
  trps: number;       // Суммарные TRP (обычно 1000).
  avrTvr: number;     // Средний TVR по сплиту.
  affinity: number;   // Средний Affinity по сплиту.
  cppTa: number;      // Средний CPP по ЦА (TCPP) по сплиту.
  costIndex: number;  // Индекс стоимости относительно самого дорогого сплита.
  budget: number;     // Расчетный бюджет (TRPs * CPP TA).
}

/**
 * Описывает сводные результаты для одного региона.
 */
export interface RegionSummary {
  region: string;
  // Доли каждого канала в каждом из четырех сплитов.
  channels: {
    [channelName: string]: {
      [splitName: string]: number | null;
    };
  };
  // KPI для каждого из четырех сплитов.
  kpis: {
    [splitName: string]: SummaryKPIs;
  };
}

/**
 * Описывает полную структуру результатов расчетов.
 */
export interface CalculationResults {
  // Детальные данные по каналам для каждого типа сплита.
  splits: { [splitName: string]: ChannelData[] };
  // Сводные данные по регионам.
  summaries: { [regionName: string]: RegionSummary };
  // Исходные данные по всем каналам до фильтрации, для ручного выбора.
  initialData: ChannelData[];
}
