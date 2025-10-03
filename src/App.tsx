import React, { useState, useCallback, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getAIVerification, shuffleArray, generateSingleQuiz } from './services/geminiService';
import { 
  saveQuizResult, 
  getSeenQuestionIds, 
  fetchBankQuestions, 
  saveNewQuestions, 
  updateSeenQuestions,
  getSystemStats,
  saveSingleQuestionToBank
} from './services/firebaseService';
import { QuizItem, User, SystemStats } from './types';
import Loader from './components/Loader';
import QuizCard from './components/QuizCard';
import Auth from './components/Auth';
import GuideModal from './components/GuideModal';
import HomeScreen from './components/HomeScreen';
import Dashboard from './components/Dashboard';
import { auth } from './firebase/config';

type AppState = 'home' | 'quiz' | 'dashboard' | 'admin';
const COMPETENCIES: (keyof Omit<SystemStats, 'total'>)[] = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

const AdminPanel: React.FC<{onGoHome: () => void}> = ({onGoHome}) => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const isGeneratingRef = useRef(isGenerating);

    useEffect(() => {
        isGeneratingRef.current = isGenerating;
    }, [isGenerating]);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 100));
    };

    const fetchStats = useCallback(async () => {
        const currentStats = await getSystemStats();
        setStats(currentStats);
        return currentStats;
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const startGeneration = async () => {
        addLog("문제 생성을 시작합니다...");
        setIsGenerating(true);

        const generationLoop = async () => {
            if (!isGeneratingRef.current) {
                addLog("문제 생성을 중단했습니다.");
                return;
            }

            let currentStats = await fetchStats();
            if (currentStats.total >= 5000) {
                addLog("목표 5,000개에 도달하여 생성을 자동 중단합니다.");
                setIsGenerating(false);
                return;
            }

            // Find competency with the least questions
            const competencyCounts = Object.entries(currentStats)
                .filter(([key]) => key !== 'total')
                .sort(([, a], [, b]) => a - b);
            
            const targetCompetency = competencyCounts[0][0] as keyof Omit<SystemStats, 'total'>;
            
            if (currentStats[targetCompetency] >= 1000) {
                 addLog(`'${targetCompetency}' 역량은 1,000개를 달성했습니다. 다음 역량으로 넘어갑니다.`);
            } else {
                try {
                    addLog(`'${targetCompetency}' 역량 문제 생성 시도...`);
                    const newQuestion = await generateSingleQuiz(targetCompetency);
                    await saveSingleQuestionToBank(newQuestion);
                    addLog(`성공: '${targetCompetency}' 문제 1개가 문제 은행에 저장되었습니다.`);
                } catch (error) {
                    addLog(`오류: 문제 생성 실패. ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
                }
            }

            setTimeout(generationLoop, 3000); // Wait 3 seconds to avoid rate limiting
        };

        generationLoop();
    };

    const stopGeneration = () => {
        setIsGenerating(false);
    };

    return (
        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 animate-fade-in">
            <h1 className="text-2xl font-bold text-center text-indigo-300 mb-6">관리자 패널: 문제 은행 생성기</h1>
            
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">현재 문제 수</h2>
                {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-800 p-3 rounded"><p className="text-gray-400">총 문제</p><p className="text-xl font-bold text-indigo-400">{stats.total} / 5000</p></div>
                        {COMPETENCIES.map(c => (
                            <div key={c} className="bg-gray-800 p-3 rounded"><p className="text-gray-400 text-sm">{c}</p><p className="text-xl font-bold">{stats[c]} / 1000</p></div>
                        ))}
                    </div>
                ) : <p>통계 로딩 중...</p>}
            </div>

            <div className="text-center mb-6">
                {!isGenerating ? (
                    <button onClick={startGeneration} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-all text-lg">문제 생성 시작</button>
                ) : (
                    <button onClick={stopGeneration} className="bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-all text-lg">문제 생성 중지</button>
                )}
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg h-64 overflow-y-auto">
                <h3 className="font-semibold text-white mb-2">생성 로그</h3>
                <div className="text-sm text-gray-400 space-y-1">
                    {logs.map((log, i) => <p key={i}>{log}</p>)}
                </div>
            </div>
             <div className="text-center mt-8">
                <button onClick={onGoHome} className="bg-indigo-600 text-white font-bold py-2 px-8 rounded-lg hover:bg-indigo-700 transition-all">
                    홈으로
                </button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string[]>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [appState, setAppState] = useState<AppState>('home');
  const [verificationResults, setVerificationResults] = useState<Record<number, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser ? { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email, photoURL: currentUser.photoURL } : null);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    const handleContextmenu = (e: MouseEvent) => e.preventDefault();
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'p', 's'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'PrintScreen') e.preventDefault();
    };

    if (appState === 'quiz') {
      document.body.style.userSelect = 'none';
      document.addEventListener('contextmenu', handleContextmenu);
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      document.body.style.userSelect = 'auto';
      document.removeEventListener('contextmenu', handleContextmenu);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [appState]);

  const handleStartQuiz = useCallback(async () => {
    if (!auth.currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    setQuizData([]);
    setUserAnswers({});
    setShowResults(false);
    setVerificationResults({});
    setIsVerifying(false);
    setAppState('quiz');

    try {
        const userId = auth.currentUser.uid;
        const BANK_QUESTION_COUNT = 5;
        const REALTIME_QUESTION_COUNT = 5;

        // 1. Get user's seen question IDs
        const seenIds = await getSeenQuestionIds(userId);

        // 2. Fetch 5 questions from the bank
        const bankQuestions = await fetchBankQuestions(COMPETENCIES, BANK_QUESTION_COUNT, seenIds);

        // 3. Generate 5 real-time questions
        const realtimeGenerationPromises = Array.from({ length: REALTIME_QUESTION_COUNT }, (_, i) => {
            const competency = COMPETENCIES[i % COMPETENCIES.length];
            return generateSingleQuiz(competency);
        });
        const newRawQuestions = await Promise.all(realtimeGenerationPromises);
        
        // 4. Save new questions to the bank and get their IDs
        const newSavedQuestions = await saveNewQuestions(newRawQuestions);

        // 5. Combine and start quiz
        const finalQuizSet = [...bankQuestions, ...newSavedQuestions];
        const shuffledQuizSet = finalQuizSet.map(q => ({...q, options: shuffleArray(q.options)}));

        setQuizData(shuffledQuizSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggleAnswer = (questionIndex: number, answer: string) => {
    setUserAnswers(prev => {
      const currentAnswers = prev[questionIndex] || [];
      const newAnswers = currentAnswers.includes(answer) ? currentAnswers.filter(a => a !== answer) : [...currentAnswers, answer];
      if (newAnswers.length > 2) return prev;
      return { ...prev, [questionIndex]: newAnswers };
    });
  };

  const calculateScore = useCallback(() => {
    let totalPoints = 0;
    const maxPointsPerQuestion = 6;
    quizData.forEach((item, index) => {
        const userSelection = userAnswers[index] || [];
        userSelection.forEach(answer => {
            if (item.bestAnswers.includes(answer)) totalPoints += 3;
            else if (item.secondBestAnswers.includes(answer)) totalPoints += 2;
            else if (item.worstAnswer === answer) totalPoints += 1;
        });
    });
    const maxTotalPoints = quizData.length * maxPointsPerQuestion;
    return maxTotalPoints === 0 ? 0 : Math.round((totalPoints / maxTotalPoints) * 100);
  }, [quizData, userAnswers]);

  const handleShowResults = async () => {
    setShowResults(true);
    if (mainRef.current) mainRef.current.scrollIntoView({ behavior: 'smooth' });

    const finalScore = calculateScore();
    if (user && quizData.length > 0) {
      await saveQuizResult(user, "AI 하이브리드 모의고사", quizData, finalScore);
      const questionIdsToUpdate = quizData.map(q => q.id).filter((id): id is string => !!id);
      await updateSeenQuestions(user.uid, questionIdsToUpdate);
    }

    if (quizData.length === 0) return;

    setIsVerifying(true);
    setVerificationResults({});
    try {
        const verificationPromises = quizData.map((item, index) =>
            getAIVerification(item).then(result => {
                setVerificationResults(prev => ({ ...prev, [index]: result }));
            })
        );
        await Promise.all(verificationPromises);
    } catch(e) {
        console.error("AI 검증 중 오류 발생:", e);
        const errorMessage = "AI 검증 중 오류가 발생했습니다.";
        setVerificationResults(quizData.reduce((acc, _, index) => ({...acc, [index]: errorMessage}), {}));
    } finally {
        setIsVerifying(false);
    }
  };
  
  const handleGoHome = () => {
      setAppState('home');
      setQuizData([]);
      setError(null);
  };
  
  const isQuizFinished = quizData.length > 0 && quizData.every((_, index) => (userAnswers[index] || []).length === 2);

  const renderContent = () => {
    if (appState === 'admin') {
      return <AdminPanel onGoHome={handleGoHome} />;
    }
    if (appState === 'dashboard') {
      return <Dashboard user={user!} onGoHome={handleGoHome} />;
    }
    if (appState === 'home') {
      return <HomeScreen onStartQuiz={handleStartQuiz} isLoading={isLoading} />;
    }
    if (isLoading) {
        return <Loader />;
    }
    if (error) {
      return (
        <div className="text-center">
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4">{error}</div>
          <button onClick={handleGoHome} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">홈으로 돌아가기</button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {quizData.map((item, index) => (
          <QuizCard
            key={item.id || index}
            quizItem={item}
            questionIndex={index}
            userAnswers={userAnswers[index] || []}
            showResults={showResults}
            onToggleAnswer={handleToggleAnswer}
            isVerifying={isVerifying}
            verificationResult={verificationResults[index]}
          />
        ))}
        {!showResults && isQuizFinished && (
            <button onClick={handleShowResults} className="w-full bg-green-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-700 transition-all text-xl animate-fade-in">
              결과 확인하기 {user && '(결과가 저장됩니다)'}
            </button>
        )}
        {showResults && (
          <div className="text-center bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-indigo-300">최종 결과</h2>
              <p className="text-4xl font-extrabold my-3">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">{calculateScore()}</span>
                  <span className="text-xl text-gray-400"> 점</span>
              </p>
              <button onClick={handleGoHome} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                홈으로 돌아가기
              </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900/60 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
            <div className="text-left cursor-pointer" onClick={() => user && appState === 'home' ? undefined : handleGoHome()}>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    서울교통공사 AI 모의고사
                </h1>
                <p className="text-md text-gray-300 hidden sm:block">
                    실전과 같은 10가지 상황판단문제로 역량을 진단하세요.
                </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                {user && appState === 'home' && (
                  <button onClick={() => setAppState('dashboard')} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">마이페이지</button>
                )}
                {user && appState === 'home' && (
                  <button onClick={() => setAppState('admin')} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">관리자</button>
                )}
                <button onClick={() => setIsGuideModalOpen(true)} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">이용안내</button>
                <Auth user={user} isModalOpen={isAuthModalOpen} onToggleModal={setIsAuthModalOpen} />
            </div>
        </header>

        <main ref={mainRef}>
          {renderContent()}
        </main>
      </div>
      {isGuideModalOpen && <GuideModal onClose={() => setIsGuideModalOpen(false)} />}
    </div>
  );
};

export default App;
