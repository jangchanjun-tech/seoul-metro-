import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuizItem, User } from "../types";

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], score: number) => {
    try {
        const timestamp = serverTimestamp();
        
        // 1. Save the main quiz result with user's name
        const quizResultsCollection = collection(db, "quizResults");
        await addDoc(quizResultsCollection, {
            userId: user.uid,
            userName: user.displayName, // Store user's name/nickname
            topic: topic,
            quizData: quizData,
            score: score,
            totalQuestions: quizData.length,
            createdAt: timestamp
        });
        console.log("Quiz result saved successfully!");

        // 2. Archive all generated questions to a separate collection for analysis
        const batch = writeBatch(db);
        const questionsCollection = collection(db, "generatedQuestions");

        quizData.forEach(question => {
            // FIX: To create a document reference with an auto-generated ID in Firestore v9,
            // you must use the `doc` function on the collection reference.
            const questionDocRef = doc(questionsCollection); // Auto-generate ID
            batch.set(questionDocRef, {
                ...question,
                createdAt: timestamp,
                createdBy: {
                    uid: user.uid,
                    name: user.displayName,
                }
            });
        });

        await batch.commit();
        console.log(`Archived ${quizData.length} questions to 'generatedQuestions' collection.`);

    } catch (error) {
        console.error("Error saving quiz result to Firestore: ", error);
    }
};