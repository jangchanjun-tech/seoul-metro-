import { GoogleGenAI, Type } from "@google/genai";
import { QuizItem } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const quizSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        passage: {
          type: Type.STRING,
          description: "600자에서 800자 사이의 한글 지문입니다.",
        },
        question: {
          type: Type.STRING,
          description: "가장 적절한 행동 2가지를 선택하라는 질문입니다.",
        },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "5개의 선택지입니다. (최선 2개, 차선 2개, 최악 1개로 구성)",
        },
        bestAnswers: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "2개의 '최선' 답변입니다.",
        },
        explanation: {
          type: Type.STRING,
          description: "최선 답변 2가지에 대한 상세한 해설입니다."
        }
      },
      required: ["passage", "question", "options", "bestAnswers", "explanation"],
    },
};


export const generateQuiz = async (topic: string): Promise<QuizItem[]> => {
    try {
        const prompt = `'${topic}'에 대한 상황판단문제 1개를 생성해줘. 다음 요구사항을 반드시 지켜줘:
1. 600자에서 800자 사이의 한글 지문을 만들어줘.
2. 지문과 관련된 상황과 함께, 가장 적절한 행동 2가지를 선택하라는 질문을 만들어줘.
3. 5개의 선택지를 만들어줘.
4. 5개의 선택지는 '최선'의 행동 2개, '차선'의 행동 2개, '최악'의 행동 1개로 구성되어야 해.
5. JSON 출력 시 'bestAnswers' 필드에 '최선'의 행동 2개의 내용을 정확히 포함해줘.
6. 정답(최선 2가지)에 대한 상세한 해설을 포함해줘.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        const quizData = JSON.parse(jsonText) as QuizItem[];
        
        // Basic validation
        if (!Array.isArray(quizData) || quizData.length === 0) {
            throw new Error("AI가 유효한 퀴즈 데이터를 생성하지 못했습니다.");
        }

        return quizData;

    } catch (error) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        if (error instanceof Error) {
            throw new Error(`퀴즈 생성에 실패했습니다: ${error.message}`);
        }
        throw new Error("알 수 없는 오류로 퀴즈 생성에 실패했습니다.");
    }
};
