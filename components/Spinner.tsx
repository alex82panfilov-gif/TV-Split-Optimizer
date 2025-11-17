import React from 'react';

/**
 * Компонент спиннера (индикатора загрузки).
 */
export const Spinner: React.FC = () => {
  return (
    <div className="border-gray-300 h-8 w-8 animate-spin rounded-full border-4 border-t-sky-600" />
  );
};
