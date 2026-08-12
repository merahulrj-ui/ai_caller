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

import { speakCallAudio, stopCallAudio } from './CallManager';

/**
 * Speak AI Response using Native Telecom Audio Stream TTS
 */
export const speakAiVoiceResponse = async (text, onDoneCallback) => {
  try {
    const spokenNatively = await speakCallAudio(text);
    if (!spokenNatively) {
      await Speech.stop();
      Speech.speak(text, {
        language: 'hi-IN',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => { if (onDoneCallback) onDoneCallback(); },
        onError: () => { if (onDoneCallback) onDoneCallback(); },
      });
    } else {
      if (onDoneCallback) setTimeout(onDoneCallback, 4000);
    }
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
    await stopCallAudio();
    await Speech.stop();
  } catch (e) {}
};

/**
 * Built-in Smart Offline AI Responses (0% API Key Needed - Works 100% Free Out of the Box!)
 */
function getSmartFallbackReply(callerText) {
  if (!callerText) {
    return 'Namaste! Main Rahul ka J.A.R.V.I.S AI Assistant bol raha hu. Rahul ji abhi busy hain, bataiye main kya sahayata kar sakta hu?';
  }

  const lower = callerText.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('suno') || lower.includes('haan')) {
    return 'Namaste! Main Rahul ka J.A.R.V.I.S AI Assistant bol raha hu. Rahul ji abhi busy hain, bataiye main kya sahayata kar sakta hu?';
  } else if (lower.includes('kahan') || lower.includes('kidhar') || lower.includes('busy') || lower.includes('where')) {
    return 'Rahul ji abhi zaroori meeting mein hain. Main unhe inform kar dunga ki aapka call aaya tha, koi message hai?';
  } else if (lower.includes('free') || lower.includes('kab') || lower.includes('wapas') || lower.includes('time')) {
    return 'Ji, Rahul ji shaam tak free ho jayenge. Main unse keh dunga ki free hokar aapko call back kar lein.';
  } else if (lower.includes('urgent') || lower.includes('zaroori') || lower.includes('emergency') || lower.includes('jaldi')) {
    return 'Ji main samajh gaya. Main abhi urgent notification alert Rahul ji ko bhej raha hu. Dhanyawad!';
  } else if (lower.includes('kaun') || lower.includes('who') || lower.includes('tum')) {
    return 'Main Rahul ka autonomous AI Call Assistant J.A.R.V.I.S hu. Main unki incoming calls receive karta hu.';
  } else {
    return 'Ji main samajh gaya. Main aapka ye message Rahul ji ko inform kar dunga. Dhanyawad!';
  }
}
