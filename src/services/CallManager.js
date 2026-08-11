import { PermissionsAndroid, Platform } from 'react-native';
import CallmanagerModule from '../../modules/callmanager/src/CallmanagerModule';

export const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    try {
      const permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      ];

      // ANSWER_PHONE_CALLS is only available on Android 8+ (API 26+)
      if (PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS);
      }

      // READ_PHONE_NUMBERS is available on Android 8+ (API 26+)
      if (PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

      const results = {};
      let allGranted = true;

      for (const perm of permissionsToRequest) {
        const name = perm.split('.').pop();
        const isGranted = granted[perm] === PermissionsAndroid.RESULTS.GRANTED;
        results[name] = isGranted;
        if (!isGranted) allGranted = false;
      }

      if (results.READ_PHONE_STATE && CallmanagerModule) {
        try {
          await CallmanagerModule.startListening();
        } catch(e) {}
      }

      return { allGranted, results };
    } catch (err) {
      console.warn('Permission request error:', err);
      return { allGranted: false, results: {}, error: err.message };
    }
  }
  return { allGranted: true, results: {} };
};

export const answerCall = async () => {
  if (!CallmanagerModule) {
    console.warn("CallmanagerModule is not available. Skipping answerCall.");
    return true;
  }
  try {
    const result = await CallmanagerModule.answerCall();
    console.log("Answer call result:", result);
    return true;
  } catch (error) {
    console.error('Failed to answer call:', error);
    return false;
  }
};

export const enableSpeakerphone = async (enable) => {
  if (!CallmanagerModule) {
    console.warn("CallmanagerModule is not available. Skipping enableSpeakerphone.");
    return true;
  }
  try {
    const result = await CallmanagerModule.enableSpeakerphone(enable);
    console.log('Speakerphone enabled:', result);
    return true;
  } catch (error) {
    console.error('Failed to enable speakerphone:', error);
    return false;
  }
};

export const subscribeToCalls = (onIncomingCall, onCallAnswered, onCallEnded) => {
  if (!CallmanagerModule) return () => {};

  const incomingSub = CallmanagerModule.addListener('onIncomingCall', onIncomingCall);
  const answeredSub = CallmanagerModule.addListener('onCallAnswered', onCallAnswered);
  const endedSub = CallmanagerModule.addListener('onCallEnded', onCallEnded);

  return () => {
    incomingSub.remove();
    answeredSub.remove();
    endedSub.remove();
  };
};

export const requestDefaultDialer = async () => {
  if (!CallmanagerModule || !CallmanagerModule.requestDefaultDialer) return false;
  try {
    return await CallmanagerModule.requestDefaultDialer();
  } catch (e) {
    return false;
  }
};

export const isDefaultDialer = async () => {
  if (!CallmanagerModule || !CallmanagerModule.isDefaultDialer) return false;
  try {
    return await CallmanagerModule.isDefaultDialer();
  } catch (e) {
    return false;
  }
};

export const setAiEnabled = async (enabled) => {
  if (!CallmanagerModule || !CallmanagerModule.setAiEnabled) return false;
  try {
    return await CallmanagerModule.setAiEnabled(enabled);
  } catch (e) {
    return false;
  }
};

export const getDebugLogs = async () => {
  if (!CallmanagerModule || !CallmanagerModule.getDebugLogs) return 'CallmanagerModule not linked.';
  try {
    return await CallmanagerModule.getDebugLogs();
  } catch (e) {
    return 'Failed to fetch debug logs: ' + e.message;
  }
};

export const clearDebugLogs = async () => {
  if (!CallmanagerModule || !CallmanagerModule.clearDebugLogs) return false;
  try {
    return await CallmanagerModule.clearDebugLogs();
  } catch (e) {
    return false;
  }
};


