
import { GoogleGenAI } from "@google/genai";

// Use process.env.API_KEY directly as per SDK instructions for environment variable injection
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDefectImage = async (base64Image: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
        console.warn("Gemini API Key is missing.");
        return "AI analysis unavailable (Key missing).";
    }

    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64
                }
            },
            {
                text: "Analyze this construction image. Identify the specific defect or issue shown (e.g., cracked drywall, chipped paint, ungrounded outlet). Provide a concise, professional 1-sentence description suitable for a formal construction punch list. Do not add conversational filler."
            }
        ]
      }
    });

    return response.text || "Could not analyze image.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI analysis unavailable.";
  }
};

export const suggestFix = async (issueDescription: string): Promise<string> => {
    try {
        if (!process.env.API_KEY) return "";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `For the following construction defect: "${issueDescription}", suggest a concise standard repair method (max 20 words).`
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini Fix Suggestion Error:", error);
        return "";
    }
};
