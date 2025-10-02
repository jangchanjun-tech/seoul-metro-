import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from './firebaseConfig';
import { QuizItem } from "./types";

export const saveQuizResult = async (userId: string, topic: string, quizData: QuizItem[], score: number) => {
    if (!db) {
        console.error("Firestore is not initialized.");
        return;
    }
    try {
        await addDoc(collection(db, "quizResults"), {
            userId: userId,
            topic: topic,
            quizData: quizData,
            score: score,
            totalQuestions: quizData.length,
            createdAt: serverTimestamp()
        });
        console.log("Quiz result saved successfully!");
    } catch (error) {
        console.error("Error saving quiz result to Firestore: ", error);
    }
};
