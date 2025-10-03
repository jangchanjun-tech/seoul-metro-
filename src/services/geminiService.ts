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

const questionArchetypes = [
    {
        name: "전문적 딜레마 (Professional Dilemma)",
        instruction: `**문제 유형: 전문적 딜레마**
응시자가 두 가지 이상의 상충하는 가치나 책임 사이에서 어려운 결정을 내려야 하는 상황을 제시합니다. (예: 개인의 사생활 vs. 조직의 긴급한 요구, 단기적 성과 vs. 장기적 관계, 원칙 준수 vs. 유연한 대응). 지문은 개인적, 조직적 갈등을 중심으로 서술하고, 선택지는 이러한 딜레마를 해결하기 위한 다양한 접근 방식을 제시해야 합니다.`
    },
    {
        name: "문서 분석 및 적용 (Document Analysis & Application)",
        instruction: `**문제 유형: 문서 분석 및 적용**
지문에 짧은 가상의 문서(예: **뉴스 기사, 정부 정책 발표문, 경영 이론 요약, 사내 공지, 고객 민원 이메일, 신규 사업 계획서 요약, 안전 규정 일부**)를 포함시킵니다. 질문은 응시자가 해당 문서의 핵심 내용을 정확히 **이해하고**, 그 정보를 바탕으로 **관리자로서 가장 적절한 후속 조치를 판단**하는 능력을 평가해야 합니다. 선택지는 문서의 내용을 잘못 해석했거나, 중요도를 잘못 판단한 행동을 포함해야 합니다.`
    },
    {
        name: "리더십 및 관리 챌린지 (Leadership/Management Challenge)",
        instruction: `**문제 유형: 리더십 및 관리 챌린지**
팀 관리 상황에 초점을 맞춥니다. (예: 팀원 간의 갈등 중재, **성과가 저조하거나 번아웃된 팀원 면담 및 동기부여**, 새로운 업무 방식 도입에 대한 팀원들의 저항 관리, 부서 간의 비협조적인 문제 해결). 질문은 리더로서 이 상황을 어떻게 해결할 것인지를 묻고, 선택지는 다양한 리더십 스타일(예: 지시적, 위임적, 민주적, 설득적)을 반영해야 합니다.`
    },
    {
        name: "전략적 우선순위 설정 (Strategic Prioritization)",
        instruction: `**문제 유형: 전략적 우선순위 설정**
응시자에게 여러 가지 중요하고 긴급한 업무가 동시에 주어지는 상황을 제시합니다. (예: 상급자의 긴급 지시, 예정된 중요 회의, 임박한 보고서 마감, 갑작스러운 현장 민원 발생). 질문은 이 상황에서 업무를 어떤 순서로, 어떤 방식으로 처리할 것인지를 묻습니다. 선택지는 다양한 업무 처리 순서와 위임 방안을 포함하여, 응시자의 시간 관리 및 전략적 사고 능력을 평가해야 합니다.`
    }
];

export const generateSingleQuiz = async (competency: string): Promise<QuizItem> => {
    try {
        const systemInstruction = `당신은 서울교통공사 3급 역량평가 시험의 상황판단문제를 출제하는 서울교통공사 내부의 최고 전문가입니다. 당신의 임무는 공사의 핵심가치(안전우선, 고객지향, 도전혁신, 지속경영)와 내부 규정 및 위기대응 매뉴얼에 입각하여, 응시자의 5가지 핵심 역량을 정확하게 측정할 수 있는 현실적이고 어려운 시나리오 기반 문제를 만드는 것입니다. 모든 정답(최선, 차선)은 반드시 서울교통공사가 공식적으로 요구하는 행동 기준에 부합해야 합니다. 문제 수준은 '고급' 또는 '상급'이어야 합니다.`;
        
        const selectedArchetype = questionArchetypes[Math.floor(Math.random() * questionArchetypes.length)];

        const prompt = `서울교통공사 3급 역량평가 대비 실전 모의고사를 생성해 주십시오. 아래의 모든 필수 조건을 반드시 엄격하게 준수해야 합니다.

### 문제 출제 필수 조건 ###
1.  **총 문제 수**: '${competency}' 역량에 대한 문제 정확히 1개만 생성합니다.
2.  **시험 과목**: 반드시 '${competency}' 역량을 평가하는 문제여야 합니다. 'competency' 필드에 '${competency}'를 정확히 기입하십시오.
3.  **문제 유형**: 다음 '${selectedArchetype.name}' 유형의 문제를 출제해야 합니다.
    ${selectedArchetype.instruction}
4.  **주제 확장**: 문제 상황은 단순히 역사 내 시설 고장이나 열차 운행 문제에만 국한되지 않도록 하십시오. 다음의 다양하고 현실적인 주제를 적극적으로 활용하여 문제의 폭을 넓혀 주십시오.
    *   **인사/조직 관리**: 팀원 갈등, 성과 관리, **직원 번아웃 및 동기부여 문제**, 조직 문화, 부서 이기주의.
    *   **경영/기획/홍보**: 신규 사업 타당성 검토, 예산 배정 관련 갈등, 대외 기관 협력 및 계약 문제, **회사 이미지 관련 언론 대응 및 위기관리**.
    *   **정부 정책 및 공공사업**: **GTX 노선 확장, 무임승차 손실 보전 문제, 지역사회와의 갈등이 있는 공공사업(예: 케이블카, 차량기지 이전)** 등 실제 현안 기반 시나리오.
    *   **고객 서비스**: 악성 민원 대응, 서비스 품질 개선 방안, 고객 데이터 기반 정책 수립.
    *   **윤리/청렴**: 불공정한 업무 지시, 내외부 청탁 및 압력, 예산의 부적절한 사용 의심 상황.
    *   **이론의 실제 적용**: **변혁적 리더십, 공정성 이론**과 같은 경영/리더십 이론을 제시하고, 이를 실제 업무 상황에 적용해보는 시나리오.
5.  **문제 형식 및 난이도 (핵심 원칙: 지문은 쉽게, 선택지는 어렵게)**:
    *   **지문 (난이도: 쉬움)**: 600자에서 800자 사이의 한글로 된, **어렵지 않은 평범한 업무 상황**을 제시합니다. 응시자가 상황을 이해하는 데 어려움이 없도록, 전문 용어를 최소화하고 평이한 단어와 명확한 문장으로 서술해야 합니다. **핵심은 상황 자체의 복잡성이 아니라, 그 상황 속에서의 '판단'을 어렵게 만드는 것입니다.**
    *   **질문**: 지문 마지막에 "이 상황에서 당신이 취할 가장 적절한 행동 2가지를 고르시오." 형식의 질문을 제시합니다.
    *   **선택지 (난이도: 매우 어려움)**: 총 5개의 선택지를 제공하며, 응시자의 **정교한 상황판단력을 변별하기 위해 의도적으로 매우 어렵게** 구성해야 합니다. 난이도는 복잡한 어휘가 아닌, **판단의 우선순위와 미묘한 결과의 차이**에서 비롯되어야 합니다.
        *   구성: '최선'(2개), '차선'(2개), '최악'(1개)
        *   **핵심 조건 1 (매력적인 오답)**: **'최악' 선택지는 절대로 명백한 오답처럼 보이면 안 됩니다.** 표면적으로는 매우 합리적이고 그럴듯한 행동처럼 보이지만, 실제로는 서울교통공사의 핵심 가치(특히 안전)를 간과하거나, 절차를 무시하거나, 장기적으로 더 큰 문제를 야기하는 '함정 선택지'로 만들어야 합니다.
        *   **핵심 조건 2 (모호함)**: **'최선'과 '차선'의 경계가 뚜렷하지 않아 깊은 고민을 유발하도록 설계해야 합니다.** 예를 들어, '차선'은 단기적으로 효과적이지만 근본적인 해결책이 아니거나, '최선'은 절차적으로 더 올바르지만 즉각적인 효과는 덜해 보이는 행동일 수 있습니다.
        *   **핵심 조건 3 (규정 준수)**: **모든 '최선'과 '차선' 선택지는 서울교통공사의 규정과 가치에 부합하는 가장 이상적인 행동이어야 합니다.** 특히 '안전'과 관련된 사안에서는 규정에 따른 절차적 정당성이 다른 가치보다 항상 우선되어야 합니다.
6.  **JSON 출력 조건**:
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
        
        // FIX: Add a check to ensure the parsed quizData is not null or undefined.
        // This ensures the function always returns a valid QuizItem or throws an error,
        // satisfying the TypeScript compiler and fixing the "must return a value" error.
        if (quizData) {
            return { ...quizData, id: crypto.randomUUID() };
        }
        throw new Error("Failed to parse quiz data from AI response.");

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
        // FIX: Add a check to ensure the parsed analysisData is not null or undefined.
        // This ensures the function always returns a valid CompetencyAnalysis or throws an error.
        const analysisData = JSON.parse(jsonText) as CompetencyAnalysis;
        if (analysisData) {
            return analysisData;
        }
        throw new Error("Failed to parse analysis data from AI response.");
    } catch (error) {
        console.error("AI 역량 분석 생성 중 오류:", error);
        throw new Error("AI 역량 분석 리포트를 생성하는 데 실패했습니다.");
    }
};
