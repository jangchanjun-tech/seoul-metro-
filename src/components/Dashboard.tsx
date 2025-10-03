import React, { useState, useEffect, useMemo } from 'react';
import { User, QuizResult, CompetencyAnalysis, AnalysisCache, QuizItem } from '../types';
import { getUserQuizResults, getAnalysisCache, saveAnalysisCache } from '../services/firebaseService';
import { generateCompetencyAnalysis } from '../services/geminiService';
import Loader from './Loader';
import { serverTimestamp } from 'firebase/firestore';

interface DashboardProps {
  user: User;
  onGoHome: () => void;
  onReviewResult: (result: QuizResult) => void;
}

const COMPETENCIES = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

// Helper to calculate score for a set of questions and answers
const calculateScore = (items: QuizItem[], answers: Record<string, string[]> | undefined): number => {
    if (!answers || items.length === 0) return 0;
    
    let totalPoints = 0;
    const maxPointsPerQuestion = 6;

    items.forEach((item) => {
        const userSelection = answers[item.id] || [];
        userSelection.forEach(answer => {
            if (item.bestAnswers.includes(answer)) totalPoints += 3;
            else if (item.secondBestAnswers.includes(answer)) totalPoints += 2;
            else if (item.worstAnswer === answer) totalPoints += 1;
        });
    });

    const maxTotalPoints = items.length * maxPointsPerQuestion;
    return maxTotalPoints === 0 ? 0 : Math.round((totalPoints / maxTotalPoints) * 100);
};

const ScoreTrendChart: React.FC<{ results: QuizResult[] }> = ({ results }) => {
    // Calculate cumulative average scores
    const sortedResults = [...results].reverse(); // Oldest to newest
    let cumulativeScore = 0;
    const chartData = sortedResults.map((result, index) => {
        cumulativeScore += result.score;
        return {
            id: result.id,
            score: Math.round(cumulativeScore / (index + 1)),
        };
    });

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            {chartData.length > 0 ? (
                <div className="flex justify-start items-end h-48 border-b-2 border-gray-600 pb-2 space-x-2">
                    {chartData.map((result, index) => (
                        <div key={result.id} className="flex-1 flex flex-col items-center justify-end h-full px-1 relative max-w-[60px]">
                            <span className="text-xs text-white mb-1">{result.score}</span>
                            <div 
                                className="w-full bg-indigo-500 rounded-t-md hover:bg-indigo-400 transition-colors duration-300" 
                                style={{ height: result.score + '%' }}
                                title={(index + 1) + '회차 누적 평균: ' + result.score + '점'}
                            >
                            </div>
                            <p className="text-xs text-gray-400 mt-2 whitespace-nowrap">{index + 1}회차</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                    2회 이상 응시하면 성적 추이 그래프가 표시됩니다.
                </div>
            )}
        </div>
    );
};

const Bar = ({ value, color, label }: { value: number; color: string; label: string; }) => (
    <div className="flex flex-col items-center w-[45%]">
        <div className="w-full h-20 bg-gray-700/50 rounded-t-md flex items-end relative">
            <div className={color + " w-full rounded-t-md transition-all duration-500 ease-out"} style={{ height: value + '%' }} title={label + ': ' + value + '점'}></div>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-sm font-semibold text-white">{value}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">{label}</p>
    </div>
);

const getPerformanceColorStyle = (score: number, min: number, max: number, hasAttempts: boolean): React.CSSProperties => {
    if (!hasAttempts || max === min) return {};
    const normalized = (score - min) / (max - min);
    // Hue: 0 is red (worst score), 220 is a nice blue (best score).
    const hue = normalized * 220; 
    return { 
        backgroundColor: 'hsla(' + hue + ', 60%, 20%, 0.4)',
        borderColor: 'hsla(' + hue + ', 60%, 40%, 0.5)'
    };
};

const getPerformanceTextStyle = (score: number, min: number, max: number, hasAttempts: boolean): React.CSSProperties => {
    if (!hasAttempts || max === min) return {};
    const normalized = (score - min) / (max - min);
    const hue = normalized * 220;
    return { color: 'hsl(' + hue + ', 70%, 65%)' };
};


const Dashboard: React.FC<DashboardProps> = ({ user, onGoHome, onReviewResult }) => {
  const [userResults, setUserResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompetencyAnalysis | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userRes = await getUserQuizResults(user.uid);
        setUserResults(userRes);
        setLoading(false);

        // --- AI Analysis with Stale-While-Revalidate Strategy ---
        if (userRes.length === 0) {
            setIsAnalysisLoading(false);
            return; // No results, nothing to analyze
        }

        const latestResultId = userRes[0].id;
        const cache = await getAnalysisCache(user.uid);

        // Step 1: Immediately display cached data if it exists.
        if (cache) {
            setAnalysis(cache.analysis);
            setIsAnalysisLoading(false); // Instantly hide loader if showing stale data
        } else {
            setIsAnalysisLoading(true); // No cache, so we must wait for the first analysis
        }

        // Step 2: Check if cache is stale and regenerate in the background.
        if (!cache || cache.basedOnResultId !== latestResultId) {
            console.log("AI 분석 캐시가 없거나 오래되었습니다. 백그라운드에서 새로 생성합니다.");
            try {
                const aiAnalysis = await generateCompetencyAnalysis(userRes);
                // Update UI with the new analysis and save it to the cache
                setAnalysis(aiAnalysis);
                const newCache: AnalysisCache = {
                    analysis: aiAnalysis,
                    basedOnResultId: latestResultId,
                    generatedAt: serverTimestamp() as any,
                };
                await saveAnalysisCache(user.uid, newCache);
            } catch (analysisError) {
                console.error("AI Analysis Error:", analysisError);
                if (!cache) { // Only show error if there was no stale data to show
                    const errorAnalysis = COMPETENCIES.reduce((acc, comp) => {
                        acc[comp as keyof CompetencyAnalysis] = "AI 분석 중 오류가 발생했습니다.";
                        return acc;
                    }, {} as CompetencyAnalysis);
                    setAnalysis(errorAnalysis);
                }
            } finally {
                // Hide the loader regardless of the outcome
                setIsAnalysisLoading(false);
            }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
        setIsAnalysisLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const { performanceIndex, minAverage, maxAverage } = useMemo(() => {
    const perfData = COMPETENCIES.map(competency => {
        const latestResult = userResults[0];
        let latestScore = 0;
        if (latestResult && latestResult.userAnswers) {
            const latestItems = latestResult.quizData.filter(q => q.competency === competency);
            latestScore = calculateScore(latestItems, latestResult.userAnswers);
        }
        
        let totalUserScore = 0;
        let competencyAttempts = 0;
        userResults.forEach(result => {
            if (result.userAnswers) {
                const itemsForCompetency = result.quizData.filter(q => q.competency === competency);
                if (itemsForCompetency.length > 0) {
                    totalUserScore += calculateScore(itemsForCompetency, result.userAnswers);
                    competencyAttempts++;
                }
            }
        });
        const userAverage = competencyAttempts > 0 ? totalUserScore / competencyAttempts : 0;

        return {
            name: competency,
            latest: Math.round(latestScore),
            userAverage: Math.round(userAverage),
            hasAttempts: competencyAttempts > 0,
        };
    });

    const scoresWithAttempts = perfData
        .filter(p => p.hasAttempts)
        .map(p => p.userAverage);

    if (scoresWithAttempts.length < 2) {
      return { performanceIndex: perfData, minAverage: 0, maxAverage: 0 };
    }

    const minAvg = Math.min(...scoresWithAttempts);
    const maxAvg = Math.max(...scoresWithAttempts);

    return { performanceIndex: perfData, minAverage: minAvg, maxAverage: maxAvg };
  }, [userResults]);
  
  const finalCumulativeAverage = useMemo(() => {
    if (userResults.length === 0) return 0;
    const totalScore = userResults.reduce((acc, result) => acc + result.score, 0);
    return Math.round(totalScore / userResults.length);
  }, [userResults]);
  
  const latestScore = useMemo(() => {
    return userResults.length > 0 ? userResults[0].score : 0;
  }, [userResults]);


  if (loading) {
    return <div className="text-center py-10"><Loader message="성과 분석 데이터를 불러오는 중입니다..." /></div>;
  }

  if (error) {
    return <div className="text-center text-red-400">{error}</div>;
  }
  
  if (userResults.length === 0) {
      return (
          <div className="text-center bg-gray-800/50 p-8 rounded-lg">
              <h2 className="text-2xl font-bold text-indigo-300">데이터가 없습니다</h2>
              <p className="text-gray-400 mt-2 mb-4">역량평가를 한 번 이상 완료해야 대시보드가 표시됩니다.</p>
              <button onClick={onGoHome} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                  역량평가 하러 가기
              </button>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-center text-indigo-300">마이페이지: 성과 분석 리포트</h1>
      
      {/* --- 성적 추이 분석 --- */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <div className="flex justify-between items-baseline mb-4">
            <h2 className="text-xl font-semibold text-white">성적추이분석(회차별누계평균)</h2>
            {userResults.length > 0 && (
                <div className="text-sm text-gray-400 flex items-baseline gap-4">
                    <div>
                        <span className="font-semibold">최근 점수: </span>
                        <span className="font-bold text-white text-lg">{latestScore}점</span>
                    </div>
                    <div className="border-l border-gray-600 h-5"></div>
                    <div>
                        <span className="font-semibold">현재 누적 평균: </span>
                        <span className="font-bold text-indigo-400 text-lg">{finalCumulativeAverage}점</span>
                    </div>
                </div>
            )}
        </div>
        <ScoreTrendChart results={userResults} />
      </div>

      {/* --- 응시 기록 (새로운 섹션) --- */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">응시 기록</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {userResults.map((result) => (
                <div 
                    key={result.id}
                    onClick={() => onReviewResult(result)}
                    className="bg-gray-900/50 hover:bg-gray-900/80 p-4 rounded-lg border border-gray-700 flex justify-between items-center cursor-pointer transition-all"
                >
                    <div>
                        <p className="font-semibold text-white">{result.topic}</p>
                        <p className="text-sm text-gray-400">
                            {result.createdAt ? new Date(result.createdAt.toMillis()).toLocaleString() : '날짜 정보 없음'}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-indigo-400">{result.score}점</p>
                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">다시보기</span>
                    </div>
                </div>
            ))}
        </div>
      </div>


      {/* --- 과목별 성과 지수 --- */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">과목별 성과지수</h2>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {performanceIndex.map(stat => (
                <div 
                  key={stat.name} 
                  className={`p-2 rounded-lg border transition-all duration-500 ${!stat.hasAttempts || minAverage === maxAverage ? 'bg-gray-900/50 border-gray-700/50' : ''}`}
                  style={getPerformanceColorStyle(stat.userAverage, minAverage, maxAverage, stat.hasAttempts)}
                >
                    <h3 
                        className={`font-semibold text-center mb-2 text-sm h-12 flex items-center justify-center ${!stat.hasAttempts || minAverage === maxAverage ? 'text-indigo-300' : ''}`}
                        style={getPerformanceTextStyle(stat.userAverage, minAverage, maxAverage, stat.hasAttempts)}
                    >
                        {stat.name}
                    </h3>
                    <div className="flex justify-around items-end h-24 space-x-1">
                        <Bar value={stat.latest} color="bg-green-500" label="최근 점수" />
                        <Bar value={stat.userAverage} color="bg-blue-500" label="나의 평균" />
                    </div>
                </div>
            ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">* 점수는 100점 만점으로 환산된 값입니다. 데이터는 업데이트 이후 응시한 시험부터 반영됩니다.</p>
      </div>

      {/* --- AI 역량 심층 분석 --- */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">AI 역량 심층 분석</h2>
        {isAnalysisLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
                 <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>AI가 성과를 분석하고 있습니다...</span>
            </div>
        ) : analysis ? (
             <div className="space-y-4">
                {COMPETENCIES.map(competency => {
                    const stat = performanceIndex.find(p => p.name === competency);
                    const userAverage = stat ? stat.userAverage : 0;
                    const hasAttempts = stat ? stat.hasAttempts : false;
                    return (
                        <div 
                            key={competency} 
                            className={`p-4 rounded-lg border transition-all duration-500 ${!hasAttempts || minAverage === maxAverage ? 'bg-gray-900/50 border-gray-700/50' : ''}`}
                            style={getPerformanceColorStyle(userAverage, minAverage, maxAverage, hasAttempts)}
                        >
                            <h3 
                                className={`font-semibold mb-2 ${!hasAttempts || minAverage === maxAverage ? 'text-indigo-300' : ''}`}
                                style={getPerformanceTextStyle(userAverage, minAverage, maxAverage, hasAttempts)}
                            >
                                {competency}
                            </h3>
                            <p className="text-sm text-gray-300 leading-relaxed">{analysis[competency as keyof CompetencyAnalysis]}</p>
                        </div>
                    );
                })}
            </div>
        ) : <p className="text-gray-500 text-center">분석 데이터를 생성할 수 없습니다.</p>}
      </div>

       <div className="text-center mt-8">
            <button onClick={onGoHome} className="bg-indigo-600 text-white font-bold py-2 px-8 rounded-lg hover:bg-indigo-700 transition-all">
                홈으로
            </button>
        </div>
    </div>
  );
};

export default Dashboard;
