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
        'You are Jarvis, a natural human-like AI call assistant for Rahul. ' +
        'Answer phone calls politely when Rahul is unavailable. ' +
        'Respond in 1 short, warm, everyday conversational sentence in Hinglish or Hindi. ' +
        'Never use robotic terms or acronyms like J.A.R.V.I.S.',
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
    const prompt = `Caller said: "${callerText}". Respond naturally as Jarvis call assistant in 1 brief sentence:`;
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
    const cleanText = text.replace(/J\.A\.R\.V\.I\.S/g, 'Jarvis');
    const spokenNatively = await speakCallAudio(cleanText);
    if (!spokenNatively) {
      await Speech.stop();
      Speech.speak(cleanText, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
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
    return 'Namaste! Main Rahul ka assistant Jarvis bol raha hu. Rahul ji abhi busy hain, bataiye main kya message de du?';
  }

  const lower = callerText.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('suno') || lower.includes('haan')) {
    return 'Namaste! Main Rahul ka assistant Jarvis bol raha hu. Rahul ji abhi busy hain, bataiye main kya message de du?';
  } else if (lower.includes('kahan') || lower.includes('kidhar') || lower.includes('busy') || lower.includes('where')) {
    return 'Rahul ji abhi meeting mein hain. Main unhe bata dunga ki aapka call aaya tha, koi message hai?';
  } else if (lower.includes('free') || lower.includes('kab') || lower.includes('wapas') || lower.includes('time')) {
    return 'Ji, Rahul ji thodi der mein free ho jayenge. Main unse keh dunga ki aapko call back kar lein.';
  } else if (lower.includes('urgent') || lower.includes('zaroori') || lower.includes('emergency') || lower.includes('jaldi')) {
    return 'Ji main samajh gaya. Main abhi urgent alert Rahul ji ko bhej raha hu. Dhanyawad!';
  } else if (lower.includes('kaun') || lower.includes('who') || lower.includes('tum')) {
    return 'Main Rahul ka AI assistant Jarvis hu. Main unki calls receive karta hu.';
  } else {
    return 'Ji main samajh gaya. Main aapka ye message Rahul ji ko inform kar dunga. Dhanyawad!';
  }
}
