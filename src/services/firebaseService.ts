// FIX: Updated imports to use Firebase v8 namespaced API to resolve module resolution errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../firebase/config';
import { QuizItem, User } from "../types";

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], score: number) => {
    if (!db) {
        console.error("Firestore is not initialized.");
        return;
    }
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        // 1. Save the main quiz result with user's name
        await db.collection("quizResults").add({
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
        const batch = db.batch();
        const questionsCollection = db.collection("generatedQuestions");

        quizData.forEach(question => {
            const questionDocRef = questionsCollection.doc(); // Auto-generate ID
            batch.set(questionDocRef, {
                // Spread the original quiz item
                ...question,
                // Add metadata
                createdAt: timestamp, // Date information
                // The "subject" is the competency
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
