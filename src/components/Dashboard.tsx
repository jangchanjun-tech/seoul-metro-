import React, { useState, useEffect } from 'react';
import { User, QuizResult, SystemStats, CompetencyAnalysis } from '../types';
import { getUserQuizResults, getSystemStats } from '../services/firebaseService';
import { generateCompetencyAnalysis } from '../services/geminiService';
import Loader from './Loader';

interface DashboardProps {
  user: User;
  onReview: (result: QuizResult) => void;
  onBack: () => void;
}

const StatCard: React.FC<{ title: string; value: number | string; suffix?: string; description?: string }> = ({ title, value, suffix, description }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center">
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-4xl font-extrabold text-white mt-1">{value}<span className="text-xl font-normal text-gray-400">{suffix}</span></p>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ user, onReview, onBack }) => {
    const [results, setResults] = useState<QuizResult[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [analysis, setAnalysis] = useState<CompetencyAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [userResults, systemStats] = await Promise.all([
                    getUserQuizResults(user.uid),
                    getSystemStats(user.uid)
                ]);

                setResults(userResults);
                setStats(systemStats);

                if (userResults.length > 0) {
                    try {
                        const competencyAnalysis = await generateCompetencyAnalysis(userResults);
                        setAnalysis(competencyAnalysis);
                    } catch (aiError) {
                        console.error("AI Analysis Error:", aiError);
                        setError("AI 역량 분석 리포트를 생성하는 데 실패했습니다. 과거 데이터는 정상적으로 조회됩니다.");
                    }
                }

            } catch (err) {
                setError("데이터를 불러오는 중 오류가 발생했습니다.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (isLoading) {
        return <div className="min-h-[60vh] flex justify-center items-center"><Loader message="성과 분석 데이터를 불러오는 중입니다..." /></div>;
    }
    
    const userAverageScore = results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length) : 0;
    
    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-indigo-300">나의 성과분석</h1>
                    <p className="text-gray-400">{user?.displayName || user?.email}님의 역량평가 히스토리입니다.</p>
                </div>
                <button onClick={onBack} className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-all">홈으로</button>
            </header>

            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg text-center">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="나의 평균 점수" value={userAverageScore} suffix="/ 100" />
                <StatCard title="총 응시 횟수" value={results.length} suffix="회" />
                <StatCard title="상위 백분위" value={stats?.percentile ?? 'N/A'} suffix={stats?.percentile !== undefined ? '%' : ''} description="최근 점수 기준" />
            </div>

            {analysis && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-indigo-300 mb-4">AI 역량 분석 리포트</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {Object.entries(analysis).map(([competency, feedback]) => (
                            <div key={competency}>
                                <h3 className="font-semibold text-white">{competency}</h3>
                                <p className="text-sm text-gray-400">{feedback}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-indigo-300 mb-4">최근 응시 기록</h2>
                {results.length > 0 ? (
                    <div className="space-y-3">
                        {results.map(result => (
                             <div key={result.id} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-700 transition-colors">
                                <div>
                                    <p className="font-semibold text-white">응시일: {new Date(result.submittedAt).toLocaleString()}</p>
                                    <p className="text-sm text-gray-400">점수: {result.score} / 100 ({result.totalCorrect}/{result.totalQuestions} 정답)</p>
                                </div>
                                <button onClick={() => onReview(result)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all text-sm">결과 다시보기</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">아직 응시 기록이 없습니다.</p>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
