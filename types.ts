export interface QuizItem {
  passage: string;
  question: string;
  options: string[];
  bestAnswers: string[];
  explanation: string;
}

// Add User type from Firebase for type safety
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}