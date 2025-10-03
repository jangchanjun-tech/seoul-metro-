import { db } from '../firebase/config';
import { QuizResult, SystemStats, QuizItem, AdminStats } from '../types';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  increment,
  updateDoc
} from 'firebase/firestore';

// User Management
export const ensureUserDocument = async (uid: string, userData: { email: string | null; displayName: string | null }) => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            ...userData,
            createdAt: serverTimestamp(),
            attemptCount: 0,
        });
    }
};

export const incrementUserAttemptCount = async (uid: string) => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        attemptCount: increment(1)
    });
};


// Quiz Results
export const saveQuizResult = async (result: Omit<QuizResult, 'id'>): Promise<string> => {
    if (!db) {
        console.warn("Firestore is not initialized. Skipping save.");
        return "";
    }
    try {
        const docRef = await addDoc(collection(db, "quizResults"), {
            ...result,
            submittedAt: Timestamp.fromDate(result.submittedAt)
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving quiz result to Firestore:", error);
        throw error;
    }
};

export const getUserQuizResults = async (userId: string): Promise<QuizResult[]> => {
    if (!db) {
        console.warn("Firestore is not initialized. Cannot fetch results.");
        return [];
    }
    const results: QuizResult[] = [];
    try {
        const q = query(
            collection(db, "quizResults"), 
            where("userId", "==", userId),
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const submittedAt = data.submittedAt instanceof Timestamp 
                ? data.submittedAt.toDate() 
                : new Date();

            results.push({ id: doc.id, ...data, submittedAt } as QuizResult);
        });
        // Sort client-side to avoid composite index requirement
        results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    } catch (error) {
        console.error("Error fetching user quiz results:", error);
    }
    return results;
};


// System & Admin
export const getSystemStats = async (userId: string): Promise<SystemStats> => {
    if (!db) return { totalParticipants: 0, averageScore: 0 };

    let totalScore = 0;
    const userIds = new Set<string>();
    let userLatestScore: number | null = null;
    let allScores: number[] = [];

    try {
        const q = query(collection(db, "quizResults"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return { totalParticipants: 0, averageScore: 0 };

        const userLatestSnapshot = await getDocs(query(collection(db, "quizResults"), where("userId", "==", userId), orderBy("submittedAt", "desc"), limit(1)));
        if(!userLatestSnapshot.empty) userLatestScore = userLatestSnapshot.docs[0].data().score;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalScore += data.score;
            userIds.add(data.userId);
            allScores.push(data.score);
        });

        const averageScore = Math.round(totalScore / querySnapshot.size);
        const stats: SystemStats = { totalParticipants: userIds.size, averageScore };

        if (userLatestScore !== null) {
            stats.percentile = Math.round((allScores.filter(score => score < userLatestScore!).length / allScores.length) * 100);
        }
        return stats;
    } catch (error) {
        console.error("Error fetching system stats:", error);
        return { totalParticipants: 0, averageScore: 0 };
    }
};

export const getQuestionCountsByCompetency = async (competencies: string[]): Promise<AdminStats> => {
    if (!db) return {};
    const stats: AdminStats = {};
    for (const competency of competencies) {
        try {
            const q = query(collection(db, `preGeneratedQuestions/${competency}/questions`));
            const snapshot = await getDocs(q);
            stats[competency] = snapshot.size;
        } catch (error) {
            console.error(`Error fetching count for ${competency}:`, error);
            stats[competency] = 0;
        }
    }
    return stats;
};

export const savePreGeneratedQuestion = async (quizItem: QuizItem): Promise<void> => {
    if (!db) {
        console.warn("Firestore is not initialized. Skipping pre-generated question save.");
        return;
    }
    try {
        const collectionPath = `preGeneratedQuestions/${quizItem.competency}/questions`;
        const docRef = doc(db, collectionPath, quizItem.id);
        await setDoc(docRef, { ...quizItem, createdAt: serverTimestamp() });
    } catch (error) {
        console.error("Error saving pre-generated question:", error);
        throw error;
    }
};

// Firestore server timestamp
const serverTimestamp = () => Timestamp.now();

// Utility to shuffle an array (Fisher-Yates shuffle)
const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const fetchRandomPreGeneratedQuestions = async (competency: string, count: number): Promise<QuizItem[]> => {
    if (!db) {
        console.warn("Firestore is not initialized. Cannot fetch pre-generated questions.");
        return [];
    }
    try {
        const collectionPath = `preGeneratedQuestions/${competency}/questions`;
        const q = query(collection(db, collectionPath));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return [];
        }

        const allQuestions = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as QuizItem));
        
        const shuffledQuestions = shuffleArray(allQuestions);

        return shuffledQuestions.slice(0, count);

    } catch (error) {
        console.error(`Error fetching pre-generated questions for ${competency}:`, error);
        return []; // Return empty on error to allow fallback in App.tsx
    }
};