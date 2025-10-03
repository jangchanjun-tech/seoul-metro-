import React from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-lg p-6 sm:p-8 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="이용안내 닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id="guide-title" className="text-2xl font-bold text-indigo-400 mb-6 text-center">
          이용안내
        </h2>
        <div className="space-y-4 text-gray-300 text-left leading-relaxed">
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">1</span>
            <p><strong>'실전 모의고사 시작하기'</strong> 버튼을 눌러 AI가 10개의 실전 문제를 생성할 때까지 잠시 기다립니다.</p>
          </div>
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">2</span>
            <p>제시된 상황을 잘 읽고, 가장 적절하다고 생각하는 행동 <strong>2가지</strong>를 선택하세요.</p>
          </div>
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">3</span>
            <p>10문제를 모두 풀면 <strong>'결과 확인하기'</strong> 버튼이 활성화됩니다. 버튼을 누르면 정답과 상세한 해설을 볼 수 있습니다.</p>
          </div>
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">4</span>
            <p><strong>로그인</strong>하면 퀴즈 결과가 자동으로 저장되어 학습 기록을 관리할 수 있습니다.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          확인
        </button>
      </div>
    </div>
  );
};

export default GuideModal;