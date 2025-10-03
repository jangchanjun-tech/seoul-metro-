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

// FIX: Add global type definitions for process.env to support environment variables.
// This makes process.env variables available to TypeScript for type checking.
// The execution environment is expected to provide these values.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
      FIREBASE_API_KEY: string;
      FIREBASE_AUTH_DOMAIN: string;
      FIREBASE_PROJECT_ID: string;
      FIREBASE_STORAGE_BUCKET: string;
      FIREBASE_MESSAGING_SENDER_ID: string;
      FIREBASE_APP_ID: string;
    }
  }
}
