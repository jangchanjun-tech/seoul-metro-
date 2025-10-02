import React from 'react';
import { QuizItem } from '../types';

interface QuizCardProps {
  quizItem: QuizItem;
  questionIndex: number;
  userAnswers: string[];
  showResults: boolean;
  onToggleAnswer: (questionIndex: number, answer: string) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ quizItem, questionIndex, userAnswers, showResults, onToggleAnswer }) => {
  const getOptionClass = (option: string) => {
    const isSelected = userAnswers.includes(option);

    if (!showResults) {
      return isSelected
        ? 'bg-indigo-600 ring-2 ring-indigo-400'
        : 'bg-gray-700 hover:bg-gray-600';
    }

    const isBestAnswer = quizItem.bestAnswers.includes(option);

    if (isBestAnswer && isSelected) {
      return 'bg-green-700 ring-2 ring-green-400'; // Correctly selected
    }
    if (isBestAnswer && !isSelected) {
      return 'bg-gray-700 border-2 border-green-500'; // Correct but not selected
    }
    if (!isBestAnswer && isSelected) {
      return 'bg-red-700 ring-2 ring-red-400'; // Incorrectly selected
    }
    return 'bg-gray-700'; // Default for incorrect and not selected
  };

  const isCorrect = showResults && quizItem.bestAnswers.length === userAnswers.length && [...quizItem.bestAnswers].sort().join(',') === [...userAnswers].sort().join(',');

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-indigo-300 mb-2">[상황]</h3>
        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-900/50 p-4 rounded-md border border-gray-700">{quizItem.passage}</p>
      </div>
      
      <h3 className="text-xl font-bold mb-4 text-indigo-300">
        <span className="text-gray-400 mr-2">{questionIndex + 1}.</span>
        {quizItem.question}
      </h3>
      <p className="text-sm text-gray-400 mb-4 -mt-2 ml-7">가장 적절한 행동 2가지를 선택하세요.</p>
      <div className="grid grid-cols-1 gap-3">
        {quizItem.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onToggleAnswer(questionIndex, option)}
            disabled={showResults || (!userAnswers.includes(option) && userAnswers.length >= 2)}
            className={`w-full text-left p-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70 ${getOptionClass(option)}`}
          >
            {option}
          </button>
        ))}
      </div>
      {showResults && (
         <div className={`mt-4 p-4 rounded-lg text-sm transition-opacity duration-500 ${isCorrect ? 'bg-green-900/50 border-green-700' : 'bg-red-900/50 border-red-700'} border`}>
          <p className="font-bold mb-2 text-lg">
            {isCorrect ? '정답입니다!' : '오답입니다.'}
          </p>
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-300">정답: </span>
              <span>{quizItem.bestAnswers.join(', ')}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">나의 선택: </span>
              <span>{userAnswers.join(', ') || '선택 안 함'}</span>
            </div>
          </div>
          <hr className="my-3 border-gray-600" />
          <p className="text-gray-300 whitespace-pre-wrap">{quizItem.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default QuizCard;
