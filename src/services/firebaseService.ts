import { db } from '../firebase/config';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    orderBy,
    Timestamp,
    getDoc,
    doc
} from "firebase/firestore";
import { QuizResult } from '../types';

// Omit 'id' when saving, as Firestore generates it.
export const saveQuizResult = async (result: Omit<QuizResult, 'id'>): Promise<string> => {
    if (!db) {
        throw new Error("Firestore is not initialized.");
    }

    // Convert Date to Firestore Timestamp for proper querying
    const resultWithTimestamp = {
        ...result,
        submittedAt: Timestamp.fromDate(result.submittedAt),
    };

    try {
        const docRef = await addDoc(collection(db, "quizResults"), resultWithTimestamp);
        return docRef.id;
    } catch (error) {
        console.error("Error adding document: ", error);
        throw new Error("Failed to save quiz result.");
    }
};

export const getUserQuizResults = async (userId: string): Promise<QuizResult[]> => {
    if (!db) {
        throw new Error("Firestore is not initialized.");
    }
    
    try {
        const q = query(
            collection(db, "quizResults"),
            where("userId", "==", userId),
            orderBy("submittedAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        const results: QuizResult[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            results.push({
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp back to JS Date
                submittedAt: (data.submittedAt as Timestamp).toDate(),
            } as QuizResult);
        });
        
        return results;
    } catch (error) {
        console.error("Error getting documents: ", error);
        throw new Error("Failed to fetch user quiz results.");
    }
};

export const getAllQuizResults = async (): Promise<QuizResult[]> => {
    if (!db) throw new Error("Firestore is not initialized.");
    try {
        const q = query(collection(db, "quizResults"));
        const querySnapshot = await getDocs(q);
        const results: QuizResult[] = [];
        querySnapshot.forEach((doc) => {
            results.push({
                id: doc.id,
                ...doc.data(),
                submittedAt: (doc.data().submittedAt as Timestamp).toDate(),
            } as QuizResult);
        });
        return results;
    } catch (error) {
        console.error("Error getting all quiz results:", error);
        throw new Error("Failed to fetch all quiz results.");
    }
};
