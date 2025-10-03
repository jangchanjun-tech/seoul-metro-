import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuizItem, User, QuizResult } from "../types";

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], score: number) => {
    try {
        // 1. Save the main quiz result
        const quizResultsCollection = collection(db, "quizResults");
        await addDoc(quizResultsCollection, {
            userId: user.uid,
            userName: user.displayName,
            topic: topic,
            quizData: quizData,
            score: score,
            totalQuestions: quizData.length,
            createdAt: serverTimestamp()
        });
        console.log("Quiz result saved successfully!");

        // 2. Archive all generated questions into competency-specific subcollections
        const batch = writeBatch(db);

        quizData.forEach(question => {
            // Path to the competency document e.g. /generatedQuestions/지휘감독능력
            const competencyDocRef = doc(db, "generatedQuestions", question.competency);

            // Ensure the competency document exists. Using { merge: true } prevents
            // overwriting if other metadata is added later. This makes the structure robust.
            batch.set(competencyDocRef, {
                name: question.competency,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            // Path to a new document in the subcollection e.g. /generatedQuestions/지휘감독능력/questions/<auto-id>
            const questionDocRef = doc(collection(competencyDocRef, 'questions'));

            batch.set(questionDocRef, {
                ...question,
                createdAt: serverTimestamp(),
                createdBy: {
                    uid: user.uid,
                    name: user.displayName,
                }
            });
        });

        await batch.commit();
        console.log(`Archived ${quizData.length} questions to competency-specific subcollections.`);

    } catch (error) {
        console.error("Error saving quiz result to Firestore: ", error);
    }
};

// New function to fetch a specific user's quiz results
export const getUserQuizResults = async (userId: string): Promise<QuizResult[]> => {
    try {
        const results: QuizResult[] = [];
        // FIX: Removed orderBy from the query to prevent composite index errors.
        // Sorting will be handled on the client side after fetching.
        const q = query(
            collection(db, "quizResults"),
            where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() } as QuizResult);
        });

        // Sort results by date on the client side
        results.sort((a, b) => {
            if (a.createdAt && b.createdAt) {
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            }
            return 0;
        });

        return results;
    } catch (error) {
        console.error("Error fetching user quiz results:", error);
        throw new Error("시험 결과를 불러오는 데 실패했습니다.");
    }
};

// New function to fetch all quiz results for ranking
export const getAllQuizResults = async (): Promise<QuizResult[]> => {
    try {
        const results: QuizResult[] = [];
        const querySnapshot = await getDocs(collection(db, "quizResults"));
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() } as QuizResult);
        });
        return results;
    } catch (error) {
        console.error("Error fetching all quiz results:", error);
        throw new Error("전체 시험 결과를 불러오는 데 실패했습니다.");
    }
};