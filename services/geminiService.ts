import { GoogleGenAI } from "@google/genai";

// Lazy initialization - only create client when needed and if API key is available
let ai: GoogleGenAI | null = null;
let initializationAttempted = false;

function getAI(): GoogleGenAI | null {
  if (initializationAttempted) {
    return ai;
  }
  
  initializationAttempted = true;
  
  try {
    // Check for API key in environment variables (Vite uses import.meta.env)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    
    if (!apiKey) {
      console.warn('[Gemini] API key not found. Set VITE_GEMINI_API_KEY in environment variables.');
      return null;
    }
    
    console.log('[Gemini] Initializing GoogleGenAI client...');
    ai = new GoogleGenAI({ apiKey });
    console.log('[Gemini] GoogleGenAI client initialized successfully');
    return ai;
  } catch (error) {
    console.error('[Gemini] Failed to initialize GoogleGenAI:', error);
    return null;
  }
}

export async function analyzeDefectImage(base64Image: string): Promise<string> {
  try {
    console.log('[Gemini] Starting image analysis...');
    
    const aiClient = getAI();
    if (!aiClient) {
      console.warn('[Gemini] GoogleGenAI not available - API key not set');
      return 'AI analysis unavailable - API key not configured';
    }

    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    
    console.log('[Gemini] Sending request to Gemini API...', {
      imageSize: cleanBase64.length,
      model: 'gemini-2.0-flash-exp'
    });

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp',
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

    console.log('[Gemini] Received response');
    const result = response.text || "Could not analyze image.";
    console.log('[Gemini] Analysis complete');
    return result;
  } catch (error) {
    console.error("[Gemini] Analysis Error:", error);
    // Return more detailed error for debugging
    if (error instanceof Error) {
      return `AI analysis error: ${error.message}`;
    }
    return "AI analysis unavailable.";
  }
}

export async function suggestFix(issueDescription: string): Promise<string> {
  try {
    const aiClient = getAI();
    if (!aiClient) {
      console.warn('[Gemini] GoogleGenAI not available - API key not set');
      return '';
    }

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `For the following construction defect: "${issueDescription}", suggest a concise standard repair method (max 20 words).`
    });
    return response.text || "";
  } catch (error) {
    console.error("[Gemini] Fix Suggestion Error:", error);
    return "";
  }
}
