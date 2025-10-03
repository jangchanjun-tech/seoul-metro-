import React, { useState, useEffect, useMemo } from 'react';
import { User, QuizResult, CompetencyAnalysis, SystemStats } from '../types';
import { getUserQuizResults, getAllQuizResults } from '../services/firebaseService';
import { generateCompetencyAnalysis } from '../services/geminiService';
import Loader from './Loader';

interface DashboardProps {
    user: User;
    onReview: (result: QuizResult) => void;
    onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onReview, onBack }) => {
    const [results, setResults] = useState<QuizResult[]>([]);
    const [analysis, setAnalysis] = useState<CompetencyAnalysis | null>(null);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                setError("사용자 정보를 찾을 수 없습니다.");
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                
                // Fetch user results and all results in parallel
                const [userResults, allResults] = await Promise.all([
                    getUserQuizResults(user.uid),
                    getAllQuizResults()
                ]);

                setResults(userResults);

                // Calculate system stats
                if (allResults.length > 0) {
                    const totalParticipants = new Set(allResults.map(r => r.userId)).size;
                    const averageScore = allResults.reduce((acc, r) => acc + r.score, 0) / allResults.length;
                    
                    if (userResults.length > 0) {
                        const latestUserScore = userResults[0].score;
                        const scores = allResults.map(r => r.score);
                        const belowCount = scores.filter(s => s < latestUserScore).length;
                        const percentile = Math.round((belowCount / scores.length) * 100);
                        setStats({ totalParticipants, averageScore, percentile });
                    } else {
                        setStats({ totalParticipants, averageScore });
                    }
                }
                
                if (userResults.length > 0) {
                    // Generate AI analysis only if there are results
                    const competencyAnalysis = await generateCompetencyAnalysis(userResults);
                    setAnalysis(competencyAnalysis);
                }
            } catch (err: any) {
                setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const overallCompetencyScores = useMemo(() => {
        const aggregated = {
            '지휘감독능력': { correct: 0, total: 0 },
            '책임감 및 적극성': { correct: 0, total: 0 },
            '관리자로서의 자세 및 청렴도': { correct: 0, total: 0 },
            '경영의식 및 혁신성': { correct: 0, total: 0 },
            '업무의 이해도 및 상황대응력': { correct: 0, total: 0 },
        };

        results.forEach(result => {
            for (const key in result.competencyScores) {
                if (aggregated.hasOwnProperty(key)) {
                    aggregated[key as keyof typeof aggregated].correct += result.competencyScores[key].correct;
                    aggregated[key as keyof typeof aggregated].total += result.competencyScores[key].total;
                }
            }
        });

        return Object.entries(aggregated).map(([name, scores]) => ({
            name,
            score: scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0,
        }));
    }, [results]);

    if (isLoading) {
        return <Loader message="나의 성과분석 데이터를 불러오는 중입니다..." />;
    }

    if (error) {
        return <p className="text-red-400 text-center p-4 bg-red-900/50 rounded-lg">{error}</p>;
    }

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-indigo-300">나의 성과분석</h1>
                <button onClick={onBack} className="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-all">홈으로</button>
            </div>

            {results.length === 0 ? (
                <div className="text-center bg-gray-800/50 p-8 rounded-lg">
                    <p className="text-xl text-gray-300">아직 응시 기록이 없습니다.</p>
                    <p className="text-gray-400 mt-2">역량평가를 시작하여 당신의 성과를 분석해보세요!</p>
                </div>
            ) : (
                <>
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <p className="text-sm text-gray-400">최근 점수</p>
                            <p className="text-2xl font-bold text-white">{results[0].score}</p>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <p className="text-sm text-gray-400">평균 점수 (전체)</p>
                            <p className="text-2xl font-bold text-white">{stats?.averageScore.toFixed(1) ?? 'N/A'}</p>
                        </div>
                         <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <p className="text-sm text-gray-400">상위 백분위 (최근 점수 기준)</p>
                            <p className="text-2xl font-bold text-white">{stats?.percentile !== undefined ? `${stats.percentile}%` : 'N/A'}</p>
                        </div>
                    </div>

                    {/* AI Competency Analysis */}
                    {analysis && (
                        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                            <h2 className="text-xl font-bold text-indigo-300 mb-4">AI 역량 분석 리포트</h2>
                            <div className="space-y-4">
                                {Object.entries(analysis).map(([competency, text]) => (
                                    <div key={competency}>
                                        <h3 className="font-semibold text-white">{competency}</h3>
                                        <p className="text-gray-300 text-sm">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Competency Scores Bar Chart */}
                    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                        <h2 className="text-xl font-bold text-indigo-300 mb-4">역량별 누적 정답률</h2>
                         <div className="space-y-4">
                            {overallCompetencyScores.map(comp => (
                                <div key={comp.name}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="text-gray-300">{comp.name}</span>
                                        <span className="font-semibold text-white">{comp.score}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${comp.score}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* Quiz History */}
                    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                        <h2 className="text-xl font-bold text-indigo-300 mb-4">응시 기록</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">응시일</th>
                                        <th scope="col" className="px-4 py-3">점수</th>
                                        <th scope="col" className="px-4 py-3">소요 시간</th>
                                        <th scope="col" className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(result => (
                                        <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                            <td className="px-4 py-3">{new Date(result.submittedAt).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-medium">{result.score} / 100</td>
                                            <td className="px-4 py-3">{`${Math.floor(result.elapsedTime / 60)}분 ${result.elapsedTime % 60}초`}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => onReview(result)} className="font-medium text-indigo-400 hover:underline">결과 보기</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;