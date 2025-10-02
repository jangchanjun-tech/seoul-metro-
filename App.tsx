import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { generateQuiz, getAIVerification } from './geminiService';
import { saveQuizResult } from './firebaseService';
import { QuizItem, User } from './types';
import Loader from './Loader';
import QuizCard from './QuizCard';
import Auth from './Auth';
import GuideModal from './GuideModal';
import HomeScreen from './HomeScreen';
import { auth, isFirebaseConfigured } from './firebaseConfig';

// --- 유틸리티 함수 ---
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const App: React.FC = () => {
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string[]>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [appState, setAppState] = useState<'home' | 'quiz'>('home');
  const [verificationResults, setVerificationResults] = useState<Record<number, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  
  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser ? { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email, photoURL: currentUser.photoURL } : null);
        });
        return () => unsubscribe();
    }
  }, []);

  const handleGenerateQuiz = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setQuizData([]);
    setUserAnswers({});
    setShowResults(false);
    setVerificationResults({});
    setIsVerifying(false);
    setAppState('quiz');

    try {
        const competencies = [
            "지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력",
            "지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"
        ];
        
        console.log("10개의 문제 생성을 병렬로 시작합니다...");
        const generationPromises = competencies.map(competency => generateQuiz(competency));
        const newQuestions = await Promise.all(generationPromises);
        console.log("10개의 문제 생성이 완료되었습니다.");

        const processedQuestions = newQuestions.map(q => ({
            ...q,
            options: shuffleArray(q.options)
        }));

        setQuizData(processedQuestions);
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

  const calculateScore = useCallback(() => quizData.reduce((score, item, index) => {
    const userSelection = userAnswers[index] || [];
    const isCorrect = userSelection.length === item.bestAnswers.length && [...userSelection].sort().join(',') === [...item.bestAnswers].sort().join(',');
    return isCorrect ? score + 1 : score;
  }, 0), [quizData, userAnswers]);

  const handleShowResults = async () => {
    setShowResults(true);
    if (user && quizData.length > 0) {
      saveQuizResult(user.uid, "AI 실시간 모의고사", quizData, calculateScore());
    }
    if (quizData.length === 0) return;

    setIsVerifying(true);
    setVerificationResults({});
    try {
        console.log("10개 문제에 대한 AI 검증을 병렬로 시작합니다...");
        const verificationPromises = quizData.map((item, index) => 
            getAIVerification(item).then(result => ({ index, result }))
        );

        const results = await Promise.all(verificationPromises);
        console.log("AI 검증이 완료되었습니다.");
        
        const newVerificationResults = results.reduce((acc, { index, result }) => {
            acc[index] = result;
            return acc;
        }, {} as Record<number, string>);
        
        setVerificationResults(newVerificationResults);

    } catch(e) {
        console.error("AI 검증 중 오류 발생:", e);
        const errorMessage = "AI 검증 중 오류가 발생했습니다.";
        const errorResults = quizData.reduce((acc, _, index) => {
            acc[index] = errorMessage;
            return acc;
        }, {} as Record<number, string>);
        setVerificationResults(errorResults);
    } finally {
        setIsVerifying(false);
    }
  };
  
  const handleRestart = () => {
      setAppState('home');
      setQuizData([]);
      setError(null);
  };
  
  const isQuizFinished = !isLoading && quizData.length > 0 && quizData.every((_, index) => (userAnswers[index] || []).length === 2);

  const renderContent = () => {
    if (appState === 'home') {
      return <HomeScreen onStartQuiz={handleGenerateQuiz} isLoading={isLoading} />;
    }
    if (isLoading) {
      return <Loader />;
    }
    if (error) {
      return (
        <div className="text-center">
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4">{error}</div>
          <button onClick={handleRestart} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">홈으로 돌아가기</button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {quizData.map((item, index) => (
          <QuizCard
            key={index}
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
                  <span className="text-xl text-gray-400"> / {quizData.length}</span>
              </p>
              <button onClick={handleRestart} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                새로운 모의고사 풀기
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
            <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    서울교통공사 AI 모의고사
                </h1>
                <p className="text-md text-gray-300 hidden sm:block">
                    실전과 같은 10가지 상황판단문제로 역량을 진단하세요.
                </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={() => setIsGuideModalOpen(true)} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base" aria-label="이용안내 보기">
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
          {renderContent()}
        </main>
      </div>
      {isGuideModalOpen && <GuideModal onClose={() => setIsGuideModalOpen(false)} />}
    </div>
  );
};

export default App;