import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';

// NOTE: In production, never hardcode API keys. This should come from a secure backend or .env
let GEMINI_API_KEY = ''; 
let genAI = null;
let recording = null;
let isConversationActive = false;
let conversationHistory = [];

export const setApiKey = (key) => {
  GEMINI_API_KEY = key;
  genAI = new GoogleGenerativeAI(key);
};

export const startConversation = async (onLog) => {
  isConversationActive = true;
  conversationHistory = [
    { role: "user", parts: [{ text: "You are a helpful phone AI assistant. Keep responses very short, conversational, and natural as if talking on a phone. The user has just called." }] },
    { role: "model", parts: [{ text: "Understood." }] }
  ];
  
  onLog({ sender: 'AI', text: 'Hello, this is your AI assistant. How can I help you today?' });
  await speak('Hello, this is your AI assistant. How can I help you today?');
  
  // Start the listening loop
  listenAndRespond(onLog);
};

export const stopConversation = async () => {
  isConversationActive = false;
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
    } catch(e) {}
    recording = null;
  }
  Speech.stop();
};

const speak = (text) => {
  return new Promise((resolve) => {
    Speech.speak(text, {
      onDone: resolve,
      onError: resolve,
      onStopped: resolve,
    });
  });
};

const listenAndRespond = async (onLog) => {
  if (!isConversationActive) return;

  try {
    // 1. Ask for permission
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      onLog({ sender: 'System', text: 'Microphone permission denied for AI.' });
      return;
    }

    // 2. Prepare audio recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false, // We want speaker
    });

    onLog({ sender: 'System', text: '[Listening for 5 seconds...]' });
    
    // 3. Record for a fixed window (simulating detecting speech)
    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    
    // Listen for 5 seconds (Simple implementation for demo)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (!isConversationActive) return;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    if (!GEMINI_API_KEY || !genAI) {
      onLog({ sender: 'System', text: 'No Gemini API Key set. Skipping AI processing.' });
      // Retry loop
      setTimeout(() => listenAndRespond(onLog), 2000);
      return;
    }

    onLog({ sender: 'System', text: '[Processing audio with Gemini...]' });

    // 4. Send Audio to Gemini Multimodal
    const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const chat = model.startChat({
      history: conversationHistory,
    });

    // We pass the audio file to the model
    const result = await chat.sendMessage([
      {
        inlineData: {
          mimeType: "audio/mp4", // expo-av high quality preset is usually m4a/mp4 on android
          data: base64Audio
        }
      }
    ]);

    const reply = result.response.text();
    onLog({ sender: 'AI', text: reply });
    
    // Add to history
    conversationHistory.push({ role: "user", parts: [{ text: "[Audio input received]" }] });
    conversationHistory.push({ role: "model", parts: [{ text: reply }] });

    // 5. Speak the response
    await speak(reply);

    // 6. Loop back to listening
    if (isConversationActive) {
      listenAndRespond(onLog);
    }

  } catch (error) {
    console.warn("AI Loop Error:", error);
    onLog({ sender: 'System', text: 'AI Error: ' + error.message });
    if (isConversationActive) {
      setTimeout(() => listenAndRespond(onLog), 3000); // Retry after error
    }
  }
};
