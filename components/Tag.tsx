import React from 'react';
import { CloseIcon } from './icons';

interface TagProps {
  label: string;
  onRemove: () => void;
}

/**
 * Компонент для отображения тега с кнопкой удаления.
 * Используется для отображения добавленных регионов.
 * @param label - Текст тега.
 * @param onRemove - Функция обратного вызова при нажатии на кнопку удаления.
 */
export const Tag: React.FC<TagProps> = ({ label, onRemove }) => {
  return (
    <div className="flex items-center bg-sky-100 text-sky-800 text-sm font-medium px-3 py-1 rounded-full">
      <span>{label}</span>
      <button onClick={onRemove} className="ml-2 -mr-1 p-0.5 rounded-full hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500">
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
