import React from 'react';

/**
 * Компонент заголовка (шапки) приложения.
 * Отображает название и подзаголовок.
 */
export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-4 md:px-8">
        <h1 className="text-2xl font-bold text-slate-900">Оптимизатор ТВ-сплитов</h1>
        <p className="text-sm text-slate-500">Автоматизированный расчет ТВ-сплитов</p>
      </div>
    </header>
  );
};