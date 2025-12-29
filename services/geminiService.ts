import { GoogleGenAI } from "@google/genai";

// Lazy initialization - only create client when needed and if API key is available
let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!ai) {
    // Check for API key in environment variables (Vite uses import.meta.env)
    const apiKey = import.meta.env?.VITE_GEMINI_API_KEY;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey });
      } catch (error) {
        console.warn('Failed to initialize GoogleGenAI:', error);
        return null;
      }
    } else {
      console.warn('VITE_GEMINI_API_KEY not found in environment variables');
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

    // Use Gemini 3.0 Flash model
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.0-flash',
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
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    // Provide more detailed error message
    if (error?.message) {
      return `AI analysis error: ${error.message}`;
    }
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
        // Use Gemini 3.0 Flash model
        const response = await aiClient.models.generateContent({
            model: 'gemini-3.0-flash',
            contents: `For the following construction defect: "${issueDescription}", suggest a concise standard repair method (max 20 words).`
        });
        return response.text || "";
    } catch (error: any) {
        console.error("Gemini Fix Suggestion Error:", error);
        return "";
    }
};