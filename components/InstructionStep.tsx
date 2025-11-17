import React, { useState } from 'react';
import { Button } from './Button';
import { ChevronDownIcon } from './icons';

// Библиотека XLSX загружается из CDN, поэтому мы объявляем ее для TypeScript.
declare const XLSX: any;

interface InstructionStepProps {
  onNext: () => void;
}

/**
 * Компонент для нового Шага 1: "Инструкция".
 * Предоставляет пользователю руководство по подготовке данных и шаблоны.
 */
export const InstructionStep: React.FC<InstructionStepProps> = ({ onNext }) => {
  const [isMethodologyVisible, setMethodologyVisible] = useState(false);

  /**
   * Генерирует и загружает Excel-файл шаблона на лету.
   * @param type - Тип шаблона ('ratings' или 'cpp').
   */
  const handleDownloadTemplate = (type: 'ratings' | 'cpp') => {
    const wb = XLSX.utils.book_new();
    let ws_data: any[][] = [];
    let fileName = '';
    let colWidths: {wch: number}[] = [];

    if (type === 'ratings') {
      fileName = 'Шаблон_Рейтинги.xlsx';
      ws_data = [
        ['Регион', 'Телекомпания', 'Блок содержание', 'Блок распространение', 'GRP баинговая', 'W 25-45 BC__AVG Reg TVR', 'W 25-45 BC__PBA Reg TVR', 'Sales TVR'],
        ['Россия', 'Первый канал', 'Коммерческий', 'Сетевое', '18+', 1.42, 1.39, 1.53],
        ['Москва', 'СТС', 'Коммерческий', 'Локальный', 'N/A', 0.95, 0.88, 0.81],
        ['Россия', 'РЕН ТВ - 0', 'Коммерческий', 'Орбитальный', '25-54', 1.25, 1.01, 1.10],
      ];
      colWidths = [{wch:15}, {wch:20}, {wch:20}, {wch:25}, {wch:15}, {wch:30}, {wch:30}, {wch:12}];
    } else {
      fileName = 'Шаблон_Цены.xlsx';
      ws_data = [
        ['Регион', 'Канал', 'CPP'],
        ['Россия', 'Первый канал', 300000],
        ['Россия', 'РЕН ТВ - 0', 30310],
        ['Москва', 'СТС', 174000],
      ];
      colWidths = [{wch:15}, {wch:20}, {wch:15}];
    }
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, fileName);
  };


  return (
    <div className="bg-white p-8 rounded-lg shadow-lg animate-fade-in">
      <h2 className="text-2xl font-bold mb-4 text-slate-800">Добро пожаловать в TV Split Optimizer!</h2>
      <p className="text-slate-600 mb-6">
        Перед началом работы, пожалуйста, ознакомьтесь с требованиями к подготовке данных и методикой расчета. Корректный формат файлов — залог точного и быстрого расчета.
      </p>

      <div className="mb-8 border border-sky-200 bg-sky-50 rounded-lg overflow-hidden">
        <button
          onClick={() => setMethodologyVisible(!isMethodologyVisible)}
          className="w-full flex justify-between items-center p-4 hover:bg-sky-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-expanded={isMethodologyVisible}
          aria-controls="methodology-content"
        >
          <h3 className="text-lg font-semibold text-sky-800">Методика расчета ТВ-сплитов</h3>
          <ChevronDownIcon className={`w-5 h-5 text-sky-600 transition-transform duration-300 ${isMethodologyVisible ? 'rotate-180' : ''}`} />
        </button>
        {isMethodologyVisible && (
          <div id="methodology-content" className="p-6 border-t border-sky-200 text-slate-700 space-y-4">
            <p className="text-sm">
                Цель данного документа — обеспечить полную прозрачность алгоритмов, используемых калькулятором, для подтверждения их корректности, соответствия индустриальным практикам и возможности ручной верификации.
            </p>

            <h4 className="text-base font-semibold pt-2">Общие этапы расчета (для всех типов сплитов)</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                    <strong>Подготовка данных:</strong> Калькулятор отбирает из файла с рейтингами только те строки, которые соответствуют регионам, указанным в "Брифе".
                </li>
                <li>
                    <strong>Расчет базовых метрик:</strong> Для каждой строки (канал/регион) рассчитываются ключевые показатели:
                    <ul className="list-disc list-inside mt-2 pl-4 space-y-1">
                        <li><code className="text-xs bg-slate-100 p-1 rounded">Affinity = TVR TA / Sales TVR</code>. Показывает, насколько аудитория канала более склонна к просмотру, чем население в целом.</li>
                        <li><code className="text-xs bg-slate-100 p-1 rounded">TCPP = CPP / Affinity</code>. Стоимость закупки пункта рейтинга именно в целевой аудитории.</li>
                        <li><code className="text-xs bg-slate-100 p-1 rounded">Index TCPP = TCPP канала / MAX(TCPP в регионе)</code>. Относительный индекс дороговизны канала по сравнению с самым дорогим в регионе.</li>
                    </ul>
                </li>
                <li>
                    <strong>Первичный отбор каналов:</strong> Для всех сплитов, кроме "Натурального", предварительно отбираются каналы, у которых Index TCPP находится в нижних 80% (т.е. отсекаются 20% самых дорогих по TCPP каналов). Это стандартная практика для отсечения неэффективного инвентаря.
                </li>
                <li>
                    <strong>Итеративная оптимизация:</strong> Расчет долей происходит в цикле. После каждого расчета проверяется, соответствует ли доля каждого канала минимальному порогу из "Брифа". Если нет — канал отключается, и доли перераспределяются между оставшимися. Цикл повторяется до тех пор, пока состав каналов в сплите не стабилизируется.
                </li>
            </ol>

            <h4 className="text-base font-semibold pt-2">Методика расчета "Взвешенного рейтинга"</h4>
            <p className="text-sm">
                Разница между четырьмя вариантами сплитов заключается в том, как рассчитывается "Взвешенный рейтинг" — основной показатель, на базе которого затем пропорционально распределяются доли.
            </p>
            <div className="space-y-3 text-sm">
                <div>
                    <h5 className="font-semibold">Сплит (Натуральный)</h5>
                    <p><strong>Принцип:</strong> Распределение долей строго пропорционально рейтингу канала в целевой аудитории. Не учитываются ни стоимость, ни аффинитивность.</p>
                    <p><strong>Формула:</strong> <code className="text-xs bg-slate-100 p-1 rounded">Взв. рейтинг = TVR TA</code></p>
                </div>
                <div>
                    <h5 className="font-semibold">Сплит (Affinity)</h5>
                    <p><strong>Принцип:</strong> Приоритет отдается каналам, ядро аудитории которых максимально совпадает с целевой аудиторией кампании.</p>
                    <p><strong>Формула:</strong> <code className="text-xs bg-slate-100 p-1 rounded">Взв. рейтинг = TVR TA * Affinity</code></p>
                    <p className="text-xs italic mt-1"><strong>Важная логика:</strong> Для минутных каналов, у которых нет данных для расчета Affinity, показатель Affinity принимается равным 1.0 (нейтральное значение). Это позволяет им участвовать в сплите наравне с другими, основываясь на их "чистом" TVR.</p>
                </div>
                <div>
                    <h5 className="font-semibold">Сплит (Эффективность)</h5>
                    <p><strong>Принцип:</strong> Приоритет отдается каналам, которые позволяют набрать максимальное количество пунктов рейтинга (TRP) за условную денежную единицу.</p>
                    <p><strong>Формула:</strong> <code className="text-xs bg-slate-100 p-1 rounded">Взв. рейтинг = TVR TA / CPP</code></p>
                    <p className="text-xs italic mt-1"><strong>Интерпретация:</strong> Эта формула по сути рассчитывает, сколько рейтинга (TVR) можно "купить" за 1 рубль.</p>
                </div>
                <div>
                    <h5 className="font-semibold">Сплит (TCPP)</h5>
                    <p><strong>Принцип:</strong> Наиболее сбалансированный подход. Он учитывает и рейтинг (TVR), и стоимость (CPP), и качество аудитории (Affinity). Приоритет отдается каналам с наиболее низкой стоимостью за целевой рейтинг (TCPP).</p>
                    <p><strong>Формула:</strong> <code className="text-xs bg-slate-100 p-1 rounded">Взв. рейтинг = TVR TA / (TCPP / Средний_TCPP_по_выборке)</code></p>
                    <p className="text-xs italic mt-1"><strong>Интерпретация:</strong> В этой логике рейтинг канала корректируется на его относительную дороговизну. Каналы, у которых TCPP ниже среднего, получают "бонус" к своему TVR. Каналы с TCPP выше среднего получают "штраф".</p>
                </div>
            </div>
            
            <h4 className="text-base font-semibold pt-2">Финальный расчет "Доли в сплите"</h4>
             <p className="text-sm">
                После того как "Взвешенный рейтинг" рассчитан для каждого канала по одной из вышеописанных логик, финальная доля определяется по единой для всех сплитов формуле:
             </p>
             <div className="text-center p-2 bg-slate-100 rounded">
                <code className="font-mono font-semibold">Доля канала (%) = (Взв. рейтинг канала) / (Сумма всех Взв. рейтингов по региону)</code>
             </div>
        </div>
        )}
      </div>

      <div className="space-y-6 text-slate-700">
        <div>
          <h3 className="text-lg font-semibold mb-2">1. Подготовьте два обязательных файла</h3>
          <p className="mb-4">Вам понадобятся два отчета в формате Excel (.xlsx): один с рейтингами, другой с ценами.</p>
          <div className="pl-4 border-l-4 border-sky-200 space-y-4">
            <div>
              <h4 className="font-bold">Файл с Рейтингами</h4>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><span className="font-semibold">Источник:</span> Данные должны быть выгружены напрямую из системы A1 Okkam (или Mediascope Palomars).</li>
                <li><span className="font-semibold">Содержание:</span> Отчет должен содержать данные по регионам, телеканалам и вашим целевым аудиториям.</li>
                <li>
                  <span className="font-semibold">Ключевые требования к столбцам:</span>
                  <ul className="list-['-_'] list-inside ml-4 mt-1 space-y-1">
                    <li><span className="font-semibold">Обязательные столбцы:</span> <code className="text-xs bg-slate-100 p-1 rounded">Регион</code>, <code className="text-xs bg-slate-100 p-1 rounded">Телекомпания</code>, <code className="text-xs bg-slate-100 p-1 rounded">Блок распространение</code>, <code className="text-xs bg-slate-100 p-1 rounded">GRP баинговая</code>, <code className="text-xs bg-slate-100 p-1 rounded">Sales TVR</code>.</li>
                    <li><span className="font-semibold">Столбец <code className="text-xs bg-slate-100 p-1 rounded">GRP баинговая</code> критически важен!</span> По нему приложение определяет тип закупки (рейтинговый/минутный). Для минутной закупки поле должно быть пустым или "N/A".</li>
                    <li><span className="font-semibold">Столбцы с ЦА:</span> Для каждой ЦА должна быть пара столбцов с суффиксами <code className="text-xs bg-slate-100 p-1 rounded">__AVG Reg TVR</code> (или <code className="text-xs bg-slate-100 p-1 rounded">__AVG TVR</code>) и <code className="text-xs bg-slate-100 p-1 rounded">__PBA Reg TVR</code> (или <code className="text-xs bg-slate-100 p-1 rounded">__TVR</code>).</li>
                  </ul>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold">Файл с Ценами (CPP)</h4>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><span className="font-semibold">Источник:</span> Ваш внутренний прайс-лист.</li>
                <li><span className="font-semibold">Обязательные столбцы:</span> <code className="text-xs bg-slate-100 p-1 rounded">Регион</code>, <code className="text-xs bg-slate-100 p-1 rounded">Канал</code>, <code className="text-xs bg-slate-100 p-1 rounded">CPP</code>.</li>
                <li><span className="font-semibold">Формат названий:</span> Названия регионов и каналов должны совпадать с файлом рейтингов.</li>
                <li><span className="font-semibold">Цены для орбит:</span> Указывайте с суффиксом <code className="text-xs bg-slate-100 p-1 rounded">- 0</code> (например, <code className="text-xs bg-slate-100 p-1 rounded">РЕН ТВ - 0</code>).</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div>
            <h3 className="text-lg font-semibold mb-2">2. Скачайте и используйте наши шаблоны</h3>
            <p className="mb-4">Чтобы избежать ошибок, мы настоятельно рекомендуем использовать наши шаблоны. Они уже содержат правильные названия столбцов.</p>
            <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="secondary" className="w-full" onClick={() => handleDownloadTemplate('ratings')}>
                    Скачать шаблон для Рейтингов
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => handleDownloadTemplate('cpp')}>
                    Скачать шаблон для Цен
                </Button>
            </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
        <Button size="lg" onClick={onNext}>Далее</Button>
      </div>
    </div>
  );
};