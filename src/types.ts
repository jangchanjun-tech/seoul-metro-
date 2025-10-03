import { Timestamp } from "firebase/firestore";

export interface QuizItem {
  id: string; // Firestore document ID or client-side UUID
  passage: string;
  question: string;
  options: string[];
  bestAnswers: string[];
  secondBestAnswers: string[]; // 차선 답변 배열
  worstAnswer: string;       // 최악 답변
  explanation: string;
  competency: string;
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  generationCount?: number;
}

export interface QuizResult {
  id: string;
  userId: string;
  userName: string;
  topic: string;
  quizData: QuizItem[];
  userAnswers?: Record<string, string[]>;
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

export interface CompetencyPerformanceStat {
  totalScore: number;
  attemptCount: number;
}

export interface OverallPerformanceStats {
  [key: string]: CompetencyPerformanceStat;
}

export interface AnalysisCache {
  analysis: CompetencyAnalysis;
  basedOnResultId: string;
  generatedAt: Timestamp;
}

// Vite 환경 변수에 대한 타입 정의
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
