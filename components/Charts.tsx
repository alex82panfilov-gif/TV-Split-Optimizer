import React, { useEffect, useRef } from 'react';

// Make Chart.js available from the global scope (window)
declare const Chart: any;

interface ChartProps {
  data: any;
  options?: any;
}

/**
 * A responsive Bar Chart component using Chart.js
 */
export const BarChart: React.FC<ChartProps> = ({ data, options }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy previous chart instance if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
                label: function(context: any) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                       if (context.dataset.label === 'Бюджет' || context.dataset.label === 'CPP TA') {
                           label += new Intl.NumberFormat('ru-RU').format(context.parsed.y);
                       } else {
                           label += new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(context.parsed.y);
                       }
                    }
                    return label;
                }
            }
          }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    font: {
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                    }
                }
            },
            x: {
                 ticks: {
                    font: {
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                    }
                }
            }
        },
        ...options,
      },
    });

    // Cleanup function to destroy the chart on component unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options]); // Re-run effect if data or options change

  return <div className="relative h-80 w-full"><canvas ref={canvasRef}></canvas></div>;
};

/**
 * A responsive Doughnut Chart component using Chart.js
 */
export const DoughnutChart: React.FC<ChartProps> = ({ data, options }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy previous chart instance
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
                 font: {
                    size: 12,
                    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                 },
                 boxWidth: 20,
                 padding: 15,
            }
          },
          tooltip: {
            callbacks: {
                 label: function(context: any) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed !== null) {
                        label += context.parsed.toFixed(2) + '%';
                    }
                    return label;
                }
            }
          }
        },
        ...options,
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options]);

  return <div className="relative h-96 w-full"><canvas ref={canvasRef}></canvas></div>;
};