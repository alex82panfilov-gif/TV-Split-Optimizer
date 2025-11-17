import React from 'react';
import { useState, useEffect } from 'react';
import { BriefData, RegionBrief } from '../types';
import { Button } from './Button';
import { InfoIcon, CloseIcon } from './icons';
import { Spinner } from './Spinner';

interface BriefStepProps {
  availableRegions: string[];
  availableTAs: string[];
  initialData: BriefData;
  onSubmit: (data: BriefData) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
  hasResults: boolean; // Новое свойство для изменения текста кнопки
}

/**
 * Вспомогательный компонент для обертки поля ввода с меткой.
 */
const InputField: React.FC<{ label: string; id: string; children: React.ReactNode; className?: string }> = ({ label, id, children, className }) => (
    <div className={className}>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        {children}
    </div>
);

/**
 * Компонент карточки для ввода данных брифа по одному региону.
 */
const RegionBriefCard: React.FC<{
    regionName: string;
    brief: RegionBrief;
    availableTAs: string[];
    onChange: (region: string, field: keyof RegionBrief, value: string | number | null) => void;
    onRemove: (region: string) => void;
    hasError: boolean;
}> = ({ regionName, brief, availableTAs, onChange, onRemove, hasError }) => {
    return (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800">{regionName}</h3>
                <button onClick={() => onRemove(regionName)} className="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
             <InputField label="Целевая аудитория (ЦА)" id={`ta-${regionName}`}>
                 <div className="relative">
                    <select
                        id={`ta-${regionName}`}
                        value={brief.targetAudience}
                        onChange={(e) => onChange(regionName, 'targetAudience', e.target.value)}
                        className={`w-full px-3 py-2 border ${hasError ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm`}
                        required
                    >
                         <option value="" disabled>-- Выберите ЦА --</option>
                         {availableTAs.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer group">
                        <InfoIcon className="h-5 w-5 text-slate-400 group-hover:text-sky-600" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-slate-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Внимание! Название аудитории должно в точности совпадать с заголовком столбца в вашем файле с рейтингами.
                            <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                        </div>
                    </div>
                 </div>
            </InputField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Мин. доля канала (%)" id={`min-share-${regionName}`}>
                    <input
                        id={`min-share-${regionName}`}
                        type="number"
                        value={brief.minChannelShare ?? ''}
                        onChange={(e) => onChange(regionName, 'minChannelShare', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="По умолчанию: 2"
                    />
                </InputField>
                <InputField label="Макс. доля орбит. (%)" id={`max-orbital-${regionName}`}>
                    <input
                        id={`max-orbital-${regionName}`}
                        type="number"
                        value={brief.maxOrbitalShare ?? ''}
                        onChange={(e) => onChange(regionName, 'maxOrbitalShare', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="Не обязательно"
                    />
                </InputField>
            </div>
            <InputField label="Исключить N% самых дорогих каналов" id={`cutoff-${regionName}`}>
                    <input
                        id={`cutoff-${regionName}`}
                        type="number"
                        value={brief.expensiveChannelCutoff ?? ''}
                        onChange={(e) => onChange(regionName, 'expensiveChannelCutoff', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="По умолчанию: 20"
                    />
            </InputField>
        </div>
    );
};


/**
 * Компонент для Шага 3: "Бриф".
 * Позволяет пользователю выбирать регионы из списка и задавать для них параметры расчета.
 */
export const BriefStep: React.FC<BriefStepProps> = ({ availableRegions, availableTAs, initialData, onSubmit, onBack, isLoading, error, hasResults }) => {
  // Состояние для хранения брифов по всем регионам
  const [regionBriefs, setRegionBriefs] = useState<{ [key: string]: RegionBrief }>(initialData.regionBriefs);
  // Состояние для валидности формы (влияет на активность кнопки "Далее")
  const [isFormValid, setIsFormValid] = useState(false);

  // useEffect для проверки валидности формы при изменении брифов.
  // Форма валидна, если добавлен хотя бы один регион и для каждого указана ЦА.
  useEffect(() => {
    const briefs = Object.values(regionBriefs);
    if (briefs.length === 0) {
      setIsFormValid(false);
    } else {
      setIsFormValid(briefs.every((b: RegionBrief) => b.targetAudience.trim() !== ''));
    }
  }, [regionBriefs]);

  // useEffect для синхронизации состояния с initialData при возврате на шаг
  useEffect(() => {
    setRegionBriefs(initialData.regionBriefs);
  }, [initialData]);

  /**
   * Обработчик выбора/снятия выбора региона.
   */
  const handleRegionToggle = (regionName: string) => {
    const newBriefs = { ...regionBriefs };
    if (newBriefs[regionName]) {
      delete newBriefs[regionName];
    } else {
      newBriefs[regionName] = {
        targetAudience: availableTAs[0] || '', // По умолчанию первая доступная ЦА
        minChannelShare: 2,
        maxOrbitalShare: null,
        expensiveChannelCutoff: 20,
      };
    }
    setRegionBriefs(newBriefs);
  };
  
  /**
   * Обработчик изменения данных в полях карточки региона.
   */
  const handleBriefChange = (region: string, field: keyof RegionBrief, value: string | number | null) => {
    setRegionBriefs(prev => {
      const regionBriefToUpdate = prev[region];
      if (!regionBriefToUpdate) {
        return prev;
      }
      return { ...prev, [region]: { ...regionBriefToUpdate, [field]: value } };
    });
  };

  /**
   * Обработчик отправки формы.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      onSubmit({ regionBriefs });
    }
  };
  
  /**
   * Проверяет, относится ли текущая ошибка к конкретному региону (для подсветки поля).
   */
  const hasErrorForRegion = (regionName: string) : boolean => {
      if(!error || !error.includes("ЦА")) return false;
      const brief = regionBriefs[regionName];
      if (!brief) return false;
      return error.includes(`'${brief.targetAudience}'`) || (brief.targetAudience === '' && error.includes("ЦА"));
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg animate-fade-in">
        <h2 className="text-xl font-bold mb-1">Шаг 2: Бриф</h2>
        <p className="text-slate-500 mb-6">Выберите регионы для расчета и укажите параметры.</p>

        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                <p className="font-bold">Ошибка</p>
                <p>{error}</p>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Выберите регионы для расчета</label>
                <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                    {availableRegions.map(regionName => (
                        <div key={regionName} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`region-checkbox-${regionName}`}
                                checked={!!regionBriefs[regionName]}
                                onChange={() => handleRegionToggle(regionName)}
                                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                            />
                            <label htmlFor={`region-checkbox-${regionName}`} className="ml-3 block text-sm font-medium text-slate-700">
                                {regionName}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {Object.keys(regionBriefs).length === 0 && (
                    <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                        <p>Выберите хотя бы один регион для настройки.</p>
                    </div>
                )}
                {Object.entries(regionBriefs).map(([regionName, brief]) => (
                    <RegionBriefCard 
                        key={regionName}
                        regionName={regionName}
                        brief={brief}
                        availableTAs={availableTAs}
                        onChange={handleBriefChange}
                        onRemove={handleRegionToggle}
                        hasError={hasErrorForRegion(regionName)}
                    />
                ))}
            </div>

            <div className="pt-4 flex justify-between items-center">
                <Button type="button" variant="secondary" onClick={onBack} disabled={isLoading}>
                    Назад
                </Button>
                <Button type="submit" size="lg" disabled={!isFormValid || isLoading}>
                    {isLoading ? <Spinner /> : (hasResults ? 'Пересчитать' : 'Рассчитать')}
                </Button>
            </div>
        </form>
    </div>
  );
};