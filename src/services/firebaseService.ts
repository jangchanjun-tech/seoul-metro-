import { db } from '../firebase/config';
import { QuizResult, SystemStats } from '../types';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';

export const saveQuizResult = async (result: Omit<QuizResult, 'id'>): Promise<string> => {
    if (!db) {
        console.warn("Firestore is not initialized. Skipping save.");
        return "";
    }
    try {
        const docRef = await addDoc(collection(db, "quizResults"), result);
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
            orderBy("submittedAt", "desc"),
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Firestore timestamps need to be converted to JS Date objects
            const submittedAt = data.submittedAt instanceof Timestamp 
                ? data.submittedAt.toDate() 
                : new Date(data.submittedAt); // Fallback for serialized dates

            results.push({ 
                id: doc.id,
                ...data,
                submittedAt
            } as QuizResult);
        });
    } catch (error) {
        console.error("Error fetching user quiz results:", error);
    }
    return results;
};

export const getSystemStats = async (userId: string): Promise<SystemStats> => {
    if (!db) {
        console.warn("Firestore is not initialized. Cannot fetch stats.");
        return { totalParticipants: 0, averageScore: 0 };
    }

    let totalScore = 0;
    const userIds = new Set<string>();
    let userLatestScore: number | null = null;
    let allScores: number[] = [];

    try {
        const q = query(collection(db, "quizResults"), orderBy("submittedAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return { totalParticipants: 0, averageScore: 0 };
        }

        const userResultsForLatestScore = query(collection(db, "quizResults"), where("userId", "==", userId), orderBy("submittedAt", "desc"), limit(1));
        const userLatestSnapshot = await getDocs(userResultsForLatestScore);
        if(!userLatestSnapshot.empty) {
            userLatestScore = userLatestSnapshot.docs[0].data().score;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalScore += data.score;
            userIds.add(data.userId);
            allScores.push(data.score);
        });

        const averageScore = Math.round(totalScore / querySnapshot.size);
        const stats: SystemStats = {
            totalParticipants: userIds.size,
            averageScore,
        };

        if (userLatestScore !== null) {
            const usersBelow = allScores.filter(score => score < userLatestScore!).length;
            stats.percentile = Math.round((usersBelow / allScores.length) * 100);
        }

        return stats;
    } catch (error) {
        console.error("Error fetching system stats:", error);
        return { totalParticipants: 0, averageScore: 0 };
    }
};
