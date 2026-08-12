import { GoogleGenerativeAI } from '@google/generative-ai';
import * as Speech from 'expo-speech';

// Gemini API Key (Can be configured in app settings or environment)
let API_KEY = 'YOUR_GEMINI_API_KEY';

let genAI = null;
let model = null;

export const setGeminiApiKey = (key) => {
  if (key) {
    API_KEY = key;
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are J.A.R.V.I.S, an autonomous AI Call Assistant for Rahul. ' +
        'You answer incoming phone calls politely when Rahul is unavailable. ' +
        'Respond in short, natural, human-like sentences (1-2 sentences max) in Hindi or English depending on caller language. ' +
        'Ask who is calling, take messages, or provide helpful answers.',
    });
  }
};

// Initialize with default or fallback
try {
  setGeminiApiKey(API_KEY);
} catch (e) {
  console.warn('Gemini AI initialization warning:', e);
}

/**
 * Process Caller's Speech Text with Gemini AI Brain
 */
export const generateAiCallReply = async (callerText, conversationHistory = []) => {
  if (!model) {
    // Smart fallback if API key is not configured yet
    return getSmartFallbackReply(callerText);
  }

  try {
    const prompt = `Caller said: "${callerText}". Respond naturally as J.A.R.V.I.S call assistant in 1-2 brief sentences:`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiReply = response.text();
    return aiReply.trim();
  } catch (error) {
    console.error('Gemini AI Generation Error:', error);
    return getSmartFallbackReply(callerText);
  }
};

/**
 * Speak AI Response using Text-to-Speech (TTS)
 */
export const speakAiVoiceResponse = async (text, onDoneCallback) => {
  try {
    // Stop any ongoing speech
    await Speech.stop();

    Speech.speak(text, {
      language: 'hi-IN', // Indian accent / Hindi support
      pitch: 1.0,
      rate: 0.95,
      onDone: () => {
        if (onDoneCallback) onDoneCallback();
      },
      onError: (err) => {
        console.warn('Speech TTS Error:', err);
        if (onDoneCallback) onDoneCallback();
      },
    });
  } catch (e) {
    console.error('TTS Error:', e);
    if (onDoneCallback) onDoneCallback();
  }
};

/**
 * Stop TTS Speech
 */
export const stopAiVoiceResponse = async () => {
  try {
    await Speech.stop();
  } catch (e) {}
};

/**
 * Fallback AI Responses when API key is pending
 */
function getSmartFallbackReply(callerText) {
  const lower = callerText.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste')) {
    return 'Namaste! Main Rahul ka J.A.R.V.I.S AI Assistant bol raha hu. Rahul ji abhi busy hain, bataiye kya kaam tha?';
  } else if (lower.includes('kahan') || lower.includes('where')) {
    return 'Rahul ji abhi meeting mein hain. Aapka koi zaroori message hai toh mujhe bata dijiye, main unhe forward kar dunga.';
  } else if (lower.includes('free') || lower.includes('kab')) {
    return 'Ji, Rahul ji shaam tak free ho jayenge. Main unse bol dunga ki aapko call back kar lein.';
  } else {
    return 'Ji main samajh gaya. Main aapka ye message Rahul ji ko inform kar deta hu. Dhanyawad!';
  }
}
