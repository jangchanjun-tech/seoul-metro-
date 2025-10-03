import React, { useState } from 'react';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { User } from '../types';

interface AuthProps {
  user: User | null;
  isModalOpen: boolean;
  onToggleModal: (isOpen: boolean) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

const Auth: React.FC<AuthProps> = ({ user, isModalOpen, onToggleModal }) => {
  
  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const AuthModal = () => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        if (!auth) {
            setError("Firebase is not initialized.");
            return;
        }
        const provider = new GoogleAuthProvider();
        try {
          setError(null);
          await signInWithPopup(auth, provider);
          onToggleModal(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "An unknown error occurred during Google sign-in.");
          console.error(err);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth) {
            setError("Firebase is not initialized.");
            return;
        }
        setError(null);
        setMessage(null);

        try {
            if (mode === 'register') {
                await createUserWithEmailAndPassword(auth, email, password);
                onToggleModal(false);
            } else if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
                onToggleModal(false);
            } else if (mode === 'reset') {
                await sendPasswordResetEmail(auth, email);
                setMessage("비밀번호 재설정 이메일을 발송했습니다. 받은편지함을 확인해주세요.");
            }
        } catch (err) {
            if (err instanceof Error) {
                // FIX: Cast 'err' to 'any' to access the 'code' property, which exists on Firebase errors but not on the generic Error type.
                switch ((err as any).code) {
                    case 'auth/email-already-in-use':
                        setError("이미 사용 중인 이메일입니다.");
                        break;
                    case 'auth/user-not-found':
                        setError("존재하지 않는 계정입니다.");
                        break;
                    case 'auth/wrong-password':
                        setError("비밀번호가 올바르지 않습니다.");
                        break;
                    case 'auth/invalid-email':
                        setError("유효하지 않은 이메일 형식입니다.");
                        break;
                    default:
                        setError("오류가 발생했습니다. 다시 시도해주세요.");
                }
            } else {
                setError("알 수 없는 오류가 발생했습니다.");
            }
            console.error(err);
        }
    };
    
    const getTitle = () => {
        if (mode === 'login') return '로그인';
        if (mode === 'register') return '회원가입';
        return '비밀번호 재설정';
    }

    return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={() => onToggleModal(false)}
      role="dialog" aria-modal="true" aria-labelledby="auth-title"
    >
      <div
        className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-sm p-8 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => onToggleModal(false)} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 id="auth-title" className="text-2xl font-bold text-indigo-400 mb-6 text-center">{getTitle()}</h2>
        
        { mode !== 'reset' && 
          <p className="text-center text-gray-300 mb-6">학습 기록을 저장하고 성과 분석 리포트를 확인하세요.</p>
        }
        { mode === 'reset' &&
          <p className="text-center text-gray-300 mb-6">가입했던 이메일 주소를 입력하시면<br/>비밀번호 재설정 링크를 보내드립니다.</p>
        }

        <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            {mode !== 'reset' && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            )}
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            {message && <p className="text-green-400 text-sm text-center">{message}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-all">
              {mode === 'login' ? '로그인' : mode === 'register' ? '가입하기' : '재설정 이메일 발송'}
            </button>
        </form>
        
        <div className="text-center text-sm mt-4">
            {mode === 'login' && (
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(null);}} className="text-gray-400 hover:text-white">
                계정이 없으신가요? 가입하기
              </a>
            )}
            {mode === 'register' && (
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null);}} className="text-gray-400 hover:text-white">
                이미 계정이 있으신가요? 로그인
              </a>
            )}
        </div>
        
        {mode === 'login' && 
          <div className="text-center text-sm mt-2">
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); setError(null); }} className="text-gray-400 hover:text-white">
              비밀번호를 잊으셨나요?
            </a>
          </div>
        }
        
        {mode === 'reset' && 
          <div className="text-center text-sm mt-2">
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null); setMessage(null);}} className="text-gray-400 hover:text-white">
              로그인으로 돌아가기
            </a>
          </div>
        }

        {mode !== 'reset' && (
            <>
                <div className="my-6 flex items-center">
                  <div className="flex-grow border-t border-gray-600"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-sm">또는</span>
                  <div className="flex-grow border-t border-gray-600"></div>
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-all duration-300"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#34A853" d="M6.306 14.691L11.961 19.346C10.607 21.033 10 23.385 10 26s.607 4.967 1.961 6.654L6.306 37.309C4.657 34.047 4 30.138 4 26s.657-8.047 2.306-11.309z"/><path fill="#FBBC05" d="M26 10c-3.208 0-5.992 1.346-7.961 3.309l5.657 5.657C24.48 18.445 25.162 18 26 18c2.761 0 5.093 1.649 5.996 3.917l5.657-5.657C36.046 11.154 31.059 10 26 10z"/><path fill="#EA4335" d="M26 38c-3.119 0-5.807-1.083-7.794-2.895l-5.657 5.657C15.953 44.846 20.375 46 26 46c5.745 0 10.701-2.08 14.18-5.526l-5.657-5.657C31.093 36.351 28.761 38 26 38z"/></svg>
                  Google 계정으로 계속하기
                </button>
            </>
        )}
      </div>
    </div>
    );
  }

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-white font-medium hidden sm:block">{user.displayName || user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <button
          onClick={() => onToggleModal(true)}
          className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all text-sm sm:text-base"
        >
          로그인
        </button>
      )}
      {isModalOpen && !user && <AuthModal />}
    </>
  );
};

export default Auth;