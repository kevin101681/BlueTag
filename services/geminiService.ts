import { GoogleGenAI } from "@google/genai";

// Lazy initialization - only create client when needed and if API key is available
let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!ai) {
    // Check for API key in environment variables (Vite uses import.meta.env)
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey });
      } catch (error) {
        console.warn('Failed to initialize GoogleGenAI:', error);
        return null;
      }
    } else {
      return null;
    }
  }
  return ai;
}

export const analyzeDefectImage = async (base64Image: string): Promise<string> => {
  const aiClient = getAI();
  if (!aiClient) {
    console.warn('GoogleGenAI not available - API key not set');
    return 'AI analysis unavailable - API key not configured';
  }

  try {
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await aiClient.models.generateContent({
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
    const aiClient = getAI();
    if (!aiClient) {
        console.warn('GoogleGenAI not available - API key not set');
        return '';
    }

    try {
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `For the following construction defect: "${issueDescription}", suggest a concise standard repair method (max 20 words).`
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini Fix Suggestion Error:", error);
        return "";
    }
};