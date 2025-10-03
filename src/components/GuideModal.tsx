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
          AI 역량평가 시뮬레이터 고급 이용 가이드
        </h2>
        <div className="space-y-5 text-gray-300 text-left leading-relaxed">
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">1</span>
            <p><strong>'역량평가 시작하기'</strong> 버튼을 누르면, <strong>출제 전문 AI</strong>가 실시간으로 10개의 고난도 상황판단 문제를 생성합니다. 각 역량별 문제가 병렬로 생성되어 빠르고 효율적입니다.</p>
          </div>
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">2</span>
            <p><strong>정교한 상황 판단</strong>: 각 문제는 '최선', '차선', '최악'의 선택지가 복합적으로 구성되어 당신의 판단 우선순위를 정밀하게 측정합니다. <strong>콘텐츠 보안을 위해 문제 풀이 중에는 캡처 및 복사가 제한됩니다.</strong></p>
          </div>
          <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">3</span>
            <div>
              <p><strong>심층 분석 리포트</strong>: '결과 확인하기'를 누르면 단순 정답을 넘어선 심층 분석 리포트를 제공합니다.</p>
              <ul className="list-disc list-inside text-sm text-gray-400 mt-2 space-y-1">
                <li><strong>다층적 해설</strong>: 5개 선택지 <strong>모두</strong>에 대해 왜 '최선', '차선', '최악'인지 상세한 근거를 제시합니다.</li>
                <li><strong>AI 2차 검증</strong>: <strong>품질 관리 AI</strong>가 문제의 논리적 타당성을 교차 검증한 결과를 함께 보여주어 해설의 신뢰도를 높였습니다.</li>
              </ul>
            </div>
          </div>
           <div className="flex items-start">
            <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold mr-3">4</span>
            <p><strong>성과 관리 (로그인 필수)</strong>: 로그인 시 모든 결과가 자동 저장됩니다. <strong>'나의 성과분석'</strong>에서 회차별 성적 추이와 전체 응시자 대비 나의 <strong>상위 백분위</strong>를 확인하며 체계적으로 학습을 관리하세요.</p>
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