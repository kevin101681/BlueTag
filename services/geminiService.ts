// Gemini AI service - now calls serverless function to keep API key secure

export const analyzeDefectImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/gemini-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        analysisType: 'defect'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini analysis failed:', error);
      
      if (response.status === 500 && error.message?.includes('not configured')) {
        return 'AI analysis unavailable - service not configured';
      }
      
      return 'AI analysis unavailable';
    }

    const data = await response.json();
    return data.result || "Could not analyze image.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI analysis unavailable.";
  }
};

export const suggestFix = async (issueDescription: string): Promise<string> => {
  try {
    // For text-only analysis, we'll create a simple text prompt
    // Note: This is a placeholder - in production, you might want a separate endpoint
    const response = await fetch('/.netlify/functions/gemini-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image: '', // Empty for text-only
        analysisType: 'fix',
        textPrompt: `For the following construction defect: "${issueDescription}", suggest a concise standard repair method (max 20 words).`
      }),
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    return data.result || "";
  } catch (error) {
    console.error("Gemini Fix Suggestion Error:", error);
    return "";
  }
};