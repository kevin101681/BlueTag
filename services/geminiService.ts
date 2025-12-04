
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
let apiKey = "";

try {
  // process.env.API_KEY is replaced by Vite during build with the string value.
  // We use a try-catch to safely handle the replacement or lack thereof.
  // @ts-ignore
  apiKey = process.env.API_KEY || "";
} catch (e) {
  console.warn("Error accessing process.env.API_KEY");
}

// Initialize client if key is present
if (apiKey) {
    try {
        ai = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI client", e);
    }
}

export const analyzeDefectImage = async (base64Image: string): Promise<string> => {
  try {
    if (!ai || !apiKey) {
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
        if (!ai || !apiKey) return "";

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
