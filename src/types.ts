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
