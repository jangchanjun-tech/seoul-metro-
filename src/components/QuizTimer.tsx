import React from 'react';

interface QuizTimerProps {
  elapsedTime: number; // in seconds
}

const QuizTimer: React.FC<QuizTimerProps> = ({ elapsedTime }) => {
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed top-28 right-4 sm:right-6 md:right-8 z-40 bg-gray-800/70 backdrop-blur-sm border border-gray-600 rounded-lg shadow-lg px-4 py-2 flex items-center space-x-3 animate-fade-in"
      aria-live="off"
      aria-label="경과 시간"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-white font-mono text-2xl tracking-wider">{formatTime(elapsedTime)}</span>
    </div>
  );
};

export default QuizTimer;