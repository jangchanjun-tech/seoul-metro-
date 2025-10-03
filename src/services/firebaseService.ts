import { db } from '../firebase/config';
import { QuizResult, SystemStats, QuizItem, AdminStats, CachedAnalysis } from '../types';
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
  updateDoc,
  runTransaction
} from 'firebase/firestore';

// User Management
export const ensureUserDocument = async (uid: string, userData: { email: string | null; displayName: string | null }) => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            ...userData,
            createdAt: Timestamp.now(),
            attemptCount: 0,
        });
    }
};

export const incrementUserAttemptCount = async (uid: string): Promise<{ isFirstAttempt: boolean }> => {
    if (!db) return { isFirstAttempt: false };
    const userRef = doc(db, 'users', uid);
    try {
        const userSnap = await getDoc(userRef);
        const currentAttempts = userSnap.data()?.attemptCount || 0;
        
        await updateDoc(userRef, {
            attemptCount: increment(1)
        });
        
        return { isFirstAttempt: currentAttempts === 0 };
    } catch (error) {
        console.error("Error incrementing user attempt count:", error);
        // Fallback to ensure quiz flow continues
        await updateDoc(userRef, { attemptCount: increment(1) });
        return { isFirstAttempt: false };
    }
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
export const getSystemStatsSummary = async (): Promise<SystemStats> => {
    if (!db) return { totalParticipants: 0, averageScore: 0 };
    try {
        const statsRef = doc(db, 'system_stats', 'summary');
        const statsSnap = await getDoc(statsRef);

        if (!statsSnap.exists()) {
            return { totalParticipants: 0, averageScore: 0 };
        }
        
        const statsData = statsSnap.data();
        const totalScore = statsData.totalScoreSum || 0;
        const totalQuizzes = statsData.totalQuizCount || 0;
        
        return {
            totalParticipants: statsData.totalParticipants || 0,
            averageScore: totalQuizzes > 0 ? Math.round(totalScore / totalQuizzes) : 0,
        };

    } catch (error) {
        console.error("Error fetching system stats summary:", error);
        return { totalParticipants: 0, averageScore: 0 };
    }
}

export const updateSystemStatsAfterQuiz = async (newScore: number, isFirstAttempt: boolean) => {
    if (!db) return;
    const statsRef = doc(db, 'system_stats', 'summary');
    try {
        await runTransaction(db, async (transaction) => {
            const statsDoc = await transaction.get(statsRef);
            if (!statsDoc.exists()) {
                transaction.set(statsRef, {
                    totalScoreSum: newScore,
                    totalQuizCount: 1,
                    totalParticipants: 1
                });
            } else {
                transaction.update(statsRef, {
                    totalScoreSum: increment(newScore),
                    totalQuizCount: increment(1),
                    totalParticipants: isFirstAttempt ? increment(1) : increment(0)
                });
            }
        });
    } catch (e) {
        console.error("Stats update transaction failed: ", e);
    }
};

export const getCachedAnalysis = async (uid: string): Promise<CachedAnalysis | null> => {
    if (!db) return null;
    const analysisRef = doc(db, 'users', uid, 'analysis', 'latest');
    try {
        const docSnap = await getDoc(analysisRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                generatedAt: (data.generatedAt as Timestamp).toDate(),
            } as CachedAnalysis;
        }
    } catch (error) {
         console.error("Error fetching cached analysis:", error);
    }
    return null;
}

export const saveCachedAnalysis = async (uid: string, analysisData: Omit<CachedAnalysis, 'generatedAt' | 'id'>) => {
    if (!db) return;
    const analysisRef = doc(db, 'users', uid, 'analysis', 'latest');
    try {
        await setDoc(analysisRef, {
            ...analysisData,
            generatedAt: Timestamp.now()
        });
    } catch (error) {
         console.error("Error saving cached analysis:", error);
    }
}


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
        await setDoc(docRef, { ...quizItem, createdAt: Timestamp.now() });
    } catch (error) {
        console.error("Error saving pre-generated question:", error);
        throw error;
    }
};

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