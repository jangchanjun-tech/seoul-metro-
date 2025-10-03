import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, limit, getDoc, setDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuizItem, User, QuizResult, SystemStats, OverallPerformanceStats, AnalysisCache } from "../types";

const COMPETENCIES = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], userAnswers: Record<number, string[]>, score: number) => {
    try {
        const statsRef = doc(db, "performanceStats", "summary");
        const resultRef = doc(collection(db, "quizResults"));

        await runTransaction(db, async (transaction) => {
            // 1. Get the current overall performance stats
            const statsDoc = await transaction.get(statsRef);
            let currentStats: OverallPerformanceStats = {};
            if (statsDoc.exists()) {
                currentStats = statsDoc.data() as OverallPerformanceStats;
            } else {
                // Initialize if it doesn't exist
                COMPETENCIES.forEach(c => {
                    currentStats[c] = { totalScore: 0, attemptCount: 0 };
                });
            }
            
            // 2. Calculate scores for the new result by competency
            const competencyScores: { [key: string]: { score: number, count: number } } = {};
            quizData.forEach((item, index) => {
                const competency = item.competency;
                if (!competencyScores[competency]) {
                    competencyScores[competency] = { score: 0, count: 0 };
                }
                
                let totalPoints = 0;
                const maxPointsPerQuestion = 6;
                const userSelection = userAnswers[index] || [];
                userSelection.forEach(answer => {
                    if (item.bestAnswers.includes(answer)) totalPoints += 3;
                    else if (item.secondBestAnswers.includes(answer)) totalPoints += 2;
                    else if (item.worstAnswer === answer) totalPoints += 1;
                });
                const questionScore = Math.round((totalPoints / maxPointsPerQuestion) * 100);

                competencyScores[competency].score += questionScore;
                competencyScores[competency].count += 1;
            });
            
            // 3. Update the overall stats
            for (const competency in competencyScores) {
                if (!currentStats[competency]) {
                     currentStats[competency] = { totalScore: 0, attemptCount: 0 };
                }
                const avgScoreForQuiz = competencyScores[competency].score / competencyScores[competency].count;
                currentStats[competency].totalScore += avgScoreForQuiz;
                currentStats[competency].attemptCount += 1;
            }

            // 4. Save the user's result and the updated stats
            transaction.set(resultRef, {
                userId: user.uid,
                userName: user.displayName,
                topic: topic,
                quizData: quizData,
                userAnswers: userAnswers,
                score: score,
                totalQuestions: quizData.length,
                createdAt: serverTimestamp()
            });
            
            transaction.set(statsRef, currentStats);
        });

        console.log("시험 결과 및 전체 통계가 성공적으로 업데이트되었습니다!");

    } catch (error) {
        console.error("시험 결과 저장 및 통계 업데이트 중 오류 발생: ", error);
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

export const getOverallPerformanceStats = async (): Promise<OverallPerformanceStats | null> => {
    try {
        const statsRef = doc(db, "performanceStats", "summary");
        const statsDoc = await getDoc(statsRef);
        if (statsDoc.exists()) {
            return statsDoc.data() as OverallPerformanceStats;
        }
        return null;
    } catch (error) {
        console.error("Error fetching overall performance stats:", error);
        throw new Error("전체 사용자 통계 데이터를 불러오는 데 실패했습니다.");
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
            limit(20) // Optimized: Reduced from 50 to 20 to speed up fetch time.
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
        if (!statsUpdate[competencyKey]) statsUpdate[competencyKey] = increment(0);
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
    // Ensure the stats doc exists before updating
    const statsDoc = await getDoc(statsRef);
    if(statsDoc.exists()){
        batch.update(statsRef, statsUpdate);
    } else {
        batch.set(statsRef, {
            total: 1,
            지휘감독능력: competencyKey === '지휘감독능력' ? 1 : 0,
            '책임감 및 적극성': competencyKey === '책임감 및 적극성' ? 1 : 0,
            '관리자로서의 자세 및 청렴도': competencyKey === '관리자로서의 자세 및 청렴도' ? 1 : 0,
            '경영의식 및 혁신성': competencyKey === '경영의식 및 혁신성' ? 1 : 0,
            '업무의 이해도 및 상황대응력': competencyKey === '업무의 이해도 및 상황대응력' ? 1 : 0,
        });
    }


    await batch.commit();
};

export const getAnalysisCache = async (userId: string): Promise<AnalysisCache | null> => {
    try {
        const cacheRef = doc(db, `users/${userId}/analysis/summary`);
        const cacheDoc = await getDoc(cacheRef);
        if (cacheDoc.exists()) {
            return cacheDoc.data() as AnalysisCache;
        }
        return null;
    } catch (error) {
        console.error("Error fetching analysis cache:", error);
        return null; // Return null on error, don't throw
    }
};

export const saveAnalysisCache = async (userId: string, cacheData: AnalysisCache): Promise<void> => {
    try {
        const cacheRef = doc(db, `users/${userId}/analysis/summary`);
        await setDoc(cacheRef, cacheData);
        console.log("AI analysis cache saved successfully.");
    } catch (error) {
        console.error("Error saving analysis cache:", error);
    }
};