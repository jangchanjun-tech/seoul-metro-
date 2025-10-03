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
    // FIX: Corrected a syntax error in the catch block. It was missing curly braces and was improperly formatted.
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

export const fetchBankQuestions = async (competency: string, count: number, seenIds: Set<string>): Promise<QuizItem[]> => {
    try {
        const q = query(
            collection(db, "preGeneratedQuestions", competency, "questions"),
            limit(50) // 한 번에 충분한 양을 가져와 클라이언트에서 필터링
        );
        
        const snapshot = await getDocs(q);
        const allFetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as QuizItem));
        
        // 사용자가 보지 않은 문제만 필터링
        const unseenQuestions = allFetched.filter(item => item.id && !seenIds.has(item.id));
        
        // 만약 보지 않은 문제가 있다면, 랜덤하게 섞어서 필요한 만큼 반환
        if (unseenQuestions.length > 0) {
            for (let i = unseenQuestions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [unseenQuestions[i], unseenQuestions[j]] = [unseenQuestions[j], unseenQuestions[i]];
            }
            return unseenQuestions.slice(0, count);
        }
    
        // 보지 않은 문제가 없다면 빈 배열을 반환하여 100% 실시간 생성 모드로 유도
        return [];

    } catch (error) {
        console.error(`'${competency}' 역량의 문제 은행 호출 중 오류:`, error);
        // 오류 발생 시에도 빈 배열을 반환하여 앱 중단 방지
        return [];
    }
};


export const saveNewQuestions = async (questions: Omit<QuizItem, 'id'>[]): Promise<QuizItem[]> => {
    const batch = writeBatch(db);
    const savedQuestions: QuizItem[] = [];
    const statsUpdate: { [key: string]: any } = { total: increment(questions.length) };

    questions.forEach(question => {
        const docRef = doc(collection(db, "preGeneratedQuestions", question.competency, "questions"));
        batch.set(docRef, question);
        savedQuestions.push({ ...question, id: docRef.id });

        const competencyKey = question.competency as keyof SystemStats;
        statsUpdate[competencyKey] = increment(1);
    });

    const statsRef = doc(db, 'systemStats', 'counts');
    batch.update(statsRef, statsUpdate);

    await batch.commit();
    console.log(`${questions.length}개의 새 문제가 은행에 저장되고 통계가 업데이트되었습니다.`);
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

    const questionRef = doc(collection(db, 'preGeneratedQuestions', question.competency, 'questions'));
    batch.set(questionRef, question);

    const statsRef = doc(db, 'systemStats', 'counts');
    batch.update(statsRef, statsUpdate);

    await batch.commit();
};