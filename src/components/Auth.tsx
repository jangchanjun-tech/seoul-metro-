import React, { useState } from 'react';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { User } from '../types';

interface AuthProps {
  user: User | null;
  isModalOpen: boolean;
  onToggleModal: (isOpen: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ user, isModalOpen, onToggleModal }) => {
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!auth) {
        setError("Firebase is not initialized.");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
      setError(null);
      await signInWithPopup(auth, provider);
      onToggleModal(false); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred during sign-in.");
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const AuthModal = () => (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={() => onToggleModal(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      <div
        className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-sm p-8 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => onToggleModal(false)} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="로그인 닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id="auth-title" className="text-2xl font-bold text-indigo-400 mb-6 text-center">
          로그인
        </h2>
        <p className="text-center text-gray-300 mb-6">
          로그인하여 학습 기록을 저장하고<br/>성과 분석 리포트를 확인하세요.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-all duration-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#34A853" d="M6.306 14.691L11.961 19.346C10.607 21.033 10 23.385 10 26s.607 4.967 1.961 6.654L6.306 37.309C4.657 34.047 4 30.138 4 26s.657-8.047 2.306-11.309z"/>
            <path fill="#FBBC05" d="M26 10c-3.208 0-5.992 1.346-7.961 3.309l5.657 5.657C24.48 18.445 25.162 18 26 18c2.761 0 5.093 1.649 5.996 3.917l5.657-5.657C36.046 11.154 31.059 10 26 10z"/>
            <path fill="#EA4335" d="M26 38c-3.119 0-5.807-1.083-7.794-2.895l-5.657 5.657C15.953 44.846 20.375 46 26 46c5.745 0 10.701-2.08 14.18-5.526l-5.657-5.657C31.093 36.351 28.761 38 26 38z"/>
          </svg>
          Google 계정으로 로그인
        </button>
        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
      </div>
    </div>
  );

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
            <span className="text-white font-medium hidden sm:block">{user.displayName}</span>
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
