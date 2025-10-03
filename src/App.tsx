// src/App.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getAIVerification, shuffleArray, generateSingleQuiz } from './services/geminiService';
import { 
  saveQuizResult, 
  getSeenQuestionIds, 
  saveNewQuestions, 
  updateSeenQuestions,
  getSystemStats,
  saveSingleQuestionToBank,
  fetchInitialBankSet,
  getUserData,
  incrementUserGenerationCount,
} from './services/firebaseService';
import { QuizItem, User, SystemStats } from './types';
import Loader from './components/Loader';
import QuizCard from './components/QuizCard';
import Auth from './components/Auth';
import GuideModal from './components/GuideModal';
import HomeScreen from './components/HomeScreen';
import Dashboard from './components/Dashboard';
import QuizTimer from './components/QuizTimer'; // 타이머 컴포넌트 import
import { auth } from './firebase/config';

type AppState = 'home' | 'quiz' | 'dashboard' | 'admin';
const COMPETENCIES: (keyof Omit<SystemStats, 'total'>)[] = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

// 🚨 [중요] 보안 설정: 관리자 페이지에 접속할 사용자의 전체 Firebase UID를 여기에 입력하세요.
// Firebase 콘솔 > Authentication > Users 탭에서 '사용자 UID'를 복사하여 아래 배열의 값을 교체하세요.
// 예: const ADMIN_UIDS = ['Abc123xyz...'];
const ADMIN_UIDS = ['GoK2Ltn3G9Rt3JWh1uWZ3y739C93'];
const CONCURRENT_GENERATIONS = 5; // 병렬 생성 개수


const AdminPanel: React.FC<{onGoHome: () => void}> = ({onGoHome}) => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const generationWorkers = useRef<boolean[]>([]);

    const addLog = useCallback((message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 100));
    }, []);

    const fetchStats = useCallback(async () => {
        const currentStats = await getSystemStats();
        setStats(currentStats);
        return currentStats;
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // 5초마다 통계 자동 갱신
        return () => clearInterval(interval);
    }, [fetchStats]);

    const stopGeneration = useCallback(() => {
        addLog("모든 생성 프로세스 중단을 요청합니다...");
        setIsGenerating(false);
        generationWorkers.current = Array(CONCURRENT_GENERATIONS).fill(false);
    }, [addLog]);

    const startGeneration = useCallback(() => {
        addLog(`${CONCURRENT_GENERATIONS}개의 병렬 프로세스로 문제 생성을 시작합니다...`);
        setIsGenerating(true);
        generationWorkers.current = Array(CONCURRENT_GENERATIONS).fill(true);

        const generationLoop = async (workerId: number) => {
            if (!generationWorkers.current[workerId - 1]) {
                return;
            }

            const currentStats = await getSystemStats();
            if (currentStats.total >= 50000) {
                if(workerId === 1) addLog("목표 50,000개에 도달하여 생성을 자동 중단합니다.");
                stopGeneration();
                return;
            }
            
            const underfilledCompetencies = COMPETENCIES.filter(c => currentStats[c] < 10000);

            if (underfilledCompetencies.length === 0) {
                if(workerId === 1) addLog("모든 역량이 10,000개를 달성했습니다. 생성을 중단합니다.");
                stopGeneration();
                return;
            }
            
            const targetCompetency = underfilledCompetencies[Math.floor(Math.random() * underfilledCompetencies.length)];
            
            try {
                addLog(`[Worker ${workerId}] '${targetCompetency}' 역량 문제 생성 시도...`);
                const newQuestion = await generateSingleQuiz(targetCompetency);
                await saveSingleQuestionToBank(newQuestion);
                addLog(`[Worker ${workerId}] 성공: '${targetCompetency}' 문제 1개 저장 완료.`);
            } catch (error) {
                addLog(`[Worker ${workerId}] 오류: 생성 실패. ${error instanceof Error ? error.message.substring(0, 50) : '알 수 없는 오류'}`);
            }

            // Loop
            setTimeout(() => generationLoop(workerId), 1000 * Math.random() * workerId); 
        };

        for (let i = 1; i <= CONCURRENT_GENERATIONS; i++) {
            generationLoop(i);
        }
    }, [addLog, stopGeneration]);

    return (
        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 animate-fade-in">
            <h1 className="text-2xl font-bold text-center text-indigo-300 mb-6">관리자 패널: 문제 은행 생성기</h1>
            
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">현재 문제 수</h2>
                {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-800 p-3 rounded"><p className="text-gray-400">총 문제</p><p className="text-xl font-bold text-indigo-400">{stats.total} / 50000</p></div>
                        {COMPETENCIES.map(c => (
                            <div key={c} className="bg-gray-800 p-3 rounded"><p className="text-gray-400 text-sm">{c}</p><p className="text-xl font-bold">{stats[c]} / 10000</p></div>
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
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [appState, setAppState] = useState<AppState>('home');
  const [verificationResults, setVerificationResults] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // 타이머 상태 추가
  const mainRef = useRef<HTMLElement>(null);
  
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            const userData = await getUserData(currentUser.uid);
            setUser({ 
                uid: currentUser.uid, 
                displayName: currentUser.displayName, 
                email: currentUser.email, 
                photoURL: currentUser.photoURL,
                generationCount: userData.generationCount || 0
            });
        } else {
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    if (appState === 'quiz' && !isLoading && quizData.length > 0 && !showResults) {
      timerInterval = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [appState, isLoading, quizData.length, showResults]);
  
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
    
    // Increment generation count
    incrementUserGenerationCount(auth.currentUser.uid);
    setUser(prevUser => prevUser ? { ...prevUser, generationCount: (prevUser.generationCount || 0) + 1 } : null);

    // Reset all states
    setElapsedTime(0); // 타이머 초기화
    setIsLoading(true);
    setIsGeneratingMore(false);
    setError(null);
    setQuizData([]);
    setUserAnswers({});
    setShowResults(false);
    setVerificationResults({});
    setIsVerifying(false);
    setAppState('quiz');

    try {
        const userId = auth.currentUser.uid;
        const seenIds = await getSeenQuestionIds(userId);

        // --- Phase 1: Fetch from Bank (Fast Path) ---
        console.log("1단계: 문제 은행에서 5문제 즉시 로딩 시작...");
        const bankQuestions = await fetchInitialBankSet(COMPETENCIES.slice(0, 5), seenIds);
        setQuizData(bankQuestions.map(q => ({...q, options: shuffleArray(q.options)})));
        setIsLoading(false); 
        console.log(`1단계 완료: ${bankQuestions.length}개의 문제를 즉시 표시했습니다.`);

        // --- Phase 2: Generate from AI (Slow Path, in background) ---
        setIsGeneratingMore(true);
        console.log("2단계: AI로 나머지 5문제 백라운드 생성 시작...");

        const aiPromises = COMPETENCIES.slice(0, 5).map(competency => 
            generateSingleQuiz(competency)
        );
        const newQuestionsFromAI = await Promise.all(aiPromises);

        // Once all questions are generated, update the state in a single batch to avoid race conditions
        setQuizData(prevData => [
            ...prevData, 
            ...newQuestionsFromAI.map(q => ({...q, options: shuffleArray(q.options)}))
        ]);
        
        setIsGeneratingMore(false);
        console.log("2단계 완료: 5개의 AI 문제 생성이 완료되었습니다.");

        // --- Phase 3: Save new questions to bank ---
        if (newQuestionsFromAI.length > 0) {
            console.log("3단계: 새로 생성된 문제를 문제 은행에 저장합니다...");
            await saveNewQuestions(newQuestionsFromAI);
            console.log("3단계 완료: 저장이 완료되었습니다.");
        }
        
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setIsLoading(false);
      setIsGeneratingMore(false);
    }
  }, []);

  const handleToggleAnswer = (questionId: string, answer: string) => {
    setUserAnswers(prev => {
      const currentAnswers = prev[questionId] || [];
      const newAnswers = currentAnswers.includes(answer) ? currentAnswers.filter(a => a !== answer) : [...currentAnswers, answer];
      if (newAnswers.length > 2) return prev;
      return { ...prev, [questionId]: newAnswers };
    });
  };

  const calculateScore = useCallback(() => {
    let totalPoints = 0;
    const maxPointsPerQuestion = 6; // best(3) + best(3)
    quizData.forEach((item) => {
        const userSelection = userAnswers[item.id] || [];
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
      await saveQuizResult(user, "AI 하이브리드 모의고사", quizData, userAnswers, finalScore);
      const questionIdsToUpdate = quizData.map(q => q.id).filter((id): id is string => !!id);
      await updateSeenQuestions(user.uid, questionIdsToUpdate);
    }

    if (quizData.length === 0) return;

    setIsVerifying(true);
    setVerificationResults({});
    try {
        const verificationPromises = quizData.map((item) =>
            getAIVerification(item).then(result => {
                setVerificationResults(prev => ({ ...prev, [item.id]: result }));
            })
        );
        await Promise.all(verificationPromises);
    } catch(e) {
        console.error("AI 검증 중 오류 발생:", e);
        const errorMessage = "AI 검증 중 오류가 발생했습니다.";
        setVerificationResults(quizData.reduce((acc, item) => ({...acc, [item.id]: errorMessage}), {} as Record<string, string>));
    } finally {
        setIsVerifying(false);
    }
  };
  
  const handleGoHome = () => {
      setAppState('home');
      setQuizData([]);
      setError(null);
      setElapsedTime(0); // 홈으로 갈 때 타이머 초기화
  };
  
  const isQuizFinished = quizData.length === 10 && quizData.every((item) => (userAnswers[item.id] || []).length === 2);

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
    if (isLoading) { // This is now only the initial, brief loader
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
            key={item.id}
            quizItem={item}
            questionIndex={index}
            userAnswers={userAnswers[item.id] || []}
            showResults={showResults}
            onToggleAnswer={(answer) => handleToggleAnswer(item.id, answer)}
            isVerifying={isVerifying}
            verificationResult={verificationResults[item.id]}
          />
        ))}
        {isGeneratingMore && <Loader message="AI가 추가 문제를 생성하고 있습니다..." />}
        {!isLoading && !isGeneratingMore && !showResults && isQuizFinished && (
            <button onClick={handleShowResults} className="w-full bg-green-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-700 transition-all text-xl animate-fade-in">
              결과 확인하기 {user && '(결과가 저장됩니다)'}
            </button>
        )}
        {showResults && (
          <div className="text-center bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-indigo-300">최종 결과</h2>
              <div className="flex justify-center items-center gap-8 my-4">
                  <div>
                      <p className="text-sm text-gray-400 uppercase tracking-wider">총 소요 시간</p>
                      <p className="text-3xl font-bold text-white font-mono">{formatTime(elapsedTime)}</p>
                  </div>
                  <div className="border-l border-gray-600 h-16"></div>
                  <div>
                      <p className="text-sm text-gray-400 uppercase tracking-wider">최종 점수</p>
                      <p className="text-4xl font-extrabold">
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">{calculateScore()}</span>
                          <span className="text-xl text-gray-400"> 점</span>
                      </p>
                  </div>
              </div>
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
      {appState === 'quiz' && !showResults && quizData.length > 0 && <QuizTimer elapsedTime={elapsedTime} />}
      <div className="max-w-6xl mx-auto">
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
                {user && ADMIN_UIDS.includes(user.uid) && appState === 'home' && (
                  <button onClick={() => setAppState('admin')} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">관리자</button>
                )}
                {user && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 border border-gray-600 px-3 py-1.5 rounded-lg" title="총 문제 생성 횟수">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span><span className="font-bold text-white">{user.generationCount || 0}</span>회 생성</span>
                  </div>
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