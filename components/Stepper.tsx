import React from 'react';
import { AppStep } from '../types';

interface StepperProps {
  steps: { id: AppStep; name: string }[];
  currentStep: AppStep;
  completedSteps: Set<AppStep>;
  onStepClick: (step: AppStep) => void;
}

/**
 * Компонент для отображения шагов процесса и навигации по ним.
 * @param steps - Массив объектов с описанием шагов.
 * @param currentStep - ID текущего шага.
 * @param completedSteps - Set с ID пройденных шагов.
 * @param onStepClick - Функция обратного вызова при клике на пройденный шаг.
 */
export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, completedSteps, onStepClick }) => {
  return (
    <div className="w-full py-4 mb-6">
        <div className="flex items-start">
            {steps.map((step, index) => {
                 const isCompleted = completedSteps.has(step.id);
                 const isCurrent = currentStep === step.id;
                 const isClickable = isCompleted && !isCurrent;
                 
                 const statusClasses = {
                    circle: isCurrent ? 'border-sky-500' : isCompleted ? 'bg-sky-500 border-sky-500' : 'border-slate-300',
                    text: isCurrent ? 'text-sky-600 font-semibold' : isCompleted ? 'text-slate-700' : 'text-slate-500',
                    line: isCompleted || isCurrent ? 'bg-sky-500' : 'bg-slate-300'
                 };

                 const StepContent = (
                    <>
                        <div className={`w-10 h-10 mx-auto rounded-full text-lg flex items-center justify-center border-2 transition-colors ${statusClasses.circle} ${isClickable ? 'group-hover:bg-sky-600 group-hover:border-sky-600' : ''}`}>
                            {isCompleted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <span className={isCurrent ? 'text-sky-600' : 'text-slate-500'}>{index + 1}</span>
                            )}
                        </div>
                        <div className={`text-center mt-2 text-sm ${statusClasses.text}`}>{step.name}</div>
                    </>
                 );
                
                return (
                    <React.Fragment key={step.id}>
                        <div className="w-1/3 text-center px-2">
                           {isClickable ? (
                               <button onClick={() => onStepClick(step.id)} className="w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-md">
                                   {StepContent}
                               </button>
                           ) : (
                               <div>{StepContent}</div>
                           )}
                        </div>
                        {index < steps.length - 1 && (
                            <div className="w-1/3 flex-auto pt-5">
                                <div className={`h-1 rounded-full ${statusClasses.line}`}></div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    </div>
  );
};
