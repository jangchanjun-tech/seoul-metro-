import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { generateQuiz } from './services/geminiService';
import { saveQuizResult } from './services/firebaseService';
import { QuizItem, User } from './types';
import Loader from './components/Loader';
import QuizCard from './components/QuizCard';
import Auth from './components/Auth';
import GuideModal from './components/GuideModal';
import { auth, isFirebaseConfigured } from './firebase/config';

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [quizData, setQuizData] = useState<QuizItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string[]>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser({
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    photoURL: currentUser.photoURL,
                });
            } else {
                setUser(null);
            }
        });
        return () => unsubscribe();
    }
  }, []);

  const handleGenerateQuiz = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setQuizData(null);
    setUserAnswers({});
    setShowResults(false);

    try {
      const data = await generateQuiz(topic);
      setQuizData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [topic, isLoading]);

  const handleToggleAnswer = (questionIndex: number, answer: string) => {
    setUserAnswers(prev => {
      const currentAnswers = prev[questionIndex] || [];
      const newAnswers = currentAnswers.includes(answer)
        ? currentAnswers.filter(a => a !== answer)
        : [...currentAnswers, answer];

      if (newAnswers.length > 2) {
        return prev; // 2개 초과 선택 방지
      }
      
      return { ...prev, [questionIndex]: newAnswers };
    });
  };

  const calculateScore = useCallback(() => {
    if (!quizData) return 0;
    return quizData.reduce((score, item, index) => {
        const userSelection = userAnswers[index] || [];
        const correctAnswers = item.bestAnswers;
        
        const isCorrect = userSelection.length === correctAnswers.length && 
                          [...userSelection].sort().join(',') === [...correctAnswers].sort().join(',');

        return isCorrect ? score + 1 : score;
    }, 0);
  }, [quizData, userAnswers]);

  const handleShowResults = () => {
    setShowResults(true);
    if (user && quizData) {
        const score = calculateScore();
        saveQuizResult(user.uid, topic, quizData, score);
    }
  };

  const isQuizFinished = quizData && quizData.every((_, index) => (userAnswers[index] || []).length === 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900/60 p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
            <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    AI 상황판단문제 생성기
                </h1>
                <p className="text-md text-gray-300 hidden sm:block">
                    복잡한 상황 속, 최적의 판단을 내리는 능력을 훈련해보세요.
                </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                <button
                    onClick={() => setIsGuideModalOpen(true)}
                    className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base"
                    aria-label="이용안내 보기"
                >
                    이용안내
                </button>
                {isFirebaseConfigured && <Auth user={user} />}
            </div>
        </header>

        <main>
          {!isFirebaseConfigured && (
              <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 p-4 rounded-lg text-center mb-8">
                  <strong>주의:</strong> Firebase 설정이 완료되지 않았습니다. 로그인 및 결과 저장 기능이 비활성화됩니다.
              </div>
          )}

          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-gray-700 mb-8">
            <form onSubmit={handleGenerateQuiz}>
              <label htmlFor="topic-input" className="block text-lg font-medium text-indigo-300 mb-2">문제 상황 주제</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  id="topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: '직장 내 갈등 상황', '긴급 재난 대처', '고객 불만 응대'"
                  className="flex-grow bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !topic.trim()}
                  className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? '생성 중...' : '문제 생성하기'}
                </button>
              </div>
            </form>
          </div>

          {isLoading && <Loader />}
          {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg text-center">{error}</div>}
          
          {quizData && (
            <div className="space-y-4">
              {quizData.map((item, index) => (
                <QuizCard
                  key={index}
                  quizItem={item}
                  questionIndex={index}
                  userAnswers={userAnswers[index] || []}
                  showResults={showResults}
                  onToggleAnswer={handleToggleAnswer}
                />
              ))}
              
              {!showResults && isQuizFinished && (
                  <button
                    onClick={handleShowResults}
                    className="w-full bg-green-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-700 transition-all duration-300 text-xl"
                  >
                    결과 확인하기 {user && '(결과가 저장됩니다)'}
                  </button>
              )}

              {showResults && (
                <div className="text-center bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-indigo-300">최종 결과</h2>
                    <p className="text-4xl font-extrabold my-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">{calculateScore()}</span>
                        <span className="text-xl text-gray-400"> / {quizData.length}</span>
                    </p>
                    <button
                      onClick={() => {
                        setQuizData(null);
                        setTopic('');
                      }}
                      className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-300"
                    >
                      새로운 문제 풀기
                    </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {isGuideModalOpen && <GuideModal onClose={() => setIsGuideModalOpen(false)} />}
    </div>
  );
};

export default App;