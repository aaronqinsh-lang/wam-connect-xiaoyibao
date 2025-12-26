
import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI SDK using the API_KEY environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getIceBreaker = async (myRole: string, targetRole: string, targetStatus: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `我是一名${myRole}，我想给附近的一位${targetRole}打个招呼，他现在的状态是“${targetStatus}”。请帮我写一段温暖、得体、无压力的打招呼话语（50字以内），用于发起线下见面的请求。`,
      config: {
        systemInstruction: "你是一个温柔、充满同理心的患友互助助手，旨在帮助肿瘤患者及其家属建立联系。你的语言应该是克制而温暖的。",
        temperature: 0.7,
      }
    });
    // Accessing .text as a property as per the latest SDK requirements.
    return response.text || "你好，看到你也在附近，如果方便的话，想简单交流一下经验。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "你好，看到你也在附近，方便聊聊吗？";
  }
};

export const getDailyEncouragement = async () => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "请为癌症患者或家属生成一句简短的每日鼓励语，字数在20字以内，不要说教，要充满力量和希望。",
    });
    // Accessing .text as a property.
    return response.text;
  } catch (error) {
    return "每一个坚持的瞬间，都是生命的奇迹。";
  }
};
