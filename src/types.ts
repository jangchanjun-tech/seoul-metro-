import { Timestamp } from "firebase/firestore";

export interface QuizItem {
  passage: string;
  question: string;
  options: string[];
  bestAnswers: string[];
  explanation: string;
  competency: string; // 평가 역량 필드 추가
}

// Add User type from Firebase for type safety
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface QuizResult {
  id: string;
  userId: string;
  userName: string;
  topic: string;
  quizData: QuizItem[];
  score: number;
  totalQuestions: number;
  createdAt: Timestamp | null;
}


// Add manual type definitions for Vite environment variables
// This resolves errors related to 'import.meta.env' not being recognized by TypeScript.
declare global {
  interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// This empty export is needed to treat this file as a module.
export {};