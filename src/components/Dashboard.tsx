import React, { useState, useEffect, useMemo } from 'react';
import { User, QuizResult, CompetencyAnalysis } from '../types';
import { getUserQuizResults, getAllQuizResults } from '../services/firebaseService';
import { generateCompetencyAnalysis } from '../services/geminiService';
import Loader from './Loader';

interface DashboardProps {
  user: User;
  onGoHome: () => void;
}

const COMPETENCIES = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

// Helper to calculate score for a set of questions and answers
const calculateScore = (items: any[], answers: Record<number, string[]> | undefined): number => {
    if (!answers || items.length === 0) return 0;
    
    let totalPoints = 0;
    const maxPointsPerQuestion = 6;

    items.forEach((item, index) => {
        const userSelection = answers[index] || [];
        userSelection.forEach(answer => {
            if (item.bestAnswers.includes(answer)) totalPoints += 3;
            else if (item.secondBestAnswers.includes(answer)) totalPoints += 2;
            else if (item.worstAnswer === answer) totalPoints += 1;
        });
    });

    const maxTotalPoints = items.length * maxPointsPerQuestion;
    return maxTotalPoints === 0 ? 0 : Math.round((totalPoints / maxTotalPoints) * 100);
};


const Dashboard: React.FC<DashboardProps> = ({ user, onGoHome }) => {
  const [userResults, setUserResults] = useState<QuizResult[]>([]);
  const [allResults, setAllResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompetencyAnalysis | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [userRes, allRes] = await Promise.all([
          getUserQuizResults(user.uid),
          getAllQuizResults(),
        ]);
        setUserResults(userRes);
        setAllResults(allRes);

        if (userRes.length > 0) {
            setIsAnalysisLoading(true);
            try {
                const aiAnalysis = await generateCompetencyAnalysis(userRes);
                setAnalysis(aiAnalysis);
            } catch (analysisError) {
                console.error("AI Analysis Error:", analysisError);
                // Set a default error message for analysis part
                const errorAnalysis = COMPETENCIES.reduce((acc, comp) => {
                    acc[comp as keyof CompetencyAnalysis] = "AI 분석 중 오류가 발생했습니다.";
                    return acc;
                }, {} as CompetencyAnalysis);
                setAnalysis(errorAnalysis);
            } finally {
                setIsAnalysisLoading(false);
            }
        } else {
             setIsAnalysisLoading(false);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const performanceIndex = useMemo(() => {
    return COMPETENCIES.map(competency => {
        // 1. Latest Score
        const latestResult = userResults[0];
        const latestItems = latestResult?.quizData.filter(q => q.competency === competency) || [];
        const latestScore = latestResult?.userAnswers ? calculateScore(latestItems, latestResult.userAnswers) : 0;
        
        // 2. User's Average Score
        const userScoresForCompetency: number[] = [];
        userResults.forEach(res => {
            if(res.userAnswers){
                const items = res.quizData.filter(q => q.competency === competency);
                userScoresForCompetency.push(calculateScore(items, res.userAnswers));
            }
        });
        const userAverage = userScoresForCompetency.length ? userScoresForCompetency.reduce((a, b) => a + b, 0) / userScoresForCompetency.length : 0;

        // 3. All Users' Average Score
        const allScoresForCompetency: number[] = [];
        allResults.forEach(res => {
             if(res.userAnswers){
                const items = res.quizData.filter(q => q.competency === competency);
                allScoresForCompetency.push(calculateScore(items, res.userAnswers));
            }
        });
        const overallAverage = allScoresForCompetency.length ? allScoresForCompetency.reduce((a, b) => a + b, 0) / allScoresForCompetency.length : 0;

        return {
            name: competency,
            latest: Math.round(latestScore),
            userAverage: Math.round(userAverage),
            overallAverage: Math.round(overallAverage)
        };
    });
  }, [userResults, allResults]);


  if (loading) {
    return <div className="text-center py-10"><Loader /></div>;
  }

  if (error) {
    return <div className="text-center text-red-400">{error}</div>;
  }
  
  if (userResults.length === 0) {
      return (
          <div className="text-center bg-gray-800/50 p-8 rounded-lg">
              <h2 className="text-2xl font-bold text-indigo-300">데이터가 없습니다</h2>
              <p className="text-gray-400 mt-2 mb-4">모의고사를 한 번 이상 완료해야 대시보드가 표시됩니다.</p>
              <button onClick={onGoHome} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                  모의고사 풀러 가기
              </button>
          </div>
      );
  }

  const Bar = ({ value, color, label }: { value: number; color: string; label: string; }) => (
    <div className="flex flex-col items-center w-1/3">
        <div className="w-full h-40 bg-gray-700/50 rounded-t-md flex items-end">
            <div className={`${color} w-full rounded-t-md`} style={{ height: `${value}%` }} title={`${label}: ${value}점`}></div>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">{label}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-center text-indigo-300">마이페이지: 성과 분석 리포트</h1>
      
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">과목별 성과지수</h2>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {performanceIndex.map(stat => (
                <div key={stat.name} className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-center text-indigo-300 mb-3">{stat.name}</h3>
                    <div className="flex justify-around items-end h-40 space-x-2">
                        <Bar value={stat.latest} color="bg-green-500" label="최근 점수" />
                        <Bar value={stat.userAverage} color="bg-indigo-500" label="나의 평균" />
                        <Bar value={stat.overallAverage} color="bg-purple-500" label="전체 평균" />
                    </div>
                </div>
            ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">* 점수는 100점 만점으로 환산된 값입니다. 데이터는 업데이트 이후 응시한 시험부터 반영됩니다.</p>
      </div>

      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">AI 역량 심층 분석</h2>
        {isAnalysisLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
                 <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>AI가 응시 기록을 바탕으로 종합 리포트를 생성하고 있습니다...</span>
            </div>
        ) : analysis ? (
             <div className="space-y-4">
                {COMPETENCIES.map(competency => (
                    <div key={competency} className="bg-gray-900/50 p-4 rounded-lg">
                        <h3 className="font-semibold text-indigo-300 mb-2">{competency}</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">{analysis[competency as keyof CompetencyAnalysis]}</p>
                    </div>
                ))}
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