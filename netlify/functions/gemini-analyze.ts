// Netlify Function to analyze defect images using Gemini AI
// Keeps the API key secure on the server side

import { GoogleGenAI } from "@google/genai";

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API key not configured');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Gemini AI not configured',
          message: 'GEMINI_API_KEY must be set in Netlify environment variables.',
        }),
      };
    }

    const { base64Image, analysisType = 'defect' } = JSON.parse(event.body || '{}');

    if (!base64Image) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Missing base64Image parameter' }),
      };
    }

    // Initialize Gemini AI
    const ai = new GoogleGenAI({ apiKey });

    // Remove data URL header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.includes(',') 
      ? base64Image.split(',')[1] 
      : base64Image;

    // Prepare prompt based on analysis type
    const prompts = {
      defect: "Analyze this construction image. Identify the specific defect or issue shown (e.g., cracked drywall, chipped paint, ungrounded outlet). Provide a concise, professional 1-sentence description suitable for a formal construction punch list. Do not add conversational filler.",
      fix: "For the construction defect shown in this image, suggest a concise standard repair method (max 20 words)."
    };

    const prompt = prompts[analysisType as keyof typeof prompts] || prompts.defect;

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-exp-1206',
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
            text: prompt
          }
        ]
      }
    });

    const result = response.text || "Could not analyze image.";

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        result,
        analysisType
      }),
    };
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Analysis failed',
        message: error.message || 'Internal server error',
      }),
    };
  }
};

