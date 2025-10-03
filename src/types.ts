// src/types.ts

import { Timestamp } from "firebase/firestore";

export interface QuizItem {
  id?: string; // Firestore document ID
  passage: string;
  question: string;
  options: string[];
  bestAnswers: string[];
  secondBestAnswers: string[]; // 차선 답변 배열
  worstAnswer: string;       // 최악 답변
  explanation: string;
  competency: string;
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
  // 사용자의 답변을 저장하여 역량별 점수 재계산이 가능하도록 함
  userAnswers?: Record<number, string[]>;
  score: number;
  totalQuestions: number;
  createdAt: Timestamp | null;
}

export interface SystemStats {
    total: number;
    지휘감독능력: number;
    '책임감 및 적극성': number;
    '관리자로서의 자세 및 청렴도': number;
    '경영의식 및 혁신성': number;
    '업무의 이해도 및 상황대응력': number;
}

export type CompetencyAnalysis = {
    [key in keyof Omit<SystemStats, 'total'>]: string;
};


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