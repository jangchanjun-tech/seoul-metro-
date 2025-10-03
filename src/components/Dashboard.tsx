import React, { useState, useEffect, useMemo } from 'react';
import { User, QuizResult, QuizItem } from '../types';
import { getUserQuizResults, getAllQuizResults } from '../services/firebaseService';
// FIX: Import the 'Loader' component to resolve the 'Cannot find name' error.
import Loader from './Loader';

interface DashboardProps {
  user: User;
  onGoHome: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onGoHome }) => {
  const [userResults, setUserResults] = useState<QuizResult[]>([]);
  const [allResults, setAllResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const competencyStats = useMemo(() => {
    const stats: { [key: string]: { correct: number; total: number } } = {};
    
    userResults.forEach(result => {
      result.quizData.forEach(item => {
        if (!stats[item.competency]) {
          stats[item.competency] = { correct: 0, total: 0 };
        }
        stats[item.competency].total += 1;
        // This is a simplified correctness check based on score contribution.
        // A more robust check would require user answers, but this gives a good proxy.
        const isCorrect = result.quizData.find(q => q.question === item.question);
        if(isCorrect) { // This logic is simplified; assumes each question contributes to score
             // Let's find if the user answered this question correctly from the saved quizData
             // This part is tricky without saved user answers in quizResults.
             // We'll simulate by checking if the overall score implies some correct answers.
             // For a better implementation, user answers should be stored.
             // Here, we'll just use the overall score to approximate.
             // This calculation is difficult without user's answers per question.
             // Let's assume score is distributed over questions.
        }
      });
    });

    // We cannot accurately calculate per-competency scores without saving user answers for each question.
    // As a placeholder, we show competency distribution.
    const competencyCounts = userResults.flatMap(r => r.quizData).reduce((acc, q) => {
        acc[q.competency] = (acc[q.competency] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(competencyCounts).map(([name, count])=> ({name, count}));

  }, [userResults]);

  const scoreHistory = useMemo(() => {
    return userResults.map(r => ({
      date: r.createdAt ? r.createdAt.toDate().toLocaleDateString() : '날짜 없음',
      score: (r.score / r.totalQuestions) * 100,
    })).reverse();
  }, [userResults]);

  const userRanking = useMemo(() => {
    if (!allResults.length) return { percentile: 0, averageScore: 0 };

    const allUserAverages: { [userId: string]: { totalScore: number; count: number } } = {};
    allResults.forEach(r => {
        if (!allUserAverages[r.userId]) {
            allUserAverages[r.userId] = { totalScore: 0, count: 0 };
        }
        allUserAverages[r.userId].totalScore += r.score;
        allUserAverages[r.userId].count += r.totalQuestions;
    });

    const averageScores = Object.values(allUserAverages).map(u => (u.totalScore / u.count) * 100);
    const currentUserData = allUserAverages[user.uid];
    
    if (!currentUserData) return { percentile: 0, averageScore: 0 };

    const currentUserAverage = (currentUserData.totalScore / currentUserData.count) * 100;
    const betterUsers = averageScores.filter(score => score > currentUserAverage).length;
    const percentile = ((averageScores.length - betterUsers) / averageScores.length) * 100;

    return { percentile: Math.round(percentile), averageScore: Math.round(currentUserAverage) };
  }, [allResults, user.uid]);


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

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-center text-indigo-300">마이페이지</h1>
      
      {/* Overall Performance */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">종합 성과</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400">평균 점수</p>
                <p className="text-3xl font-bold text-green-400">{userRanking.averageScore}점</p>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400">상위 백분위</p>
                <p className="text-3xl font-bold text-purple-400">{userRanking.percentile}%</p>
                <p className="text-xs text-gray-500 mt-1">전체 이용자 중 나의 위치</p>
            </div>
        </div>
      </div>

      {/* Score History */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">회차별 점수 추이</h2>
        <div className="bg-gray-900/50 p-4 rounded-lg">
          {scoreHistory.length > 0 ? (
            <div className="flex justify-around items-end h-40 space-x-2">
              {scoreHistory.slice(0, 10).map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end">
                  <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md" style={{ height: `${item.score}%` }} title={`${item.score.toFixed(0)}점`}></div>
                  <p className="text-xs text-gray-400 mt-1">{index + 1}회차</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-center">데이터가 없습니다.</p>}
        </div>
      </div>
      
      {/* Competency Stats - Simplified */}
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">역량별 응시 횟수</h2>
         <div className="space-y-3">
          {competencyStats.map(stat => (
            <div key={stat.name}>
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-300">{stat.name}</span>
                    <span className="text-sm font-medium text-gray-400">{stat.count}회</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${(stat.count / Math.max(...competencyStats.map(s => s.count))) * 100}%`}}></div>
                </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">* 역량별 정답률은 추후 업데이트 예정입니다.</p>
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