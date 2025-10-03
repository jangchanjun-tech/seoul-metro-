import React, { useState, FormEvent } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { User } from '../types';
import { auth } from '../firebase/config';

interface AuthProps {
  user: User | null;
  isModalOpen: boolean;
  onToggleModal: (isOpen: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ user, isModalOpen, onToggleModal }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleModalClose = () => {
    onToggleModal(false);
    // Reset state when closing modal
    setTimeout(() => {
        setMode('login');
        setEmail('');
        setPassword('');
        setError(null);
        setMessage(null);
    }, 300); // Allow for closing animation
  };

  const handleGoogleLogin = async () => {
    if (!auth) return handleError("인증 시스템 오류입니다.");
    
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      handleModalClose();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
          handleError("이 웹사이트의 도메인은 Firebase에 승인되지 않았습니다. Firebase 콘솔에서 현재 도메인을 승인된 도메인 목록에 추가해주세요.");
      } else {
          handleError("Google 로그인에 실패했습니다.");
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };
  
  const handleError = (msg: string) => {
      setError(msg);
      setMessage(null);
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return handleError("인증 시스템 오류입니다.");

    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        handleModalClose();
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("회원가입이 완료되었습니다. 자동으로 로그인됩니다.");
        setTimeout(() => handleModalClose(), 2000);
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setMessage("비밀번호 재설정 이메일을 발송했습니다. 받은편지함을 확인해주세요.");
      }
    } catch (err: any) {
      switch (err.code) {
        case 'auth/invalid-email': handleError("유효하지 않은 이메일 주소입니다."); break;
        case 'auth/user-not-found': handleError("등록되지 않은 이메일입니다."); break;
        case 'auth/wrong-password': handleError("비밀번호가 일치하지 않습니다."); break;
        case 'auth/email-already-in-use': handleError("이미 사용 중인 이메일입니다."); break;
        case 'auth/weak-password': handleError("비밀번호는 6자리 이상이어야 합니다."); break;
        default: handleError("오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  };

  const AuthModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={handleModalClose}>
      <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-sm p-8 relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleModalClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="닫기">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-indigo-400">
            {mode === 'login' && '로그인'}
            {mode === 'signup' && '회원가입'}
            {mode === 'reset' && '비밀번호 찾기'}
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            {mode === 'login' && '학습 기록을 저장하고 성과 분석 리포트를 확인하세요.'}
            {mode === 'signup' && '계정을 만들어 모든 기능을 이용해보세요.'}
            {mode === 'reset' && '가입하신 이메일 주소를 입력해주세요.'}
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 주소" required className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
          {mode !== 'reset' && <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" required className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>}
          
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {message && <p className="text-green-400 text-sm text-center">{message}</p>}

          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-md hover:bg-indigo-700 transition-colors">
            {mode === 'login' && '로그인'}
            {mode === 'signup' && '가입하기'}
            {mode === 'reset' && '재설정 이메일 발송'}
          </button>
        </form>

        <div className="text-center text-sm mt-4">
          {mode === 'login' && (
            <>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError(null);}} className="text-gray-400 hover:text-white">계정이 없으신가요? 가입하기</a>
              <span className="mx-2 text-gray-500">|</span>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); setError(null);}} className="text-gray-400 hover:text-white">비밀번호를 잊으셨나요?</a>
            </>
          )}
          {mode === 'signup' && <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null);}} className="text-gray-400 hover:text-white">이미 계정이 있으신가요? 로그인</a>}
          {mode === 'reset' && <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null);}} className="text-gray-400 hover:text-white">로그인으로 돌아가기</a>}
        </div>

        {mode === 'login' && (
            <>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="bg-gray-800 px-2 text-gray-400">또는</span></div>
                </div>
                <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-all">
                    <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    Google 계정으로 계속하기
                </button>
            </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
            {user.photoURL && <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" />}
            <button onClick={handleLogout} className="text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base">로그아웃</button>
        </div>
      ) : (
        <button onClick={() => onToggleModal(true)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all text-sm sm:text-base">로그인</button>
      )}
      {isModalOpen && <AuthModal />}
    </>
  );
};

export default Auth;
