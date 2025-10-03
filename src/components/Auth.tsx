import React from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { User } from '../types';
import { auth } from '../firebase/config';

interface AuthProps {
  user: User | null;
  isModalOpen: boolean;
  onToggleModal: (isOpen: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ user, isModalOpen, onToggleModal }) => {
  const handleGoogleLogin = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized.");
      alert("인증 시스템에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onToggleModal(false); // Close modal on successful login
    } catch (error) {
      console.error("Google 로그인 중 오류 발생:", error);
      alert("Google 로그인에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 중 오류 발생:", error);
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
          aria-label="로그인 창 닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center">
            <h2 id="auth-title" className="text-2xl font-bold text-indigo-400 mb-2">
                로그인
            </h2>
            <p className="text-gray-400 mb-6">
                성과를 기록하고 분석하려면 로그인이 필요합니다.
            </p>
            <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-all"
            >
                <svg className="w-6 h-6" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                Google 계정으로 로그인
            </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
            {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" />
            )}
            <button
              onClick={handleLogout}
              className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base"
            >
              로그아웃
            </button>
        </div>
      ) : (
        <button
          onClick={() => onToggleModal(true)}
          className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all text-sm sm:text-base"
        >
          로그인
        </button>
      )}
      {isModalOpen && <AuthModal />}
    </>
  );
};

export default Auth;
