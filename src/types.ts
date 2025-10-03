/// <reference types="vite/client" />

import { User as FirebaseUser } from 'firebase/auth';

// This merges the Firebase user type with a possible null value.
export type User = FirebaseUser | null;

export interface QuizItem {
  id: string;
  competency: string;
  passage: string;
  question: string;
  options: string[];
  bestAnswers: string[];
  secondBestAnswers: string[];
  worstAnswer: string;
  explanation: string;
}

export interface QuizResult {
  id: string; // Firestore document ID
  userId: string;
  quizData: QuizItem[];
  userAnswers: { [key: string]: string[] };
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  elapsedTime: number;
  submittedAt: Date;
  competencyScores: { [key: string]: { correct: number; total: number } };
}

// For AI competency analysis
export interface CompetencyAnalysis {
  지휘감독능력: string;
  '책임감 및 적극성': string;
  '관리자로서의 자세 및 청렴도': string;
  '경영의식 및 혁신성': string;
  '업무의 이해도 및 상황대응력': string;
  [key: string]: string; // For dynamic access
}

// For overall system/user statistics
export interface SystemStats {
  totalParticipants: number;
  averageScore: number;
  percentile?: number; // User-specific percentile
}
