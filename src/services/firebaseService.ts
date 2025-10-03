import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, orderBy, limit, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuizItem, User, QuizResult, SystemStats } from "../types";

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], score: number) => {
    try {
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
    } catch (error) {
        console.error("Error saving quiz result to Firestore: ", error);
    }
};

export const getUserQuizResults = async (userId: string): Promise<QuizResult[]> => {
    try {
        const results: QuizResult[] = [];
        const q = query(
            collection(db, "quizResults"),
            where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() } as QuizResult);
        });

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

export const getSeenQuestionIds = async (userId: string): Promise<Set<string>> => {
    const seenIds = new Set<string>();
    const seenQuestionsCollection = collection(db, `users/${userId}/seenQuestions`);
    const snapshot = await getDocs(seenQuestionsCollection);
    snapshot.forEach(doc => seenIds.add(doc.id));
    return seenIds;
};

export const fetchBankQuestions = async (competencies: string[], count: number, seenIds: Set<string>): Promise<QuizItem[]> => {
    const questions: QuizItem[] = [];
    const questionsPerCompetency = Math.ceil(count / competencies.length);

    // Fetch questions for each competency
    for (const competency of competencies) {
        if (questions.length >= count) break;
        
        const q = query(
            collection(db, "preGeneratedQuestions"),
            where("competency", "==", competency),
            limit(30) // Fetch more to allow for client-side filtering
        );
        
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as QuizItem));
        const newQuestions = fetched.filter(item => item.id && !seenIds.has(item.id));
        
        questions.push(...newQuestions.slice(0, questionsPerCompetency));
    }
    
    // If not enough questions, fetch random ones to fill up
    if (questions.length < count) {
        const needed = count - questions.length;
        const fallbackQuery = query(collection(db, "preGeneratedQuestions"), limit(50));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackItems = fallbackSnapshot.docs
            .map(d => ({ ...d.data(), id: d.id } as QuizItem))
            .filter(item => item.id && !seenIds.has(item.id) && !questions.some(q => q.id === item.id));

        questions.push(...fallbackItems.slice(0, needed));
    }
    
    return questions.slice(0, count);
};

export const saveNewQuestions = async (questions: Omit<QuizItem, 'id'>[]): Promise<QuizItem[]> => {
    const batch = writeBatch(db);
    const savedQuestions: QuizItem[] = [];
    const statsUpdate: { [key: string]: any } = { total: increment(questions.length) };

    questions.forEach(question => {
        const docRef = doc(collection(db, "preGeneratedQuestions"));
        batch.set(docRef, question);
        savedQuestions.push({ ...question, id: docRef.id });

        const competencyKey = question.competency as keyof SystemStats;
        statsUpdate[competencyKey] = increment(1);
    });

    // Update stats
    const statsRef = doc(db, 'systemStats', 'counts');
    batch.update(statsRef, statsUpdate);

    await batch.commit();
    console.log(`${questions.length} new questions saved to bank and stats updated.`);
    return savedQuestions;
};

export const updateSeenQuestions = async (userId: string, questionIds: string[]) => {
    if (!userId || questionIds.length === 0) return;
    const batch = writeBatch(db);
    questionIds.forEach(id => {
        const docRef = doc(db, `users/${userId}/seenQuestions`, id);
        batch.set(docRef, { seenAt: serverTimestamp() });
    });
    await batch.commit();
};

export const getSystemStats = async (): Promise<SystemStats> => {
    const statsDocRef = doc(db, 'systemStats', 'counts');
    const statsDoc = await getDoc(statsDocRef);

    if (statsDoc.exists()) {
        return statsDoc.data() as SystemStats;
    } else {
        // Initialize if it doesn't exist
        const initialStats: SystemStats = {
            total: 0,
            지휘감독능력: 0,
            '책임감 및 적극성': 0,
            '관리자로서의 자세 및 청렴도': 0,
            '경영의식 및 혁신성': 0,
            '업무의 이해도 및 상황대응력': 0,
        };
        await setDoc(statsDocRef, initialStats);
        return initialStats;
    }
};

export const saveSingleQuestionToBank = async (question: QuizItem): Promise<void> => {
    const statsUpdate: { [key: string]: any } = { total: increment(1) };
    const competencyKey = question.competency as keyof SystemStats;
    statsUpdate[competencyKey] = increment(1);

    const batch = writeBatch(db);

    const questionRef = doc(collection(db, 'preGeneratedQuestions'));
    batch.set(questionRef, question);

    const statsRef = doc(db, 'systemStats', 'counts');
    batch.update(statsRef, statsUpdate);

    await batch.commit();
};