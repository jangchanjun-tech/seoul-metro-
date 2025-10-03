import { GoogleGenAI, Type } from "@google/genai";
import { QuizItem } from '../types';

// FIX: Vercel/Vite 환경에서 환경 변수를 올바르게 읽기 위해 `import.meta.env`를 사용합니다.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set. Please add it to your environment variables in your Vercel deployment settings.");
}

const ai = new GoogleGenAI({ apiKey });

function shuffleArray<T>(array: T[]): T[] {
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
        items: {
        type: Type.STRING,
        },
        description: "5개의 선택지. (최선 2개, 차선 2개, 최악 1개로 구성)",
    },
    bestAnswers: {
        type: Type.ARRAY,
        items: {
        type: Type.STRING,
        },
        description: "2개의 '최선' 행동.",
    },
    explanation: {
        type: Type.STRING,
        description: "최선 답변 2가지가 왜 정답인지 해당 역량과 연관지어 상세히 해설."
    }
    },
    required: ["competency", "passage", "question", "options", "bestAnswers", "explanation"],
};

const quizSetSchema = {
    type: Type.ARRAY,
    items: quizItemSchema,
};

export const generateQuizSetStream = async function* (competencies: string[]): AsyncGenerator<QuizItem> {
    try {
        const systemInstruction = `당신은 서울교통공사 3급 역량평가 시험의 상황판단문제를 출제하는 전문 출제위원입니다. 당신의 임무는 서울교통공사의 핵심가치(안전우선, 고객지향, 도전혁신, 지속경영)를 바탕으로, 응시자의 5가지 핵심 역량을 정확하게 측정할 수 있는 현실적이고 어려운 시나리오 기반 문제를 만드는 것입니다. 문제 수준은 반드시 '고급' 또는 '상급'이어야 합니다.`;

        const prompt = `서울교통공사 3급 역량평가 대비 실전 모의고사를 생성해 주십시오. 아래의 모든 필수 조건을 반드시 엄격하게 준수해야 합니다.

### 문제 출제 필수 조건 ###
1.  **총 문제 수**: 다음 목록에 있는 각 역량에 대해 정확히 하나씩, 총 ${competencies.length}개의 문제를 생성해야 합니다: [${competencies.join(', ')}].
2.  **시험 과목**: 각 문제는 할당된 역량을 평가해야 합니다. 'competency' 필드에 해당 역량의 이름을 정확히 기입하십시오.
3.  **문제 형식**:
    *   **지문**: 600자에서 800자 사이의 한글로 된 구체적인 상황을 제시합니다. 사내 상황(업무 갈등, 비효율 개선 등)과 외부 환경(기후변화로 인한 재난, 대규모 집회/축제, 예기치 못한 사고 등)을 복합적으로 다루어 현실성을 높여야 합니다.
    *   **질문**: 지문 마지막에 "이 상황에서 당신이 취할 가장 적절한 행동 2가지를 고르시오." 형식의 질문을 제시합니다.
    *   **선택지**: 총 5개의 선택지를 제공하며, '최선'(2개), '차선'(2개), '최악'(1개)으로 구성되어야 합니다. 최악 선택지는 표면적으로 그럴듯해 보이는 '정답 같은 오답'이어야 합니다.
4.  **JSON 출력 조건**:
    *   최종 결과는 ${competencies.length}개의 문제 객체를 포함하는 단일 JSON 배열이어야 합니다.
    *   'bestAnswers' 필드에는 2개의 '최선' 선택지의 내용을 정확히 기입해야 합니다.
    *   'explanation' 필드에는 왜 그 2가지 행동이 최선인지, 평가하는 역량과 서울교통공사의 핵심가치를 연결하여 상세하게 해설해야 합니다.

이제, 위 모든 조건을 준수하여 ${competencies.length}개의 문제로 구성된 완전한 모의고사 세트를 생성해 주십시오.`;

        const response = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: quizSetSchema,
                temperature: 0.8,
            },
        });

        let buffer = '';
        let objectStartIndex = -1;

        for await (const chunk of response) {
            buffer += chunk.text;

            while (true) {
                objectStartIndex = buffer.indexOf('{');
                if (objectStartIndex === -1) {
                    break;
                }

                let braceCount = 0;
                let objectEndIndex = -1;

                for (let i = objectStartIndex; i < buffer.length; i++) {
                    if (buffer[i] === '{') {
                        braceCount++;
                    } else if (buffer[i] === '}') {
                        braceCount--;
                    }
                    if (braceCount === 0) {
                        objectEndIndex = i;
                        break;
                    }
                }

                if (objectEndIndex !== -1) {
                    const objectStr = buffer.substring(objectStartIndex, objectEndIndex + 1);
                    try {
                        const quizItem = JSON.parse(objectStr) as QuizItem;
                        yield { ...quizItem, options: shuffleArray(quizItem.options) };
                        buffer = buffer.slice(objectEndIndex + 1);
                    } catch (e) {
                        console.error("Failed to parse JSON object from stream, skipping:", objectStr, e);
                        buffer = buffer.slice(objectEndIndex + 1);
                    }
                } else {
                    break;
                }
            }
        }

    } catch (error) {
        console.error(`퀴즈 세트 스트리밍 중 오류:`, error);
        if (error instanceof Error) {
            throw new Error(`퀴즈 생성에 실패했습니다: ${error.message}`);
        }
        throw new Error("알 수 없는 오류로 퀴즈 생성에 실패했습니다.");
    }
};

const verificationResultSchema = {
    type: Type.OBJECT,
    properties: {
        index: { type: Type.NUMBER },
        result: { type: Type.STRING },
    },
    required: ["index", "result"],
};

const verificationSetSchema = {
    type: Type.ARRAY,
    items: verificationResultSchema,
};

export const getAIVerificationStream = async function* (quizItems: QuizItem[]): AsyncGenerator<{index: number, result: string}> {
    try {
        const systemInstruction = `당신은 AI가 생성한 교육 콘텐츠를 검증하는 고도로 숙련된 품질 관리 전문가입니다. 당신의 목표는 객관적이고, 비판적인 시각으로 주어진 문제와 해설의 논리적 타당성, 일관성, 교육적 가치를 평가하는 것입니다.`;
        
        const problemsToVerify = quizItems.map((item, index) => `
            ### 검증 대상 ${index + 1} (index: ${index}) ###
            - **평가 역량**: ${item.competency}
            - **상황 지문**: ${item.passage}
            - **질문**: ${item.question}
            - **제시된 정답 (최선 행동 2가지)**: 
              1. ${item.bestAnswers[0]}
              2. ${item.bestAnswers[1]}
            - **정답 해설**: ${item.explanation}
        `).join('\n\n');

        const prompt = `
            다음은 '서울교통공사 역량평가' 모의고사 문제 ${quizItems.length}개입니다. 각 문제와 해설을 전문가의 입장에서 검증하고, 그 결과를 "AI 검증 결과"로 요약해 주십시오.

            ${problemsToVerify}

            ### 검증 및 결과 작성 가이드라인 ###
            1.  **핵심 검증 포인트**: 각 문제에 대해, 정답으로 제시된 행동 2가지가 주어진 상황에서 정말 '최선'인지, 그리고 해설이 그 이유를 '평가 역량'과 논리적으로 잘 연결하여 설명하고 있는지 검증하십시오.
            2.  **결과 톤앤매너**: 간결하고 명확하게, 전문가적인 어조를 사용하십시오.
            3.  **결과 형식**: 최종 결과물은 각 문제의 'index'와 검증 결과를 담은 'result' 필드를 포함하는 JSON 객체들의 배열이어야 합니다. 각 'result'는 한두 문장의 짧은 단락으로 구성되어야 합니다.
            
            이제, 위 모든 내용에 대한 검증 결과를 JSON 배열 형식으로 작성해 주십시오.
        `;

        const response = await ai.models.generateContentStream({
            model: "gem-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.5,
                responseMimeType: "application/json",
                responseSchema: verificationSetSchema,
            }
        });

        let buffer = '';
        let objectStartIndex = -1;

        for await (const chunk of response) {
            buffer += chunk.text;

            while (true) {
                objectStartIndex = buffer.indexOf('{');
                if (objectStartIndex === -1) {
                    break;
                }

                let braceCount = 0;
                let objectEndIndex = -1;
                for (let i = objectStartIndex; i < buffer.length; i++) {
                    if (buffer[i] === '{') braceCount++;
                    else if (buffer[i] === '}') braceCount--;
                    if (braceCount === 0) {
                        objectEndIndex = i;
                        break;
                    }
                }

                if (objectEndIndex !== -1) {
                    const objectStr = buffer.substring(objectStartIndex, objectEndIndex + 1);
                    try {
                        const verificationItem = JSON.parse(objectStr) as { index: number; result: string };
                        yield verificationItem;
                        buffer = buffer.slice(objectEndIndex + 1);
                    } catch (e) {
                        console.error("스트림에서 검증 JSON 객체 파싱 실패, 건너뜁니다:", objectStr, e);
                        buffer = buffer.slice(objectEndIndex + 1);
                    }
                } else {
                    break;
                }
            }
        }

    } catch (error) {
        console.error("AI 검증 세트 스트림 호출 실패:", error);
        throw new Error("AI 검증 중 오류가 발생했습니다.");
    }
};