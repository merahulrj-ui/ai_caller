// AiService.js — Safe stub with correct exports
// AI voice features will be implemented after the core call engine is stable.
// This file has ZERO native module imports to guarantee no crash.
// When we implement AI, we will use:
//   - expo-audio (SDK 57, replaces deprecated expo-av) for recording
//   - expo-speech for TTS
//   - @google/generative-ai for Gemini
//   - expo-file-system for reading audio files

let isConversationActive = false;

export const setApiKey = (key) => {
  // Will initialize Gemini AI when we connect the real service
  console.log('AI API Key stored (AI engine not active yet)');
};

export const startConversation = async (onLog) => {
  isConversationActive = true;
  onLog({ sender: 'AI', text: 'JARVIS is in standby mode. Voice engine will be connected soon.' });
};

export const stopConversation = async () => {
  isConversationActive = false;
};
