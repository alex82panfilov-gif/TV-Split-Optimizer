import React from 'react';
import { useState } from 'react';
import { BriefStep } from './components/BriefStep';
import { UploadStep } from './components/UploadStep';
import { ResultsStep } from './components/ResultsStep';
import { InstructionStep } from './components/InstructionStep';
import { Stepper } from './components/Stepper';
import { BriefData, AppStep, CalculationResults, StoredFile } from './types';
import { processFilesAndCalculate, preParseRatingsFile } from './services/calculationService';
import { Header } from './components/Header';

/**
 * Основной компонент приложения "TV Split Optimizer".
 * Управляет состоянием и переходами между шагами: Инструкция, Загрузка, Бриф, Результаты.
 */
const App: React.FC = () => {
  // Состояние для отслеживания текущего шага в процессе (начинаем с инструкции)
  const [step, setStep] = useState<AppStep>('instruction');
  // Новое состояние для отслеживания пройденных шагов для навигации
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set(['instruction']));
  // Состояние для хранения данных брифа
  const [briefData, setBriefData] = useState<BriefData>({
    regionBriefs: {},
  });
  // Состояние для хранения загруженных файлов
  const [files, setFiles] = useState<{ ratings: StoredFile | null; cpp: StoredFile | null }>({
    ratings: null,
    cpp: null,
  });
  // Состояние для хранения результатов расчетов
  const [results, setResults] = useState<CalculationResults | null>(null);
  // Состояние для отслеживания процесса загрузки/расчета
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Состояние для хранения сообщений об ошибках
  const [error, setError] = useState<string | null>(null);
  // Новые состояния для хранения данных, извлеченных из файла
  const [availableRegions, setAvailableRegions] = useState<string[] | null>(null);
  const [availableTAs, setAvailableTAs] = useState<string[] | null>(null);

  /**
   * Новый обработчик для навигации по шагам.
   * @param targetStep - Шаг, на который нужно перейти.
   */
  const handleStepNavigation = (targetStep: AppStep) => {
    if (completedSteps.has(targetStep)) {
      setError(null); // Очищаем ошибки при переходе
      setStep(targetStep);
    }
  };

  /**
   * Обработчик для шага "Загрузка".
   * Выполняет предварительный парсинг файла с рейтингами после успешной валидации.
   * @param ratingsFile - Валидированный файл с рейтингами.
   * @param cppFile - Валидированный файл с ценами (CPP).
   */
  const handlePreParseSubmit = async (ratingsFile: StoredFile, cppFile: StoredFile) => {
    // При загрузке новых файлов сбрасываем все последующие данные
    setResults(null);
    setBriefData({ regionBriefs: {} });
    setAvailableRegions(null);
    setAvailableTAs(null);
    
    // Сбрасываем пройденные шаги, которые зависят от файлов
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add('instruction');
    newCompletedSteps.add('upload');
    newCompletedSteps.delete('brief');
    newCompletedSteps.delete('results');
    setCompletedSteps(newCompletedSteps);

    setFiles({ ratings: ratingsFile, cpp: cppFile });
    setIsLoading(true);
    setError(null);
    try {
      const { regions, targetAudiences } = await preParseRatingsFile(ratingsFile);
      setAvailableRegions(regions);
      setAvailableTAs(targetAudiences);
      setStep('brief');
    } catch (e: any) {
      setError(e.message);
      setStep('upload'); // Остаемся на шаге загрузки, если парсинг не удался
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Обработчик для шага "Бриф". Запускает полный расчет.
   * @param data - Данные брифа.
   */
  const handleCalculate = async (data: BriefData) => {
    if (!files.ratings || !files.cpp) {
      setError("Файлы не были загружены. Пожалуйста, вернитесь на шаг загрузки.");
      setStep('upload');
      return;
    }
    setBriefData(data);
    setIsLoading(true);
    setError(null);
    try {
      const calculatedResults = await processFilesAndCalculate(files.ratings, files.cpp, data);
      setResults(calculatedResults);
      // Отмечаем шаг брифа как пройденный и переходим к результатам
      setCompletedSteps(prev => new Set(prev).add('brief'));
      setStep('results');
    } catch (e: any)
{
      setError(e.message);
      setStep('brief');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Функции навигации ---
  const handleGoToUpload = () => {
    setCompletedSteps(prev => new Set(prev).add('instruction'));
    setStep('upload');
  };
  
  /**
   * Сброс всего процесса и возврат на начальный экран.
   */
  const handleReset = () => {
    setStep('instruction');
    setCompletedSteps(new Set(['instruction']));
    setBriefData({ regionBriefs: {} });
    setFiles({ ratings: null, cpp: null });
    setResults(null);
    setError(null);
    setIsLoading(false);
    setAvailableRegions(null);
    setAvailableTAs(null);
  };
  
  const STEPS_CONFIG: { id: AppStep; name: string }[] = [
    { id: 'upload', name: 'Загрузка файлов' },
    { id: 'brief', name: 'Настройка брифа' },
    { id: 'results', name: 'Результаты' },
  ];

  /**
   * Рендеринг компонента текущего шага.
   */
  const renderStep = () => {
    switch (step) {
      case 'instruction':
        return <InstructionStep onNext={handleGoToUpload} />;
      case 'upload':
        return <UploadStep onSubmit={handlePreParseSubmit} onBack={() => handleStepNavigation('instruction')} isLoading={isLoading} error={error} />;
      case 'brief':
        return availableRegions && availableTAs ? (
            <BriefStep 
                availableRegions={availableRegions}
                availableTAs={availableTAs}
                initialData={briefData} 
                onSubmit={handleCalculate} 
                onBack={() => handleStepNavigation('upload')}
                isLoading={isLoading}
                error={error} 
                hasResults={!!results}
            />
        ) : null;
      case 'results':
        return results ? <ResultsStep results={results} onReset={handleReset} briefData={briefData} /> : null;
      default:
        return <InstructionStep onNext={handleGoToUpload} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header />
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {step !== 'instruction' && (
            <Stepper 
                steps={STEPS_CONFIG}
                currentStep={step}
                completedSteps={completedSteps}
                onStepClick={handleStepNavigation}
            />
        )}
        {renderStep()}
      </main>
    </div>
  );
};

export default App;