import React from 'react';
import { useState, useMemo } from 'react';
import { CalculationResults, RegionSummary, ChannelData, SummaryKPIs, BriefData } from '../types';
import { Button } from './Button';
import { generateExcelReport } from '../services/excelService';
import { generateConstructorSplit, generateManualSharesSplit } from '../services/calculationService';
import { CloseIcon, InfoIcon, ChevronDownIcon } from './icons';
import { BarChart, DoughnutChart } from './Charts';

interface ResultsStepProps {
  results: CalculationResults;
  onReset: () => void;
  briefData: BriefData;
}

// Функции форматирования чисел вынесены на уровень выше для переиспользования
const formatNumber = (num: number, fracDigits = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: fracDigits, maximumFractionDigits: fracDigits }).format(num);
const formatInteger = (num: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
const formatPercent = (num: number) => `${(num * 100).toFixed(0)}%`;


/**
 * Генерирует цвет для градиентной заливки ячеек (чем выше значение, тем зеленее).
 */
const getGradientColor = (value: number | null, min: number, max: number): string => {
    if (value === null || value <= 0) return 'transparent';
    if (max <= min) return 'rgb(255, 235, 132)'; // Средний цвет для одного значения
    
    const percent = (value - min) / (max - min);

    const red = [248, 105, 107], yellow = [255, 235, 132], green = [99, 190, 123];
    let r, g, b;

    if (percent < 0.5) {
        const localPercent = percent * 2;
        r = red[0] + localPercent * (yellow[0] - red[0]);
        g = red[1] + localPercent * (yellow[1] - red[1]);
        b = red[2] + localPercent * (yellow[2] - red[2]);
    } else {
        const localPercent = (percent - 0.5) * 2;
        r = yellow[0] + localPercent * (green[0] - yellow[0]);
        g = yellow[1] + localPercent * (green[1] - yellow[1]);
        b = yellow[2] + localPercent * (green[2] - yellow[2]);
    }
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};

/**
 * Генерирует инвертированный цвет для градиентной заливки (чем ниже значение, тем зеленее).
 */
const getInvertedGradientColor = (value: number | null, min: number, max: number): string => {
    if (value === null || value <= 0) return 'transparent';
     if (max <= min) return 'rgb(255, 235, 132)';
    const percent = (value - min) / (max - min);
    return getGradientColor(1 - percent, 0, 1);
};


/**
 * Компонент для ручного выбора каналов и создания сплита с авто-долями ("Конструктор").
 */
const ConstructorPanel: React.FC<{
    channels: ChannelData[];
    onCalculate: (selectedChannels: string[], logic: string, weights?: { aff: number, tcpp: number, eff: number }) => void;
    onClose: () => void;
}> = ({ channels, onCalculate, onClose }) => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [logic, setLogic] = useState<'TCPP' | 'Affinity' | 'Эффективность' | 'Custom'>('TCPP');
    // FIX: Explicitly typed the 'weights' state to resolve the 'Operator '+' cannot be applied to types 'unknown' and 'unknown'' error by ensuring its properties are always treated as numbers.
    const [weights, setWeights] = useState<{ aff: number; tcpp: number; eff: number }>({ aff: 40, tcpp: 30, eff: 30 });

    const totalWeight = weights.aff + weights.tcpp + weights.eff;
    
    const toggleChannel = (channelName: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(channelName)) {
            newSelected.delete(channelName);
        } else {
            newSelected.add(channelName);
        }
        setSelected(newSelected);
    };

    const handleWeightChange = (field: 'aff' | 'tcpp' | 'eff', value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            setWeights(prev => ({ ...prev, [field]: numValue }));
        } else if (value === '') {
            setWeights(prev => ({ ...prev, [field]: 0 }));
        }
    };

    const handleCalculateClick = () => {
        if (logic === 'Custom' && totalWeight !== 100) return;
        onCalculate(Array.from(selected), logic, logic === 'Custom' ? weights : undefined);
    };

    const sortedChannels = useMemo(() =>
        [...channels].sort((a, b) => (b.tvrTa || 0) - (a.tvrTa || 0)),
        [channels]
    );

    const metricsMeta = useMemo(() => {
        const getValues = (key: keyof ChannelData) => channels.map(c => c[key]).filter(v => typeof v === 'number' && v > 0) as number[];
        const tvrValues = getValues('tvrTa');
        const affValues = getValues('aff');
        const tcppValues = getValues('tcpp');
        const indexTcppValues = getValues('indexTcpp');
        return {
            tvr: { min: Math.min(...tvrValues), max: Math.max(...tvrValues) },
            aff: { min: Math.min(...affValues), max: Math.max(...affValues) },
            tcpp: { min: Math.min(...tcppValues), max: Math.max(...tcppValues) },
            indexTcpp: { min: Math.min(...indexTcppValues), max: Math.max(...indexTcppValues) },
        }
    }, [channels]);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold">Конструктор сплита (авто-доли)</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button>
                </div>
                <div className="overflow-y-auto p-4">
                     <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-2 py-3 w-10"></th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Канал</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">TVR TA</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Affinity</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">TCPP</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Index TCPP</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                           {sortedChannels.map(ch => {
                                const isDisabled = !ch.tcpp || ch.tcpp <= 0;
                                const rowClasses = `hover:bg-slate-50 transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`;
                                const rowTitle = isDisabled ? 'Канал недоступен для выбора, так как отсутствуют данные по TCPP' : '';

                                return (
                                <tr key={ch.channel} className={rowClasses} title={rowTitle}>
                                    <td className="px-2 py-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selected.has(ch.channel)} 
                                            onChange={() => toggleChannel(ch.channel)} 
                                            disabled={isDisabled}
                                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:bg-slate-200 disabled:cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800">{ch.channel}</td>
                                    <td className="px-4 py-2 text-sm text-right" style={{ backgroundColor: getGradientColor(ch.tvrTa, metricsMeta.tvr.min, metricsMeta.tvr.max) }}>{ch.tvrTa ? formatNumber(ch.tvrTa) : '—'}</td>
                                    <td className="px-4 py-2 text-sm text-right" style={{ backgroundColor: getGradientColor(ch.aff, metricsMeta.aff.min, metricsMeta.aff.max) }}>{ch.aff ? formatNumber(ch.aff) : '—'}</td>
                                    <td className="px-4 py-2 text-sm text-right" style={{ backgroundColor: getInvertedGradientColor(ch.tcpp, metricsMeta.tcpp.min, metricsMeta.tcpp.max) }}>{ch.tcpp ? formatInteger(ch.tcpp) : '—'}</td>
                                    <td className="px-4 py-2 text-sm text-right" style={{ backgroundColor: getInvertedGradientColor(ch.indexTcpp, metricsMeta.indexTcpp.min, metricsMeta.indexTcpp.max) }}>{ch.indexTcpp ? formatNumber(ch.indexTcpp) : '—'}</td>
                                </tr>
                               );
                           })}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 gap-4">
                    <div className="flex-grow space-y-2 bg-amber-50 border-2 border-dashed border-amber-300 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <label className="text-base font-bold text-amber-900">Логика расчета долей:</label>
                            <select value={logic} onChange={e => setLogic(e.target.value as any)} className="rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 text-base py-2 px-3 font-semibold">
                                <option value="TCPP">по TCPP</option>
                                <option value="Affinity">по Affinity</option>
                                <option value="Эффективность">по Эффективности</option>
                                <option value="Custom">Кастомная</option>
                            </select>
                        </div>
                        {logic === 'Custom' && (
                            <div className="grid grid-cols-3 gap-2 items-center animate-fade-in">
                                <div className="text-sm">
                                    <label>Affinity (%)</label>
                                    <input type="number" value={weights.aff} onChange={e => handleWeightChange('aff', e.target.value)} className="w-full p-1 border border-slate-300 rounded"/>
                                </div>
                                <div className="text-sm">
                                    <label>TCPP (%)</label>
                                    <input type="number" value={weights.tcpp} onChange={e => handleWeightChange('tcpp', e.target.value)} className="w-full p-1 border border-slate-300 rounded"/>
                                </div>
                                <div className="text-sm">
                                    <label>Эффектив. (%)</label>
                                    <input type="number" value={weights.eff} onChange={e => handleWeightChange('eff', e.target.value)} className="w-full p-1 border border-slate-300 rounded"/>
                                </div>
                                <div className={`col-span-3 text-center font-bold text-sm p-1 rounded ${totalWeight === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    Итого: {totalWeight}%
                                </div>
                            </div>
                        )}
                    </div>
                    <Button size="lg" onClick={handleCalculateClick} disabled={selected.size === 0 || (logic === 'Custom' && totalWeight !== 100)}>
                        Рассчитать сплит ({selected.size} каналов)
                    </Button>
                </div>
            </div>
        </div>
    );
};

/**
 * Компонент для создания сплита с полностью ручным вводом долей.
 */
const ManualSharesPanel: React.FC<{
    channels: ChannelData[];
    onCalculate: (shares: Map<string, number>) => void;
    onClose: () => void;
}> = ({ channels, onCalculate, onClose }) => {
    const [shares, setShares] = useState<Map<string, number>>(new Map());
    
    const totalShare = useMemo(() => {
        return Array.from(shares.values()).reduce((sum, val) => sum + (val || 0), 0);
    }, [shares]);

    const handleShareChange = (channelName: string, value: string) => {
        const newShares = new Map(shares);
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            newShares.set(channelName, numValue);
        } else {
            newShares.delete(channelName);
        }
        setShares(newShares);
    };

    const handleCalculateClick = () => {
        if (Math.abs(totalShare - 100) < 0.001) {
            onCalculate(shares);
        }
    };
    
    const sortedChannels = useMemo(() =>
        [...channels].sort((a, b) => (b.tvrTa || 0) - (a.tvrTa || 0)),
        [channels]
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold">Ручной сплит</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button>
                </div>
                <div className="overflow-y-auto p-4">
                     <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Канал</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Доля (%)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                           {sortedChannels.map(ch => {
                                const isDisabled = !ch.tcpp || ch.tcpp <= 0;
                                const rowClasses = `hover:bg-slate-50 transition-opacity ${isDisabled ? 'opacity-50' : ''}`;
                                return (
                                <tr key={ch.channel} className={rowClasses}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800">{ch.channel}</td>
                                    <td className="px-4 py-2 text-sm text-right">
                                        <input
                                            type="number"
                                            value={shares.get(ch.channel) ?? ''}
                                            onChange={(e) => handleShareChange(ch.channel, e.target.value)}
                                            disabled={isDisabled}
                                            className="w-full p-1 text-right border border-slate-300 rounded disabled:bg-slate-100"
                                            placeholder="0"
                                            step="0.1"
                                        />
                                    </td>
                                </tr>
                               );
                           })}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                    <div className={`text-center font-bold text-lg p-2 rounded w-48 ${Math.abs(totalShare - 100) < 0.001 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        Итого: {totalShare.toFixed(2)}%
                    </div>
                    <Button size="lg" onClick={handleCalculateClick} disabled={Math.abs(totalShare - 100) > 0.001}>
                        Рассчитать сплит
                    </Button>
                </div>
            </div>
        </div>
    );
};


/**
 * Новый компонент для сводной таблицы сравнения KPI всех сплитов.
 */
const SplitsComparisonTable: React.FC<{ summary: RegionSummary, splitNames: string[] }> = ({ summary, splitNames }) => {
    const metrics = [
        { key: 'avrTvr', label: 'Средний TVR', formatter: formatNumber, higherIsBetter: true },
        { key: 'affinity', label: 'Аффинити', formatter: formatNumber, higherIsBetter: true },
        { key: 'cppTa', label: 'CPP ЦА', formatter: formatInteger, higherIsBetter: false },
        { key: 'budget', label: 'Бюджет', formatter: formatInteger, higherIsBetter: false },
        { key: 'costIndex', label: 'Индекс стоимости', formatter: formatPercent, higherIsBetter: false },
    ];
    
    const getBestValue = (key: keyof SummaryKPIs, higherIsBetter: boolean): number | null => {
        const values = splitNames.map(s => summary.kpis[s]?.[key]).filter(v => typeof v === 'number') as number[];
        if (values.length === 0) return null;
        return higherIsBetter ? Math.max(...values) : Math.min(...values);
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 border border-slate-200">
                <thead className="bg-slate-100">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-1/4">KPI</th>
                        {splitNames.map(name => (
                            <th key={name} className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">{name.replace('Сплит ', '').replace(/[()]/g, '')}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {metrics.map(metric => {
                        const bestValue = getBestValue(metric.key as keyof SummaryKPIs, metric.higherIsBetter);
                        return (
                            <tr key={metric.key}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{metric.label}</td>
                                {splitNames.map(splitName => {
                                    const value = summary.kpis[splitName]?.[metric.key as keyof SummaryKPIs];
                                    const isBest = value != null && value === bestValue;
                                    return (
                                        <td key={splitName} className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isBest ? 'bg-green-100 text-green-900 font-bold' : 'text-slate-700'}`}>
                                            {value != null ? metric.formatter(value as number) : '—'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


interface SummaryTableProps {
  summary: RegionSummary;
  channelDetails: ChannelData[];
  activeSplit: string;
}

/**
 * Компонент для отображения детальной таблицы результатов для одного выбранного сплита.
 */
const SummaryTable: React.FC<SummaryTableProps> = ({ summary, channelDetails, activeSplit }) => {
  const allSplits = Object.keys(summary.kpis);
  const channels = Object.keys(summary.channels).sort((a, b) => {
    const shareA = summary.channels[a]["Сплит (TCPP)"] ?? 0;
    const shareB = summary.channels[b]["Сплит (TCPP)"] ?? 0;
    return shareB - shareA;
  });

  const detailsMap = new Map<string, ChannelData>(channelDetails.map(d => [d.channel, d]));

  const allShares = channels.flatMap(ch => allSplits.map(sp => summary.channels[ch][sp]).filter(v => v !== null && v > 0) as number[]);
  const minShare = Math.min(...allShares);
  const maxShare = Math.max(...allShares);

  return (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 border border-slate-200">
            <thead className="bg-slate-100">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-1/3">Канал</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">TVR TA</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Affinity</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">TCPP</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">{activeSplit.replace('Сплит ', '').replace(/[()]/g, '')}</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {channels.map(channel => {
                    const details = detailsMap.get(channel);
                    const share = summary.channels[channel][activeSplit];
                    const bgColor = (share !== null && share > 0) ? getGradientColor(share, minShare, maxShare) : 'transparent';
                    const textColor = (share !== null && share > 0.001) ? 'text-slate-900' : 'text-slate-500';

                    return (
                        <tr key={channel}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{channel}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700">{details?.tvrTa != null ? formatNumber(details.tvrTa) : '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700">{details?.aff != null ? formatNumber(details.aff) : '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700">{details?.tcpp != null ? formatInteger(details.tcpp) : '—'}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${textColor}`} style={{ backgroundColor: bgColor }}>
                                {(share === null || share === 0) ? '0,0%' : `${(share * 100).toFixed(1)}%`}
                            </td>
                        </tr>
                    )
                })}
                <tr className="bg-slate-50 font-bold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">Итого</td>
                    <td colSpan={3} className="px-6 py-4"></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">100,0%</td>
                </tr>
            </tbody>
        </table>
    </div>
  );
};

/**
 * Компонент для Шага 4: "Результаты".
 */
export const ResultsStep: React.FC<ResultsStepProps> = ({ results, onReset, briefData }) => {
  const [localResults, setLocalResults] = useState<CalculationResults>(results);
  const [modal, setModal] = useState<'constructor' | 'manual_shares' | null>(null);
  
  const regions = Object.keys(localResults.summaries);
  const [activeRegion, setActiveRegion] = useState(regions[0]);

  const baseSplits = ["Сплит (TCPP)", "Сплит (Affinity)", "Сплит (Эффективность)", "Сплит (Натуральный)"];
  
  const allSplits = useMemo(() => {
    const calculatedSplits = Object.keys(localResults.splits);
    const manualSplits = calculatedSplits.filter(s => !baseSplits.includes(s)).sort();
    return [...baseSplits, ...manualSplits];
  }, [localResults.splits]);

  const [activeSplit, setActiveSplit] = useState(allSplits[0]);
  const [visualizedKpi, setVisualizedKpi] = useState<'avrTvr' | 'affinity' | 'cppTa' | 'budget'>('avrTvr');
  const [sectionsVisibility, setSectionsVisibility] = useState({ kpiComparison: true, structureComparison: true });

  const toggleSection = (section: keyof typeof sectionsVisibility) => {
    setSectionsVisibility(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const kpiMeta = {
      avrTvr: { label: 'Средний TVR', higherIsBetter: true },
      affinity: { label: 'Аффинити', higherIsBetter: true },
      cppTa: { label: 'CPP ЦА', higherIsBetter: false },
      budget: { label: 'Бюджет', higherIsBetter: false },
  };
  
  const handleDownload = () => {
    generateExcelReport(localResults);
  };
  
  const updateResultsWithNewSplit = (splitName: string, splitData: ChannelData[]) => {
      const splitChannels = splitData.filter(d => d.region === activeRegion && d.selected);
      let newSplitKpis: SummaryKPIs | null = null;

      if(splitChannels.length > 0) {
          const totalTrps = splitChannels.reduce((sum, d) => sum + (d.trp || 0), 0);
          const avrTvr = splitChannels.reduce((sum, d) => sum + (d.tvrTa || 0) * (d.share || 0), 0);
          const affinity = splitChannels.reduce((sum, d) => sum + (d.aff || 0) * (d.share || 0), 0);
          const cppTa = splitChannels.reduce((sum, d) => sum + (d.tcpp || 0) * (d.share || 0), 0);
          const budget = cppTa * totalTrps;
          newSplitKpis = { trps: totalTrps, avrTvr, affinity, cppTa, budget, costIndex: 0 };
      }
      
      setLocalResults(prevResults => {
          const newResults = JSON.parse(JSON.stringify(prevResults));
          
          newResults.splits[splitName] = splitData;

          const summary = newResults.summaries[activeRegion];
          if (newSplitKpis) {
               summary.kpis[splitName] = newSplitKpis;

               const allBudgets = Object.values(summary.kpis).map((kpi: any) => kpi.budget).filter(b => b > 0);
               const maxBudget = Math.max(...allBudgets);
               if (maxBudget > 0) {
                   Object.values(summary.kpis).forEach((kpi: any) => kpi.costIndex = kpi.budget / maxBudget);
               }
          }
         
          const allChannelsInRegion = new Set(Object.keys(summary.channels));
          splitData.filter(d=>d.region === activeRegion).forEach(d => allChannelsInRegion.add(d.channel));
          
          allChannelsInRegion.forEach(channel => {
              if(!summary.channels[channel]) summary.channels[channel] = {};
              const channelData = splitData.find(d => d.region === activeRegion && d.channel === channel);
              summary.channels[channel][splitName] = channelData?.share ?? 0;
          });
          
          return newResults;
      });

      setActiveSplit(splitName);
      setModal(null);
  };

  const handleCalculateConstructorSplit = (selectedChannels: string[], logic: string, weights?: { aff: number, tcpp: number, eff: number }) => {
        const briefForRegion = { regionBriefs: { [activeRegion]: briefData.regionBriefs[activeRegion] } };
        const splitData = generateConstructorSplit(localResults.initialData, briefForRegion, selectedChannels, logic, weights);
        updateResultsWithNewSplit("Конструктор", splitData);
  };

  const handleCalculateManualSharesSplit = (shares: Map<string, number>) => {
        const briefForRegion = { regionBriefs: { [activeRegion]: briefData.regionBriefs[activeRegion] } };
        const splitData = generateManualSharesSplit(localResults.initialData, briefForRegion, shares);
        updateResultsWithNewSplit("Ручные доли", splitData);
  };

  const channelDetailsForRegion = localResults.initialData.filter(d => d.region === activeRegion);
  const activeRegionSummary = localResults.summaries[activeRegion];

  const channelColorMap = useMemo(() => {
    if (!activeRegionSummary) return new Map<string, string>();
    
    const colors = [
      '#4f46e5', '#0891b2', '#059669', '#ca8a04', '#db2777', '#6d28d9', '#c2410c',
      '#7c3aed', '#2563eb', '#0d9488', '#65a30d', '#f97316', '#e11d48', '#be185d',
      '#1d4ed8', '#0e7490', '#047857', '#a16207', '#be185d', '#5b21b6', '#9a3412'
    ];
    
    const allChannels = Object.keys(activeRegionSummary.channels);
    const map = new Map<string, string>();
    allChannels.forEach((channel, i) => {
        map.set(channel, colors[i % colors.length]);
    });
    map.set('Прочие', '#64748b'); // Consistent color for "Others"

    return map;
  }, [activeRegionSummary]);

  const barChartData = useMemo(() => {
    if (!activeRegionSummary) return null;
    
    const currentKpiKey = visualizedKpi;
    const { higherIsBetter } = kpiMeta[currentKpiKey];

    const labels = allSplits.map(s => s.replace('Сплит ', '').replace(/[()]/g, ''));
    const dataPoints = allSplits.map(s => activeRegionSummary.kpis[s]?.[currentKpiKey as keyof SummaryKPIs] ?? 0);

    const bestValue = higherIsBetter ? Math.max(...dataPoints) : Math.min(...dataPoints.filter(v => v > 0));
    
    const backgroundColors = dataPoints.map(v => v === bestValue ? 'rgba(8, 145, 178, 0.6)' : 'rgba(201, 203, 207, 0.6)');
    const borderColors = dataPoints.map(v => v === bestValue ? 'rgba(8, 145, 178, 1)' : 'rgba(201, 203, 207, 1)');

    return {
      labels,
      datasets: [{
        label: kpiMeta[currentKpiKey].label,
        data: dataPoints,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      }]
    };
  }, [activeRegionSummary, allSplits, visualizedKpi]);
  
  const doughnutChartData = useMemo(() => {
      if (!activeRegionSummary || !activeSplit) return null;
      
      const channelsData = activeRegionSummary.channels;
      const shares = Object.entries(channelsData)
          .map(([name, splits]) => ({ name, share: splits[activeSplit] ?? 0 }))
          .filter(c => c.share > 0)
          .sort((a, b) => b.share - a.share);
      
      if (shares.length === 0) return null;

      const labels: string[] = [];
      const dataPoints: number[] = [];
      let otherShare = 0;
      const threshold = 0.02; // 2%

      shares.forEach(c => {
          if (c.share < threshold) {
              otherShare += c.share;
          } else {
              labels.push(c.name);
              dataPoints.push(c.share * 100);
          }
      });

      if (otherShare > 0) {
          labels.push('Прочие');
          dataPoints.push(otherShare * 100);
      }
      
      const backgroundColors = labels.map(label => channelColorMap.get(label) || '#cccccc');

      return {
          labels,
          datasets: [{
              label: 'Доля канала',
              data: dataPoints,
              backgroundColor: backgroundColors,
              hoverOffset: 4
          }]
      };
  }, [activeRegionSummary, activeSplit, channelColorMap]);

  const stackedBarChartData = useMemo(() => {
    if (!activeRegionSummary) return null;

    const channelsData = activeRegionSummary.channels;
    const allChannels = Object.keys(channelsData).filter(ch => 
        allSplits.some(split => channelsData[ch][split] && channelsData[ch][split] > 0)
    );
    
    const threshold = 0.02;
    const mainChannels: string[] = [];
    const otherChannels: string[] = [];

    allChannels.forEach(channel => {
        const maxShare = Math.max(...allSplits.map(split => channelsData[channel][split] ?? 0));
        if (maxShare >= threshold) {
            mainChannels.push(channel);
        } else {
            otherChannels.push(channel);
        }
    });

    mainChannels.sort((a, b) => {
        const maxA = Math.max(...allSplits.map(split => channelsData[a][split] ?? 0));
        const maxB = Math.max(...allSplits.map(split => channelsData[b][split] ?? 0));
        return maxB - maxA;
    });

    const datasets: any[] = mainChannels.map((channel) => ({
        label: channel,
        data: allSplits.map(split => (channelsData[channel][split] ?? 0) * 100),
        backgroundColor: channelColorMap.get(channel) || '#cccccc',
    }));

    if (otherChannels.length > 0) {
        const otherData = allSplits.map(split => 
            otherChannels.reduce((sum, channel) => sum + (channelsData[channel][split] ?? 0), 0) * 100
        );
        datasets.push({
            label: 'Прочие',
            data: otherData,
            backgroundColor: channelColorMap.get('Прочие') || '#64748b',
        });
    }

    return {
        labels: allSplits.map(s => s.replace('Сплит ', '').replace(/[()]/g, '')),
        datasets,
    };
  }, [activeRegionSummary, allSplits, channelColorMap]);

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg animate-fade-in">
        <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className="text-xl font-bold mb-1">Шаг 4: Результаты</h2>
                <p className="text-slate-500">Просмотрите сводные данные и скачайте полный отчет.</p>
            </div>
            <Button size="lg" onClick={handleDownload}>Скачать Excel-отчет</Button>
        </div>

        <div className="mb-8">
            <div className="p-1.5 inline-flex items-center bg-slate-200/75 rounded-lg space-x-1">
                {regions.map(region => (
                    <button key={region} onClick={() => setActiveRegion(region)}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${ activeRegion === region ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-300/50' }`}
                    >
                        {region}
                    </button>
                ))}
            </div>
        </div>
        
        {activeRegionSummary && (
            <div className="mb-8">
                 <h3 className="text-lg font-bold mb-4">Сводная оценка сплитов</h3>
                 <div className="bg-sky-50 border-l-4 border-sky-400 text-sky-800 p-4 mb-6 rounded-r-lg flex items-start space-x-3" role="alert">
                    <InfoIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold">Важное замечание по оценке эффективности</p>
                        <p className="text-sm">
                            Данная сводная таблица не включает один из ключевых параметров для сравнения — <strong>охват (Reach)</strong>. Для принятия финального решения рекомендуем самостоятельно рассчитать и проанализировать показатели охвата и частоты для каждого сплита в специализированном ПО Mediascope (например, TV Planet).
                        </p>
                    </div>
                 </div>
                 <SplitsComparisonTable summary={activeRegionSummary} splitNames={allSplits} />
            </div>
        )}

        {activeRegionSummary && (
            <div className="my-12 border border-slate-200 rounded-lg shadow-sm">
                <button
                    onClick={() => toggleSection('kpiComparison')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-expanded={sectionsVisibility.kpiComparison}
                    aria-controls="kpi-comparison-content"
                >
                    <h3 className="text-lg font-bold">Визуальное сравнение KPI</h3>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${sectionsVisibility.kpiComparison ? 'rotate-180' : ''}`} />
                </button>
                <div 
                    id="kpi-comparison-content"
                    className={`grid transition-all duration-500 ease-in-out ${sectionsVisibility.kpiComparison ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="p-4">
                      <div className="mb-4">
                          <div className="p-1 inline-flex items-center bg-slate-100 rounded-lg space-x-1 flex-wrap">
                              {Object.entries(kpiMeta).map(([key, { label }]) => (
                                  <button key={key} onClick={() => setVisualizedKpi(key as any)}
                                      className={`m-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 ${ visualizedKpi === key ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-200' }`}
                                  >
                                      {label}
                                  </button>
                              ))}
                          </div>
                      </div>
                      {barChartData ? <BarChart data={barChartData} /> : <p>Нет данных для графика.</p>}
                    </div>
                  </div>
                </div>
            </div>
        )}

        {activeRegionSummary && (
            <div className="my-12 border border-slate-200 rounded-lg shadow-sm">
                <button
                    onClick={() => toggleSection('structureComparison')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    aria-expanded={sectionsVisibility.structureComparison}
                    aria-controls="structure-comparison-content"
                >
                    <h3 className="text-lg font-bold">Сравнение структуры сплитов</h3>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${sectionsVisibility.structureComparison ? 'rotate-180' : ''}`} />
                </button>
                <div 
                    id="structure-comparison-content"
                    className={`grid transition-all duration-500 ease-in-out ${sectionsVisibility.structureComparison ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="p-4">
                        {stackedBarChartData ? (
                            <BarChart 
                                data={stackedBarChartData} 
                                options={{
                                    plugins: {
                                        tooltip: {
                                            callbacks: {
                                                label: function(context: any) {
                                                    let label = context.dataset.label || '';
                                                    if (label) {
                                                        label += ': ';
                                                    }
                                                    if (context.parsed.y !== null) {
                                                        label += context.parsed.y.toFixed(1) + '%';
                                                    }
                                                    return label;
                                                }
                                            }
                                        },
                                        legend: {
                                            position: 'bottom'
                                        }
                                    },
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        x: { 
                                            stacked: true,
                                            ticks: {
                                                font: {
                                                    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                                                }
                                            }
                                        },
                                        y: { 
                                            stacked: true, 
                                            ticks: { 
                                                callback: (value: any) => `${value}%`,
                                                font: {
                                                    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                                                }
                                            } 
                                        }
                                    }
                                }}
                            />
                        ) : <p>Нет данных для графика.</p>}
                    </div>
                  </div>
                </div>
            </div>
        )}

        <div className="mb-4">
            <h3 className="text-lg font-bold mb-4">Детализация сплита</h3>
            <div className="flex flex-wrap gap-3 mb-6">
                {allSplits.map(split => {
                    const isActive = activeSplit === split;
                    let buttonClass = '';

                    if (split === "Конструктор" || split === "Ручные доли") {
                        buttonClass = isActive
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold';
                    } else {
                        buttonClass = isActive
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                    }
                    
                    return (
                        <button key={split} onClick={() => setActiveSplit(split)}
                            className={`px-4 py-3 rounded-lg text-sm font-semibold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${buttonClass}`}
                        >
                            {split.replace('Сплит ', '').replace(/[()]/g, '')}
                        </button>
                    );
                })}
                <div className="flex-grow grid grid-cols-2 gap-3 min-w-[300px]">
                    <button
                        onClick={() => setModal('constructor')}
                        className="w-full h-full px-4 py-3 rounded-lg text-sm font-semibold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 bg-amber-400 text-black hover:bg-amber-500 font-bold"
                    >
                        Конструктор сплита
                    </button>
                    <button
                        onClick={() => setModal('manual_shares')}
                        className="w-full h-full px-4 py-3 rounded-lg text-sm font-semibold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 bg-purple-400 text-white hover:bg-purple-500 font-bold"
                    >
                        Создать ручной сплит
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
                <div className="md:col-span-2">
                    <h4 className="text-base font-semibold mb-2 text-center">Структура сплита: <span className="font-bold text-sky-700">{activeSplit.replace('Сплит ', '').replace(/[()]/g, '')}</span></h4>
                    {doughnutChartData ? (
                        <DoughnutChart data={doughnutChartData} />
                    ) : (
                        <div className="flex items-center justify-center h-80 bg-slate-50 rounded-lg border-2 border-dashed">
                            <p className="text-slate-500 text-center">Нет каналов в этом сплите <br/> для отображения.</p>
                        </div>
                    )}
                </div>
                <div className="md:col-span-3">
                    {activeRegionSummary && 
                        <SummaryTable 
                            summary={activeRegionSummary} 
                            channelDetails={channelDetailsForRegion}
                            activeSplit={activeSplit}
                        />
                    }
                </div>
            </div>
        </div>
        
        {modal === 'constructor' && (
            <ConstructorPanel 
                channels={channelDetailsForRegion}
                onClose={() => setModal(null)}
                onCalculate={handleCalculateConstructorSplit}
            />
        )}

        {modal === 'manual_shares' && (
            <ManualSharesPanel 
                channels={channelDetailsForRegion}
                onClose={() => setModal(null)}
                onCalculate={handleCalculateManualSharesSplit}
            />
        )}
        
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
            <Button variant="secondary" onClick={onReset}>Начать заново</Button>
        </div>
    </div>
  );
};