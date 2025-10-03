// src/services/geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import { QuizItem, QuizResult, SystemStats, CompetencyAnalysis } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set. Please add it to your environment variables in your Vercel deployment settings.");
}

const ai = new GoogleGenAI({ apiKey });

export function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const quizItemSchema = {
    type: Type.OBJECT,
    properties: {
        competency: {
            type: Type.STRING,
            description: "이 문제가 평가하는 5가지 역량 과목 중 하나의 이름. 예: '지휘감독능력'",
        },
        passage: {
            type: Type.STRING,
            description: "600자에서 800자 사이의 한글 지문. 서울교통공사에서 발생할 수 있는 내부적, 외부적 상황을 다룸.",
        },
        question: {
            type: Type.STRING,
            description: "가장 적절한 행동 2가지를 선택하라는 질문.",
        },
        options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5개의 고유한 선택지 배열. 이 배열에는 최선, 차선, 최악 행동이 모두 포함되어야 함.",
        },
        bestAnswers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5개 선택지 중 2개의 '최선' 행동.",
        },
        secondBestAnswers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5개 선택지 중 2개의 '차선' 행동.",
        },
        worstAnswer: {
            type: Type.STRING,
            description: "5개 선택지 중 1개의 '최악' 행동.",
        },
        explanation: {
            type: Type.STRING,
            description: "5개 선택지 각각에 대해 왜 그것이 '최선', '차선', 또는 '최악'인지, 평가 역량과 연관지어 상세히 해설. 각 해설은 명확히 구분되어야 함."
        }
    },
    required: ["competency", "passage", "question", "options", "bestAnswers", "secondBestAnswers", "worstAnswer", "explanation"],
};

export const generateSingleQuiz = async (competency: string): Promise<QuizItem> => {
    try {
        const systemInstruction = `당신은 서울교통공사 3급 역량평가 시험의 상황판단문제를 출제하는 서울교통공사 내부의 최고 전문가입니다. 당신의 임무는 공사의 핵심가치(안전우선, 고객지향, 도전혁신, 지속경영)와 내부 규정 및 위기대응 매뉴얼에 입각하여, 응시자의 5가지 핵심 역량을 정확하게 측정할 수 있는 현실적이고 어려운 시나리오 기반 문제를 만드는 것입니다. 모든 정답(최선, 차선)은 반드시 서울교통공사가 공식적으로 요구하는 행동 기준에 부합해야 합니다. 문제 수준은 '고급' 또는 '상급'이어야 합니다.`;

        const prompt = `서울교통공사 3급 역량평가 대비 실전 모의고사를 생성해 주십시오. 아래의 모든 필수 조건을 반드시 엄격하게 준수해야 합니다.

### 문제 출제 필수 조건 ###
1.  **총 문제 수**: '${competency}' 역량에 대한 문제 정확히 1개만 생성합니다.
2.  **시험 과목**: 반드시 '${competency}' 역량을 평가하는 문제여야 합니다. 'competency' 필드에 '${competency}'를 정확히 기입하십시오.
3.  **문제 형식 및 난이도**:
    *   **지문 (난이도: 쉬움)**: 600자에서 800자 사이의 한글로 된, **어렵지 않은 평범한 업무 상황**을 제시합니다. 아래의 **세 가지 조건**을 반드시 반영하여 현실성을 극대화해야 합니다.
        1.  **다양한 직렬 및 부서**: 서울교통공사는 본사, 역무, 차량, 승무, 기술, 토목, 건축, 안전 등 다양한 직렬로 구성되어 있습니다. 특정 부서에만 국한되지 않는, 여러 부서가 협력하거나 갈등하는 복합적인 상황을 설정해 주십시오.
        2.  **내/외부 복합 상황**: 사내 문제(업무 갈등, 비효율 개선 등)뿐만 아니라, 외부 요인(기후변화로 인한 재난, 대규모 집회/축제, 예기치 못한 사고 등)과 연계된 상황을 제시하여 응시자의 종합적인 상황대응력을 평가할 수 있도록 해야 합니다.
        3.  **실제 사건 기반 시나리오**: 현실성을 높이기 위해, **과거 언론에 보도되었던 실제 지하철 사고나 사건을 모티브로** 시나리오를 구성할 수 있습니다. (예: 터널 내 열차 고장, 스크린도어 사고, 역사 내 화재 등)
    *   지문 자체는 전문 지식 없이 이해할 수 있도록 평이한 단어와 명확한 문장으로 서술해야 합니다.
    *   **질문**: 지문 마지막에 "이 상황에서 당신이 취할 가장 적절한 행동 2가지를 고르시오." 형식의 질문을 제시합니다.
    *   **선택지 (난이도: 어려움)**: 총 5개의 선택지를 제공하며, 응시자의 **상황판단력을 변별하기 위해 매우 어렵게** 구성해야 합니다.
        *   구성: '최선'(2개), '차선'(2개), '최악'(1개)
        *   핵심 조건 1: **'최악' 선택지는 최악처럼 보이지 않아야 합니다.** 즉, 표면적으로는 그럴듯하고 합리적인 행동처럼 보이지만, 실제로는 문제 해결에 도움이 되지 않거나 미묘하게 부정적인 결과를 초래하는 '매력적인 오답'으로 만들어야 합니다. 다른 선택지들도 정답과 오답의 경계가 모호하여 깊은 고민을 유발하도록 설계해야 합니다.
        *   **핵심 조건 2**: **모든 '최선'과 '차선' 선택지는 서울교통공사의 규정과 가치에 부합하는 가장 이상적인 행동이어야 합니다.** 특히 '안전'과 관련된 사안에서는 규정에 따른 절차적 정당성이 다른 가치보다 우선되어야 합니다.
4.  **JSON 출력 조건**:
    *   'options' 필드에는 5개 선택지가 모두 포함된 배열을 제공해야 합니다.
    *   'bestAnswers' 필드에는 2개의 '최선' 선택지를 담은 배열을 제공해야 합니다.
    *   'secondBestAnswers' 필드에는 2개의 '차선' 선택지를 담은 배열을 제공해야 합니다.
    *   'worstAnswer' 필드에는 1개의 '최악' 선택지를 담은 문자열을 제공해야 합니다.
    *   'explanation' 필드에는, 5개의 모든 선택지에 대해 각각 왜 '최선', '차선', 또는 '최악'인지, 평가하는 역량과 서울교통공사의 핵심가치를 연결하여 상세하게 해설해야 합니다. **각 선택지에 대한 해설은 명확하게 구분하여 작성해주십시오.**

이제, 위 모든 조건을 준수하여 새로운 문제를 생성해 주십시오.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: quizItemSchema,
                temperature: 0.9,
            },
        });

        const jsonText = response.text.trim();
        const quizData = JSON.parse(jsonText) as Omit<QuizItem, 'id'>;
        return { ...quizData, id: crypto.randomUUID() };

    } catch (error) {
        console.error(`'${competency}' 역량 문제 생성 중 오류:`, error);
        if (error instanceof Error) {
            throw new Error(`'${competency}' 역량 문제 생성에 실패했습니다: ${error.message}`);
        }
        throw new Error(`'${competency}' 역량 문제 생성 중 알 수 없는 오류가 발생했습니다.`);
    }
};

export const getAIVerification = async (quizItem: QuizItem): Promise<string> => {
    try {
        const { passage, question, bestAnswers, secondBestAnswers, worstAnswer, explanation, competency } = quizItem;
        const systemInstruction = `당신은 AI가 생성한 교육 콘텐츠를 검증하는 고도로 숙련된 품질 관리 전문가입니다. 당신의 목표는 객관적이고, 비판적인 시각으로 주어진 문제와 해설의 논리적 타당성, 일관성, 교육적 가치를 평가하는 것입니다.`;
        const prompt = `
            다음은 '서울교통공사 역량평가' 모의고사 문제입니다. 이 문제와 해설을 전문가의 입장에서 검증하고, 그 결과를 "AI 검증 결과"로 요약해 주십시오.

            ### 검증 대상 ###
            - **평가 역량**: ${competency}
            - **상황 지문**: ${passage}
            - **질문**: ${question}
            - **선택지 분류**:
              - 최선: ${bestAnswers.join(', ')}
              - 차선: ${secondBestAnswers.join(', ')}
              - 최악: ${worstAnswer}
            - **종합 해설**: ${explanation}

            ### 검증 및 결과 작성 가이드라인 ###
            1.  **핵심 검증 포인트**: 각 선택지의 '최선/차선/최악' 분류가 타당한지, 그리고 종합 해설이 각 선택지에 대한 설명을 논리적으로 잘 풀어내고 있는지 검증하십시오.
            2.  **결과 톤앤매너**: 간결하고 명확하게, 전문가적인 어조를 사용하십시오.
            3.  **결과 형식**: 최종 결과물은 한두 문장의 짧은 단락으로 구성되어야 합니다.
            
            이제, 위 내용에 대한 검증 결과를 작성해 주십시오.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.5,
            }
        });
        return response.text;
    } catch (error) {
        console.error("AI Verification 호출 중 오류 발생:", error);
        return "해설 검증 중 오류가 발생했습니다.";
    }
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        지휘감독능력: { type: Type.STRING },
        '책임감 및 적극성': { type: Type.STRING },
        '관리자로서의 자세 및 청렴도': { type: Type.STRING },
        '경영의식 및 혁신성': { type: Type.STRING },
        '업무의 이해도 및 상황대응력': { type: Type.STRING },
    },
    required: ['지휘감독능력', '책임감 및 적극성', '관리자로서의 자세 및 청렴도', '경영의식 및 혁신성', '업무의 이해도 및 상황대응력'],
};

export const generateCompetencyAnalysis = async (userResults: QuizResult[]): Promise<CompetencyAnalysis> => {
    const systemInstruction = `당신은 데이터 기반의 HR 역량 분석 전문가입니다. 당신의 임무는 응시자의 모의고사 결과를 분석하여, 5가지 핵심 역량에 대한 강점과 약점을 진단하고, 다른 응시자들과 비교하여 건설적인 피드백을 제공하는 것입니다. 분석은 반드시 데이터에 기반해야 하며, 긍정적이고 성장을 독려하는 어조를 사용해야 합니다.`;

    // 데이터 요약 및 가공
    const summary = userResults.flatMap(result =>
        result.quizData.map((item) => {
            const userAnswers = result.userAnswers ? result.userAnswers[item.id] : [];
            if (!userAnswers) return null;
            return {
                competency: item.competency,
                userChoices: userAnswers,
                best: item.bestAnswers,
                secondBest: item.secondBestAnswers,
                worst: item.worstAnswer,
            };
        }).filter(Boolean)
    ).slice(0, 30); // 너무 긴 프롬프트를 막기 위해 최근 30개 문제로 제한

    const prompt = `
        다음은 한 응시자의 서울교통공사 역량평가 모의고사 응시 기록 요약입니다. 이 데이터를 바탕으로, 각 5가지 핵심 역량에 대한 종합적인 상황판단 역량을 평가하고, 다른 응시자들과 비교 분석하여 결과를 제시해주십시오.

        ### 응시 기록 데이터 (${summary.length}개 문제) ###
        ${JSON.stringify(summary, null, 2)}

        ### 분석 및 결과 작성 가이드라인 ###
        1.  **종합 분석**: 각 역량에 대해, 응시자의 답변 패턴을 분석하십시오. (예: '최선'의 선택을 꾸준히 하는지, '최악'의 선택을 피하는 경향이 있는지, 특정 유형의 상황에서 강점/약점을 보이는지 등)
        2.  **비교 분석**: 분석 결과를 바탕으로, "다른 응시자들과 비교했을 때, ~한 경향을 보입니다." 와 같이 상대적인 위치를 언급해주십시오.
        3.  **결과 형식**: 최종 결과물은 5개 역량의 이름을 key로, 분석 내용을 value로 하는 JSON 객체여야 합니다. 각 분석 내용은 2~3문장의 완성된 단락으로 작성하십시오.

        이제, 위 모든 가이드라인을 준수하여 이 응시자에 대한 역량 분석 결과를 JSON 형식으로 작성해 주십시오.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as CompetencyAnalysis;
    } catch (error) {
        console.error("AI 역량 분석 생성 중 오류:", error);
        throw new Error("AI 역량 분석 리포트를 생성하는 데 실패했습니다.");
    }
};