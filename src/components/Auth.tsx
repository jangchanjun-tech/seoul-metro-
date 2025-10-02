import React from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { User } from '../types';

interface AuthProps {
  user: User | null;
}

const Auth: React.FC<AuthProps> = ({ user }) => {

  const handleSignIn = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

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
          onClick={handleSignIn}
          className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all"
        >
          Google로 로그인
        </button>
      )}
    </div>
  );
};

export default Auth;
