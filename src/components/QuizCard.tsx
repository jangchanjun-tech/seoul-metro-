import React from 'react';
import { QuizItem } from '../types';

interface QuizCardProps {
  quizItem: QuizItem;
  questionIndex: number;
  userAnswers: string[];
  showResults: boolean;
  onToggleAnswer: (questionIndex: number, answer: string) => void;
  isVerifying: boolean;
  verificationResult?: string;
}

const QuizCard: React.FC<QuizCardProps> = ({ quizItem, questionIndex, userAnswers, showResults, onToggleAnswer, isVerifying, verificationResult }) => {

  const getOptionType = (option: string): '최선' | '차선' | '최악' | null => {
    if (quizItem.bestAnswers.includes(option)) return '최선';
    if (quizItem.secondBestAnswers.includes(option)) return '차선';
    if (quizItem.worstAnswer === option) return '최악';
    return null;
  };

  const getTypeLabelClass = (type: '최선' | '차선' | '최악') => {
    switch (type) {
        case '최선': return 'bg-green-500/20 text-green-300 border-green-500/50';
        case '차선': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
        case '최악': return 'bg-red-500/20 text-red-300 border-red-500/50';
    }
  };

  const getOptionClass = (option: string) => {
    const isSelected = userAnswers.includes(option);

    if (!showResults) {
      return isSelected
        ? 'bg-indigo-600 ring-2 ring-indigo-400'
        : 'bg-gray-700 hover:bg-gray-600';
    }

    const isBestAnswer = quizItem.bestAnswers.includes(option);

    if (isBestAnswer) {
      return isSelected 
        ? 'bg-green-700 ring-2 ring-green-400' // 최선을 맞게 선택
        : 'bg-gray-700 border-2 border-green-500'; // 최선인데 선택 안함
    }
    
    // 최선이 아닌 답변
    if (isSelected) {
      // 빨간색 대신 중립적인 회색 테두리로 변경하여 사용자의 선택임을 표시
      return 'bg-gray-700 ring-2 ring-gray-500'; 
    }
    
    // 그 외 (최선도 아니고, 선택하지도 않은 답변)
    return 'bg-gray-700 opacity-60';
  };

  const isCorrect = showResults && userAnswers.some(ans => quizItem.bestAnswers.includes(ans));

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-indigo-300">[상황]</h3>
        <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-400/50">
          평가 역량: {quizItem.competency}
        </span>
      </div>

      <div className="mb-6">
        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-900/50 p-4 rounded-md border border-gray-700">{quizItem.passage}</p>
      </div>
      
      <h3 className="text-xl font-bold mb-4 text-indigo-300">
        <span className="text-gray-400 mr-2">{questionIndex + 1}.</span>
        {quizItem.question}
      </h3>
      <p className="text-sm text-gray-400 mb-4 -mt-2 ml-7">가장 적절한 행동 2가지를 선택하세요.</p>
      <div className="grid grid-cols-1 gap-3">
        {quizItem.options.map((option, index) => {
           const type = showResults ? getOptionType(option) : null;
           const isSelected = userAnswers.includes(option);
           return (
            <div key={index} className="flex items-center gap-3">
              <button
                onClick={() => onToggleAnswer(questionIndex, option)}
                disabled={showResults || (!isSelected && userAnswers.length >= 2)}
                className={`flex-grow text-left p-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70 flex justify-between items-center ${getOptionClass(option)}`}
              >
                <span>{option}</span>
                {showResults && isSelected && (
                  <span className="flex-shrink-0 text-xs font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-400/50 px-2 py-0.5 rounded-full">
                    나의 선택
                  </span>
                )}
              </button>
              {type && (
                <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${getTypeLabelClass(type)}`}>
                  {type}
                </span>
              )}
            </div>
           )
        })}
      </div>
      {showResults && (
         <div className={`mt-6 p-4 rounded-lg text-sm transition-opacity duration-500 ${isCorrect ? 'bg-green-900/50 border-green-700' : 'bg-red-900/50 border-red-700'} border`}>
          <p className="font-bold mb-2 text-lg">
            {isCorrect ? '좋은 선택입니다!' : '아쉬운 선택입니다.'}
          </p>
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-300">정답 (최선): </span>
              <span>{quizItem.bestAnswers.join(', ')}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">나의 선택: </span>
              <span>{userAnswers.join(', ') || '선택 안 함'}</span>
            </div>
          </div>
          <hr className="my-3 border-gray-600" />
          <div>
            <h4 className="font-semibold text-indigo-300 mb-2">상세 해설</h4>
            <p className="text-gray-300 whitespace-pre-wrap">{quizItem.explanation}</p>
          </div>
          <hr className="my-3 border-gray-600" />
          <div className="mt-4">
              <h4 className="font-semibold text-indigo-300 mb-2">AI 검증 결과</h4>
              {isVerifying && !verificationResult && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>해설의 논리적 타당성을 검증하고 있습니다...</span>
                  </div>
              )}
              {verificationResult && (
                  <p className="text-gray-300 whitespace-pre-wrap">{verificationResult}</p>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizCard;
