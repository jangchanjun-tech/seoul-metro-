import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, isFirebaseInitialized } from './firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { isGeminiInitialized, generateSingleQuiz, shuffleArray, getAIVerification } from './services/geminiService';
import { saveQuizResult, getQuestionCountsByCompetency, savePreGeneratedQuestion, ensureUserDocument, incrementUserAttemptCount, fetchRandomPreGeneratedQuestions, updateSystemStatsAfterQuiz } from './services/firebaseService';
import { QuizItem, User, QuizResult, AdminStats } from './types';

// Components
import HomeScreen from './components/HomeScreen';
import QuizCard from './components/QuizCard';
import Loader from './components/Loader';
import Auth from './components/Auth';
import GuideModal from './components/GuideModal';
import QuizTimer from './components/QuizTimer';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

type AppState = 'home' | 'loading' | 'quiz' | 'results' | 'dashboard' | 'review' | 'admin';

const COMPETENCIES = [
    '지휘감독능력', '책임감 및 적극성', '관리자로서의 자세 및 청렴도', 
    '경영의식 및 혁신성', '업무의 이해도 및 상황대응력'
];

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('home');
    const [quizData, setQuizData] = useState<QuizItem[]>([]);
    const [userAnswers, setUserAnswers] = useState<{ [key: string]: string[] }>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Auth & User State
    const [user, setUser] = useState<User>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

    // Results State
    const [score, setScore] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [verificationResults, setVerificationResults] = useState<{[key: string]: string}>({});
    const [isVerifying, setIsVerifying] = useState<{[key: string]: boolean}>({});
    const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
    
    // Admin State
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminStats, setAdminStats] = useState<AdminStats>({});
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const autoGenIntervalRef = useRef<NodeJS.Timeout | null>(null);


    // Authentication Listener, Admin Check & Initial Setup
    useEffect(() => {
        if (!isFirebaseInitialized || !auth || !db) {
            setError("로그인/데이터베이스 서비스가 초기화되지 않았습니다. Firebase 환경 변수 설정을 확인해주세요.");
            setIsAuthLoading(false);
            return;
        }

        // Check for Gemini API key on initial load for better user feedback.
        if (!isGeminiInitialized) {
            setError("AI 서비스가 초기화되지 않았습니다. Vercel 또는 로컬 환경에 `VITE_API_KEY` 환경 변수가 올바르게 설정되었는지 확인해주세요.");
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // This function now handles creating the user document AND assigning the 'admin' role
                // to the very first user automatically. It returns the user's role.
                const { role } = await ensureUserDocument(currentUser.uid, {
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                });
                
                // Set admin state based on the role from the database.
                setIsAdmin(role === 'admin');

            } else {
                // Reset admin state on logout.
                setIsAdmin(false);
            }
            setUser(currentUser);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    // Timer Logic
    useEffect(() => {
        if (appState === 'quiz') {
            const startTime = Date.now();
            timerIntervalRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [appState]);

    // Admin Auto-generation Cleanup
    useEffect(() => {
        return () => {
            if (autoGenIntervalRef.current) {
                clearInterval(autoGenIntervalRef.current);
            }
        };
    }, []);

    const startQuiz = useCallback(async () => {
        if (!isFirebaseInitialized) {
            setError("데이터베이스 서비스가 초기화되지 않았습니다. Firebase 환경 변수를 확인해주세요.");
            return;
        }
        if (!isGeminiInitialized) {
            setError("AI 서비스가 초기화되지 않았습니다. VITE_API_KEY 환경 변수가 올바르게 설정되었는지 확인해주세요.");
            return;
        }
        
        setError(null); // Clear previous errors before starting
        setIsLoading(true);
        setAppState('loading');

        try {
            // 각 역량별로 문제 은행에서 1개(없으면 실시간 생성), 실시간 AI 생성 1개를 가져옵니다.
            const promises: Promise<QuizItem>[] = COMPETENCIES.flatMap(comp => {
                const preGeneratedPromise = fetchRandomPreGeneratedQuestions(comp, 1)
                    .then(questions => {
                        if (questions.length > 0) {
                            return questions[0];
                        }
                        // Fallback: 문제 은행에 문제가 없으면 실시간으로 생성
                        console.warn(`'${comp}' 역량에 대한 사전 생성 문제가 없어 실시간으로 생성합니다.`);
                        return generateSingleQuiz(comp);
                    })
                    .catch((error) => {
                        // Fallback: 에러 발생 시에도 실시간으로 생성
                        console.error(`'${comp}' 역량 문제 은행 로딩 실패. 실시간 생성으로 대체합니다.`, error);
                        return generateSingleQuiz(comp);
                    });

                const liveGeneratedPromise = generateSingleQuiz(comp);

                return [preGeneratedPromise, liveGeneratedPromise];
            });

            const results = await Promise.all(promises);
            const validResults = results.filter((item): item is QuizItem => !!item);

            if (validResults.length < 10) {
                 throw new Error(`문제 생성에 실패하여 ${validResults.length}개만 로드되었습니다. 잠시 후 다시 시도해주세요.`);
            }

            setQuizData(shuffleArray(validResults));
            
            setUserAnswers({});
            setCurrentQuestionIndex(0);
            setScore(0);
            setTotalCorrect(0);
            setElapsedTime(0);
            setVerificationResults({});
            setIsVerifying({});
            
            setAppState('quiz');
        } catch (err: any) {
            setError(err.message || '퀴즈 생성 중 오류가 발생했습니다.');
            setAppState('home');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleToggleAnswer = (answer: string) => {
        const currentQuestionId = quizData[currentQuestionIndex].id;
        const currentAnswers = userAnswers[currentQuestionId] || [];

        if (currentAnswers.includes(answer)) {
            setUserAnswers({ ...userAnswers, [currentQuestionId]: currentAnswers.filter(a => a !== answer) });
        } else if (currentAnswers.length < 2) {
            setUserAnswers({ ...userAnswers, [currentQuestionId]: [...currentAnswers, answer] });
        }
    };

    const goToNextQuestion = () => currentQuestionIndex < quizData.length - 1 && setCurrentQuestionIndex(currentQuestionIndex + 1);
    const goToPreviousQuestion = () => currentQuestionIndex > 0 && setCurrentQuestionIndex(currentQuestionIndex - 1);

    const finishQuiz = useCallback(async () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        let correctCount = 0;
        const competencyScores: { [key: string]: { correct: number; total: number } } = {};
        COMPETENCIES.forEach(c => { competencyScores[c] = { correct: 0, total: 0 }; });

        quizData.forEach(item => {
            const userAns = userAnswers[item.id] || [];
            const isCorrect = userAns.length === 2 && userAns.every(ans => item.bestAnswers.includes(ans));
            competencyScores[item.competency].total += 1;
            if (isCorrect) {
                correctCount++;
                competencyScores[item.competency].correct += 1;
            }
        });
        
        const finalScore = Math.round((correctCount / quizData.length) * 100);
        setTotalCorrect(correctCount);
        setScore(finalScore);
        setAppState('results');
        
        quizData.forEach(item => {
             if (!verificationResults[item.id]) {
                setIsVerifying(prev => ({ ...prev, [item.id]: true }));
                getAIVerification(item).then(result => {
                    setVerificationResults(prev => ({...prev, [item.id]: result}));
                }).finally(() => setIsVerifying(prev => ({ ...prev, [item.id]: false })));
            }
        });
        
        if (user && isFirebaseInitialized) {
            await saveQuizResult({
                userId: user.uid, quizData, userAnswers, score: finalScore,
                totalCorrect: correctCount, totalQuestions: quizData.length, elapsedTime,
                submittedAt: new Date(), competencyScores,
            });
            const { isFirstAttempt } = await incrementUserAttemptCount(user.uid);
            await updateSystemStatsAfterQuiz(finalScore, isFirstAttempt);
        }
    }, [quizData, userAnswers, elapsedTime, user, verificationResults]);

    const handleGoToDashboard = () => user ? setAppState('dashboard') : setIsAuthModalOpen(true);
    const handleReview = (result: QuizResult) => { setReviewResult(result); setCurrentQuestionIndex(0); setAppState('review'); };
    const handleGoToAdmin = async () => { await fetchAdminStats(); setAppState('admin'); };

    const fetchAdminStats = async () => {
        const stats = await getQuestionCountsByCompetency(COMPETENCIES);
        setAdminStats(stats);
    };

    const handleGenerateSingleAdmin = async (competency: string) => {
        try {
            const newItem = await generateSingleQuiz(competency);
            await savePreGeneratedQuestion(newItem);
            await fetchAdminStats(); // Refresh stats
        } catch (error) {
            console.error("Admin generation failed:", error);
            setError("AI 문제 생성에 실패했습니다.");
        }
    };
    
    const handleGenerateAllAdmin = async () => {
        setIsBatchGenerating(true);
        setError(null);
        try {
            const generationPromises = COMPETENCIES.map(async (competency) => {
                const newItem = await generateSingleQuiz(competency);
                await savePreGeneratedQuestion(newItem);
            });
            await Promise.all(generationPromises);
            await fetchAdminStats(); // Refresh stats
            alert('5개 역량의 문제가 모두 성공적으로 생성되어 문제 은행에 저장되었습니다.');
        } catch (error) {
            console.error("Admin batch generation failed:", error);
            setError("AI 문제 일괄 생성에 실패했습니다. 일부 문제가 생성되지 않았을 수 있습니다.");
        } finally {
            setIsBatchGenerating(false);
        }
    };

    const autoGenerateQuestion = useCallback(async () => {
        const currentStats = await getQuestionCountsByCompetency(COMPETENCIES);
        setAdminStats(currentStats);

        let minCount = Infinity;
        let targetCompetency = '';
        
        COMPETENCIES.forEach(comp => {
            const count = currentStats[comp] || 0;
            if (count < minCount) {
                minCount = count;
                targetCompetency = comp;
            }
        });

        if (targetCompetency) {
            console.log(`Auto-generating for least populated competency: ${targetCompetency} (${minCount} questions)`);
            await handleGenerateSingleAdmin(targetCompetency);
        }
    }, []);
    
    const handleToggleAutoGeneration = () => {
        if (isAutoGenerating) {
            if (autoGenIntervalRef.current) clearInterval(autoGenIntervalRef.current);
            setIsAutoGenerating(false);
        } else {
            setIsAutoGenerating(true);
            autoGenerateQuestion(); // Run immediately
            autoGenIntervalRef.current = setInterval(autoGenerateQuestion, 60000); // every 60 seconds
        }
    };
    
    const renderContent = () => {
        switch (appState) {
            case 'loading': return <Loader />;
            case 'quiz':
            case 'results': {
                if (quizData.length === 0) return <HomeScreen onStartQuiz={startQuiz} isLoading={isLoading} />;
                const currentQuestion = quizData[currentQuestionIndex];
                return (
                    <div className="w-full max-w-4xl mx-auto space-y-6">
                        {appState === 'quiz' && <QuizTimer elapsedTime={elapsedTime} />}
                        <QuizCard key={currentQuestion.id} quizItem={currentQuestion} questionIndex={currentQuestionIndex} userAnswers={userAnswers[currentQuestion.id] || []} showResults={appState === 'results'} onToggleAnswer={handleToggleAnswer} isVerifying={isVerifying[currentQuestion.id] || false} verificationResult={verificationResults[currentQuestion.id]} />
                        <div className="flex justify-between items-center mt-6 px-2">
                           <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0} className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
                           <span className="text-white font-semibold">{currentQuestionIndex + 1} / {quizData.length}</span>
                           {currentQuestionIndex < quizData.length - 1 ? (
                               <button onClick={goToNextQuestion} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">다음</button>
                           ) : (
                               <button onClick={finishQuiz} disabled={appState === 'results'} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50">결과 확인하기</button>
                           )}
                        </div>
                        {appState === 'results' && (
                            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6 text-center animate-fade-in">
                                <h2 className="text-2xl font-bold text-indigo-300 mb-2">최종 결과</h2>
                                <p className="text-4xl font-extrabold text-white mb-4">{score}<span className="text-xl font-normal text-gray-400"> / 100</span></p>
                                <p className="text-gray-300">{`총 ${quizData.length}문제 중 ${totalCorrect}문제를 맞혔습니다. (소요 시간: ${Math.floor(elapsedTime / 60)}분 ${elapsedTime % 60}초)`}</p>
                                <div className="mt-6 flex justify-center gap-4"><button onClick={() => setAppState('home')} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">홈으로</button></div>
                            </div>
                        )}
                    </div>
                );
            }
            case 'dashboard': return <Dashboard user={user!} onReview={handleReview} onBack={() => setAppState('home')} />;
            case 'admin': return <AdminPanel stats={adminStats} isAutoGenerating={isAutoGenerating} onGenerate={handleGenerateSingleAdmin} onToggleAuto={handleToggleAutoGeneration} onBack={() => setAppState('home')} onGenerateAll={handleGenerateAllAdmin} isBatchGenerating={isBatchGenerating} />;
            case 'review': {
                 if (!reviewResult) return <p>리뷰할 데이터를 찾을 수 없습니다.</p>;
                 const currentQuestion = reviewResult.quizData[currentQuestionIndex];
                 return (
                    <div className="w-full max-w-4xl mx-auto space-y-6">
                        <h2 className="text-2xl font-bold text-center text-indigo-300">결과 다시보기 ({new Date(reviewResult.submittedAt).toLocaleString()})</h2>
                        <QuizCard key={currentQuestion.id} quizItem={currentQuestion} questionIndex={currentQuestionIndex} userAnswers={reviewResult.userAnswers[currentQuestion.id] || []} showResults={true} onToggleAnswer={() => {}} isVerifying={false} isReviewMode={true}/>
                         <div className="flex justify-between items-center mt-6 px-2">
                           <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0} className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
                           <span className="text-white font-semibold">{currentQuestionIndex + 1} / {reviewResult.quizData.length}</span>
                           {currentQuestionIndex < reviewResult.quizData.length - 1 ? (
                               <button onClick={goToNextQuestion} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">다음</button>
                           ) : (
                               <button onClick={() => setAppState('dashboard')} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">성과분석으로</button>
                           )}
                        </div>
                    </div>
                 );
            }
            case 'home': default: return <HomeScreen onStartQuiz={startQuiz} isLoading={isLoading} />;
        }
    };
    
    if (isAuthLoading) {
        return <div className="min-h-screen bg-gray-900 flex justify-center items-center"><Loader message="인증 정보를 확인하는 중입니다..." /></div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500/30">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-10" style={{'--grid-color': 'rgba(129, 140, 248, 0.2)', '--grid-size': '40px'} as React.CSSProperties}></div>
            <style>{`.bg-grid-pattern { background-image: linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(to right, var(--grid-color) 1px, transparent 1px); background-size: var(--grid-size) var(--grid-size); }`}</style>
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-transparent to-gray-900"></div>

            <header className="relative z-20 p-4 sm:p-6 flex justify-between items-center max-w-7xl mx-auto">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setAppState('home'); setCurrentQuestionIndex(0); }}>
                    <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"></path></svg>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">서울교통공사 AI 역량평가</h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={() => setIsGuideModalOpen(true)} className="text-gray-300 hover:text-white font-medium py-2 px-3 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">이용안내</button>
                    {isFirebaseInitialized && user && <button onClick={handleGoToDashboard} className="text-gray-300 hover:text-white font-medium py-2 px-3 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">나의 성과분석</button>}
                    {isFirebaseInitialized && user && isAdmin && <button onClick={handleGoToAdmin} className="text-yellow-400 hover:text-yellow-300 font-medium py-2 px-3 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">관리자</button>}
                    {isFirebaseInitialized && <Auth user={user} isModalOpen={isAuthModalOpen} onToggleModal={setIsAuthModalOpen} />}
                </div>
            </header>

            <main className="relative z-10 flex flex-col items-center justify-center p-4 sm:p-6 pt-10 sm:pt-16">
                {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-6 w-full max-w-4xl text-center">{error}</div>}
                {renderContent()}
            </main>
            
            {isGuideModalOpen && <GuideModal onClose={() => setIsGuideModalOpen(false)} />}
        </div>
    );
};

export default App;