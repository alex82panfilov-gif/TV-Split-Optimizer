import React from 'react';
import { useState } from 'react';
import { FileUpload } from './FileUpload';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { StoredFile } from '../types';
import { validateRatingsFile, validateCppFile } from '../services/validationService';

interface UploadStepProps {
  onSubmit: (ratingsFile: StoredFile, cppFile: StoredFile) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null; // For async errors from App
}

/**
 * Компонент для Шага 2: "Загрузка и Валидация".
 * Позволяет загрузить файлы и выполняет их проверку перед обработкой.
 */
export const UploadStep: React.FC<UploadStepProps> = ({ onSubmit, onBack, isLoading, error }) => {
  const [ratingsFile, setRatingsFile] = useState<File | null>(null);
  const [cppFile, setCppFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Обработчик нажатия "Далее".
   * Читает, валидирует и передает файлы для дальнейшей обработки.
   */
  const handleSubmit = async () => {
    if (ratingsFile && cppFile) {
        setValidationError(null);

        const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        };

        try {
            const ratingsContent = await readFileAsArrayBuffer(ratingsFile);
            const cppContent = await readFileAsArrayBuffer(cppFile);
            
            const ratingsStoredFile = { name: ratingsFile.name, content: ratingsContent };
            const cppStoredFile = { name: cppFile.name, content: cppContent };
            
            // Выполнение строгой валидации
            await validateRatingsFile(ratingsStoredFile);
            await validateCppFile(cppStoredFile);

            // Если валидация прошла, вызываем onSubmit
            onSubmit(ratingsStoredFile, cppStoredFile);
        } catch (e: any) {
            // В случае ошибки валидации, показываем ее пользователю
            setValidationError(e.message);
        }
    }
  };
  
  // Отображаем либо ошибку валидации, либо ошибку асинхронной обработки из App
  const currentError = validationError || error;

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg animate-fade-in">
        <h2 className="text-xl font-bold mb-1">Шаг 2: Загрузка и Валидация</h2>
        <p className="text-slate-500 mb-6">Загрузите Excel-файлы с исходными данными.</p>

        {currentError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                <p className="font-bold">Ошибка</p>
                <p>{currentError}</p>
            </div>
        )}

        <div className="space-y-6">
            <FileUpload 
                title="Файл с рейтингами"
                description="Загрузите файл со структурой листа result"
                file={ratingsFile}
                onFileSelect={(file) => { setRatingsFile(file); setValidationError(null); }}
            />
            <FileUpload 
                title="Файл с ценами"
                description="Загрузите файл со структурой листа CPP"
                file={cppFile}
                onFileSelect={(file) => { setCppFile(file); setValidationError(null); }}
            />
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
            <Button type="button" variant="secondary" onClick={onBack} disabled={isLoading}>
                Назад
            </Button>
            <Button 
                type="button" 
                size="lg" 
                onClick={handleSubmit} 
                disabled={!ratingsFile || !cppFile || isLoading}
            >
                {isLoading ? <Spinner /> : 'Далее'}
            </Button>
        </div>
    </div>
  );
};
