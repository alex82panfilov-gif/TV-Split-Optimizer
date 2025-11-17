import React from 'react';
import { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  title: string;
  description: string;
  file: File | null;
}

/**
 * Компонент для загрузки файла с поддержкой drag-and-drop.
 * @param onFileSelect - Функция обратного вызова, вызываемая при выборе файла.
 * @param title - Заголовок блока загрузки.
 * @param description - Описание под заголовком.
 * @param file - Текущий выбранный файл (для отображения имени).
 */
export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, title, description, file }) => {
  // Состояние для отслеживания, находится ли файл над областью drop-зоны
  const [isDragging, setIsDragging] = useState(false);

  // Обработчики событий drag-and-drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  /**
   * Обработчик выбора файла через стандартный диалог.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const borderColor = isDragging ? 'border-sky-500' : 'border-slate-300';

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{title}</label>
      <div
        className={`relative flex justify-center w-full px-6 pt-5 pb-6 border-2 ${borderColor} border-dashed rounded-md transition-colors`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
          <div className="flex text-sm text-slate-600">
            <label
              htmlFor={`file-upload-${title}`}
              className="relative cursor-pointer bg-white rounded-md font-medium text-sky-600 hover:text-sky-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-sky-500"
            >
              <span>Загрузите файл</span>
              <input id={`file-upload-${title}`} name={`file-upload-${title}`} type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx, .xls"/>
            </label>
            <p className="pl-1">или перетащите</p>
          </div>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {file && (
        <div className="mt-2 text-sm text-slate-600">
          Выбран файл: <span className="font-medium">{file.name}</span>
        </div>
      )}
    </div>
  );
};
