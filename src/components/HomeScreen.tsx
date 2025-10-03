import React from 'react';

interface HomeScreenProps {
  onStartQuiz: () => void;
  isLoading: boolean;
}

const CompetencyCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 flex items-start space-x-4 transition-transform transform hover:scale-105 hover:border-indigo-500/50">
        <div className="flex-shrink-0 bg-indigo-600/20 text-indigo-400 rounded-lg p-2 border border-indigo-500/30">
            {icon}
        </div>
        <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    </div>
);

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartQuiz, isLoading }) => {
    const competencies = [
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962a3.75 3.75 0 015.25 0m-5.25 0a3.75 3.75 0 00-5.25 0m7.5-3.375c0-1.02.225-2.003.625-2.922m-5.625 2.922c.4-1.918 2.03-3.375 3.875-3.375s3.475 1.457 3.875 3.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            title: "지휘감독능력",
            description: "팀을 이끌고 목표를 달성하는 리더십"
        },
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-.625m3.75.625V3.375" /></svg>,
            title: "책임감 및 적극성",
            description: "주도적으로 문제를 해결하려는 자세"
        },
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.5a.75.75 0 01.75.75v3.522c0 .24.122.463.32.6a2.25 2.25 0 013.36 2.148l-3.36 6.352a2.25 2.25 0 01-4.24 0L4.28 12.62a2.25 2.25 0 013.36-2.148c.198-.137.32-.36.32-.6V5.25A.75.75 0 019 4.5z" /></svg>,
            title: "관리자로서의 자세 및 청렴도",
            description: "공정하고 투명한 업무 처리 능력"
        },
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a12.061 12.061 0 01-4.5 0m4.5 0a3.003 3.003 0 01-1.5 0m1.5 0a3.003 3.003 0 00-1.5 0m-9.75 0h9.75" /></svg>,
            title: "경영의식 및 혁신성",
            description: "효율성을 추구하고 변화를 주도하는 마인드"
        },
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25a2.25 2.25 0 002.25 2.25h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25v.75A2.25 2.25 0 0118 13.5h-1.5a2.25 2.25 0 01-2.25-2.25v-.75A2.25 2.25 0 0116.5 8.25z" /></svg>,
            title: "업무의 이해도 및 상황대응력",
            description: "복잡한 상황을 파악하고 신속하게 대응"
        },
    ];

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-700 animate-scale-in">
        <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-2">
                AI 역량평가 모의고사
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
                서울교통공사 3급 승진 시험을 완벽 대비하세요. AI가 실제 시험과 유사한 10개의 상황판단문제를 생성하여 당신의 핵심 역량을 종합적으로 진단합니다.
            </p>
        </div>

        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700 mb-10">
            <h3 className="text-lg font-bold text-indigo-300 mb-4 text-center sm:text-left">평가 핵심 역량</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competencies.map(comp => <CompetencyCard key={comp.title} {...comp} />)}
            </div>
        </div>
      
        <div className="mt-6">
            <button
                onClick={onStartQuiz}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-xl shadow-lg hover:shadow-indigo-500/50 transform hover:scale-105"
            >
                {isLoading ? '역량평가 생성 중...' : '역량평가 시작하기'}
            </button>
        </div>
    </div>
  );
};

export default HomeScreen;