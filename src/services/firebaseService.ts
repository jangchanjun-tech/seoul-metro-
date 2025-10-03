import { collection, doc, getDocs, query, where, getDoc, setDoc, writeBatch, serverTimestamp, increment, runTransaction, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuizItem, User, QuizResult, SystemStats, OverallPerformanceStats, AnalysisCache } from "../types";

const COMPETENCIES = ["지휘감독능력", "책임감 및 적극성", "관리자로서의 자세 및 청렴도", "경영의식 및 혁신성", "업무의 이해도 및 상황대응력"];

export const saveQuizResult = async (user: User, topic: string, quizData: QuizItem[], userAnswers: Record<string, string[]>, score: number) => {
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
            quizData.forEach((item) => {
                const competency = item.competency;
                if (!competencyScores[competency]) {
                    competencyScores[competency] = { score: 0, count: 0 };
                }
                
                let totalPoints = 0;
                const maxPointsPerQuestion = 6;
                const userSelection = userAnswers[item.id] || [];
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
        
        const unseenQuestions = allFetched.filter(item => item.id && !seenIds.has(item.id));
        
        if (unseenQuestions.length > 0) {
            for (let i = unseenQuestions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [unseenQuestions[i], unseenQuestions[j]] = [unseenQuestions[j], unseenQuestions[i]];
            }
            return unseenQuestions.slice(0, count);
        }
    
        return [];

    } catch (error) {
        console.error(\`'\${competency}' 역량의 문제 은행 호출 중 오류:\`, error);
        return [];
    }
};

export const fetchInitialBankSet = async (competencies: string[], seenIds: Set<string>): Promise<QuizItem[]> => {
    const fetchPromises = competencies.map(competency => 
        fetchBankQuestions(competency, 1, seenIds)
    );
    const questionsPerCompetency = await Promise.all(fetchPromises);
    return questionsPerCompetency.flat();
};


export const saveNewQuestions = async (questions: QuizItem[]): Promise<void> => {
    const batch = writeBatch(db);
    const competencyCounts: { [key: string]: number } = {};

    questions.forEach(question => {
        // We remove the client-side ID before saving to avoid confusion,
        // letting Firestore generate its own unique document ID.
        const { id, ...questionData } = question;
        const docRef = doc(collection(db, "preGeneratedQuestions", question.competency, "questions"));
        batch.set(docRef, questionData);

        // Count occurrences of each competency to perform a single increment operation later.
        competencyCounts[question.competency] = (competencyCounts[question.competency] || 0) + 1;
    });

    // Prepare the stats update object.
    const statsUpdate: { [key: string]: any } = { total: increment(questions.length) };
    for (const competency in competencyCounts) {
        statsUpdate[competency] = increment(competencyCounts[competency]);
    }

    const statsRef = doc(db, 'systemStats', 'counts');
    batch.set(statsRef, statsUpdate, { merge: true });

    await batch.commit();
    console.log(\`\${questions.length}개의 새 문제가 은행에 저장되고 통계가 업데이트되었습니다.\`);
};

export const updateSeenQuestions = async (userId: string, questionIds: string[]) => {
    if (!userId || questionIds.length === 0) return;
    const batch = writeBatch(db);
    questionIds.forEach(id => {
        const docRef = doc(db, \`users/\${userId}/seenQuestions\`, id);
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
    
    const { id, ...questionData } = question;
    const questionRef = doc(collection(db, 'preGeneratedQuestions', question.competency, 'questions'));
    batch.set(questionRef, questionData);

    const statsRef = doc(db, 'systemStats', 'counts');
    batch.set(statsRef, statsUpdate, { merge: true });

    await batch.commit();
};

export const getAnalysisCache = async (userId: string): Promise<AnalysisCache | null> => {
    try {
        const cacheRef = doc(db, \`users/\${userId}/analysis/summary\`);
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
        const cacheRef = doc(db, \`users/\${userId}/analysis/summary\`);
        await setDoc(cacheRef, cacheData);
        console.log("AI analysis cache saved successfully.");
    } catch (error) {
        console.error("Error saving analysis cache:", error);
    }
};

export const getUserData = async (userId: string): Promise<Partial<User>> => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
        return userDoc.data() as Partial<User>;
    }
    return {};
};

export const incrementUserGenerationCount = async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    try {
        await setDoc(userRef, { generationCount: increment(1) }, { merge: true });
    } catch (e) {
        console.error("Failed to increment generation count:", e);
    }
};