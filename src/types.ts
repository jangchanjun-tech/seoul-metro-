import { User as FirebaseUser } from 'firebase/auth';

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

export interface CompetencyAnalysis {
  지휘감독능력: string;
  '책임감 및 적극성': string;
  '관리자로서의 자세 및 청렴도': string;
  '경영의식 및 혁신성': string;
  '업무의 이해도 및 상황대응력': string;
  [key: string]: string;
}

export interface SystemStats {
  totalParticipants: number;
  averageScore: number;
  percentile?: number;
}

// For Admin Panel
export interface AdminStats {
    [key: string]: number; // e.g., { '지휘감독능력': 50, '책임감': 45 }
}