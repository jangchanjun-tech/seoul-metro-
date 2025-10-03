import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { auth, googleProvider } from '../firebase/config';
import { User } from '../types';

interface AuthProps {
  user: User | null;
}

const Auth: React.FC<AuthProps> = ({ user }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // FIX: Set persistence to 'none' to avoid web storage errors in restricted environments.
    if (auth) {
        auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
          .catch((error) => {
              console.error("Error setting auth persistence:", error);
          });
    }
  }, []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  };

  const handleOpenModal = () => {
    setFormType('signIn');
    resetForm();
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return;
    try {
      await auth.signInWithPopup(googleProvider);
      handleCloseModal();
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err instanceof Error) {
          setError(err.message);
      } else {
          const firebaseError = err as any;
          if (firebaseError.code === 'auth/operation-not-supported-in-this-environment') {
               setError('현재 환경에서는 팝업 로그인을 지원하지 않습니다.');
          } else {
               setError("알 수 없는 오류가 발생했습니다.");
          }
      }
    }
  };
  
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      handleCloseModal();
    } catch (err) {
      console.error("Email sign-in error:", err);
      const firebaseError = err as any;
      switch (firebaseError.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            break;
          case 'auth/invalid-email':
            setError('유효하지 않은 이메일 형식입니다.');
            break;
          default:
            setError('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    if (!displayName.trim()) {
        setError('이름(닉네임)을 입력해주세요.');
        return;
    }
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      if (userCredential.user) {
        await userCredential.user.updateProfile({ displayName });
      }
      handleCloseModal();
    } catch (err) {
        console.error("Email sign-up error:", err);
        const firebaseError = err as any;
        switch (firebaseError.code) {
            case 'auth/email-already-in-use':
                setError('이미 사용 중인 이메일입니다.');
                break;
            case 'auth/weak-password':
                setError('비밀번호는 6자 이상이어야 합니다.');
                break;
            case 'auth/invalid-email':
                setError('유효하지 않은 이메일 형식입니다.');
                break;
            default:
                setError('회원가입 중 오류가 발생했습니다.');
        }
    }
  };


  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const renderAuthModal = () => (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
        onClick={handleCloseModal}
    >
        <div 
            className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-sm p-8 relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
        >
            <button 
                onClick={handleCloseModal} 
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
                aria-label="닫기"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <div className="mb-6">
                <div className="flex border-b border-gray-700">
                    <button onClick={() => setFormType('signIn')} className={`flex-1 py-2 text-sm font-medium transition-colors ${formType === 'signIn' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>로그인</button>
                    <button onClick={() => setFormType('signUp')} className={`flex-1 py-2 text-sm font-medium transition-colors ${formType === 'signUp' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>회원가입</button>
                </div>
            </div>

            {formType === 'signIn' ? (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all">로그인</button>
                </form>
            ) : (
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                    <input type="text" placeholder="이름 (닉네임 사용 가능)" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all">회원가입</button>
                </form>
            )}
            {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
            <div className="flex items-center my-6">
                <hr className="flex-grow border-gray-600" />
                <span className="mx-4 text-gray-400 text-sm">또는</span>
                <hr className="flex-grow border-gray-600" />
            </div>
            <button onClick={handleGoogleSignIn} className="w-full bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-all flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.657-3.356-11.303-7.918l-6.522,5.023C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                Google 계정으로 계속하기
            </button>
        </div>
    </div>
  );

  return (
    <div className="flex items-center gap-4">
      {user ? (
        <>
          <div className="flex items-center gap-2">
            {user.photoURL && <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" />}
            <span className="text-gray-300 hidden sm:inline">{user.displayName}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-all"
          >
            로그아웃
          </button>
        </>
      ) : (
        <button
          onClick={handleOpenModal}
          className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all"
        >
          로그인
        </button>
      )}
      {isModalOpen && renderAuthModal()}
    </div>
  );
};

export default Auth;