
import { GoogleGenAI } from "@google/genai";

/**
 * 获取基于情境的破冰语
 */
export const getIceBreaker = async (myRole: string, targetRole: string, targetStatus: string) => {
  // 建议在调用时初始化以确保获取最新的 API 状态
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ 
        parts: [{ 
          text: `我是一名${myRole}，我想给附近的一位${targetRole}打个招呼，他现在的状态是“${targetStatus}”。请帮我写一段温暖、得体、无压力的打招呼话语（50字以内），用于发起线下见面的请求。` 
        }] 
      }],
      config: {
        systemInstruction: "你是一个温柔、充满同理心的患友互助助手，旨在帮助肿瘤患者及其家属建立联系。你的语言应该是克制而温暖的，避免任何医疗建议。",
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text?.trim() || "你好，看到你也在附近，如果方便的话，想简单交流一下经验。";
  } catch (error) {
    console.error("Gemini IceBreaker Error:", error);
    return "你好，看到你也在附近，方便聊聊吗？";
  }
};

/**
 * 获取每日鼓励语
 */
export const getDailyEncouragement = async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ 
        parts: [{ 
          text: "请为癌症患者或家属生成一句简短的每日鼓励语，字数在20字以内，不要说教，要充满力量和希望。" 
        }] 
      }],
      config: {
        temperature: 1,
        topP: 0.95,
      }
    });

    return response.text?.trim() || "每一个坚持的瞬间，都是生命的奇迹。";
  } catch (error) {
    console.error("Gemini Encouragement Error:", error);
    return "每一个坚持的瞬间，都是生命的奇迹。";
  }
};
