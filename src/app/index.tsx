import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Share
} from 'react-native';
import { requestPermissions, subscribeToCalls, answerCall, enableSpeakerphone, getDebugLogs, clearDebugLogs, requestDefaultDialer, isDefaultDialer, setAiEnabled } from '../services/CallManager';
// AiService is lazy-loaded to prevent crash on startup (native modules like expo-av cause issues if loaded eagerly)

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#030610',
  glassBg: 'rgba(20, 30, 60, 0.4)',
  glassBorder: 'rgba(0, 240, 255, 0.2)',
  neonCyan: '#00F0FF',
  neonBlue: '#0A74DA',
  neonRed: '#FF2A2A',
  text: '#FFFFFF',
  textDim: 'rgba(255, 255, 255, 0.6)',
};

const PERM_LABELS = {
  READ_PHONE_STATE: 'Phone State',
  ANSWER_PHONE_CALLS: 'Answer Calls',
  RECORD_AUDIO: 'Microphone',
  CALL_PHONE: 'Make Calls',
  READ_CALL_LOG: 'Call Log',
  READ_PHONE_NUMBERS: 'Phone Numbers',
};

export default function HomeScreen() {
  const [permResults, setPermResults] = useState({});
  const [allPermsGranted, setAllPermsGranted] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callerId, setCallerId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [conversation, setConversation] = useState([]);
  const [debugLogs, setDebugLogs] = useState('');

  const refreshLogs = async () => {
    const logs = await getDebugLogs();
    setDebugLogs(logs);
  };

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(height)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  // Initial Fade In
  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Orb Animations (Pulse and Rotate)
  useEffect(() => {
    let pulse, rotate;
    if (aiActive) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      rotate = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      pulse.start();
      rotate.start();
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
      rotationAnim.setValue(0);
    }
    return () => { if(pulse) pulse.stop(); if(rotate) rotate.stop(); };
  }, [aiActive]);

  // Bottom Sheet Slide Up on Call
  useEffect(() => {
    if (callStatus !== 'idle') {
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideUpAnim, {
        toValue: height,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [callStatus]);

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callStatus === 'active') {
      setCallDuration(0);
      interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // AI Conversation trigger (lazy-loaded)
  useEffect(() => {
    let cleanup = false;
    if (callStatus === 'active' && aiActive) {
      setConversation([]);
      import('../services/AiService').then((AiService) => {
        if (!cleanup) {
          const onAiLog = (log) => setConversation(prev => [...prev, log]);
          AiService.startConversation(onAiLog);
        }
      }).catch((err) => {
        console.warn('AiService load error:', err);
      });
    } else {
      import('../services/AiService').then((AiService) => {
        AiService.stopConversation();
      }).catch(() => {});
    }
    return () => { cleanup = true; };
  }, [callStatus, aiActive]);

  // Subscribe to calls
  useEffect(() => {
    const unsubscribe = subscribeToCalls(
      (number) => { 
        setCallStatus('ringing'); 
        setCallerId(number || 'Unknown'); 
        if (aiActive) {
          setTimeout(() => {
            answerCall();
            enableSpeakerphone(true);
          }, 1500);
        }
      },
      () => { setCallStatus('active'); },
      () => {
        setCallStatus('idle');
        setCallerId('');
        setCallDuration(0);
      }
    );
    return () => unsubscribe();
  }, [callerId, callDuration, aiActive]);

  const [isDefault, setIsDefault] = useState(false);

  const checkDefaultStatus = async () => {
    const defaultStatus = await isDefaultDialer();
    setIsDefault(defaultStatus);
  };

  useEffect(() => {
    checkDefaultStatus();
  }, []);

  const handlePermissions = async () => {
    const result = await requestPermissions();
    setPermResults(result.results || {});
    setAllPermsGranted(result.allGranted);
    await checkDefaultStatus();
  };

  const toggleAI = () => {
    if (!allPermsGranted) {
      handlePermissions();
      return;
    }
    const nextState = !aiActive;
    setAiActive(nextState);
    setAiEnabled(nextState);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  const reverseSpin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  const getOrbColor = () => {
    if (callStatus === 'ringing') return COLORS.neonRed;
    if (callStatus === 'active') return COLORS.neonCyan;
    return aiActive ? COLORS.neonBlue : '#333333';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Background Decor */}
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <Animated.View style={[styles.mainContent, { opacity: fadeInAnim }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>J.A.R.V.I.S</Text>
          <Text style={styles.subtitle}>Autonomous Call Handler</Text>
        </View>

        {/* Central Orb / AI Core */}
        <View style={styles.coreContainer}>
          {aiActive && (
            <Animated.View style={[styles.halo, { borderColor: getOrbColor(), transform: [{ scale: pulseAnim }, { rotate: spin }] }]} />
          )}
          {aiActive && (
            <Animated.View style={[styles.haloOuter, { borderColor: getOrbColor(), transform: [{ scale: Animated.multiply(pulseAnim, 1.2) }, { rotate: reverseSpin }] }]} />
          )}
          
          <TouchableOpacity activeOpacity={0.9} onPress={toggleAI} style={styles.coreButtonContainer}>
            <Animated.View style={[styles.coreButton, { backgroundColor: aiActive ? getOrbColor() + '20' : '#111', borderColor: getOrbColor() }]}>
              <Text style={styles.coreIcon}>{aiActive ? '🎙️' : 'POWER'}</Text>
              <Text style={[styles.coreText, { color: aiActive ? COLORS.neonCyan : COLORS.textDim }]}>
                {aiActive ? 'SYSTEM ONLINE' : 'OFFLINE'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Permissions / Status Info (When Idle) */}
        {callStatus === 'idle' && (
          <View style={styles.dashboardSection}>
            <View style={styles.glassCard}>
              <Text style={styles.cardTitle}>SYSTEM DIAGNOSTICS</Text>
              <View style={styles.permGrid}>
                {Object.keys(PERM_LABELS).map((key) => {
                  const granted = permResults[key];
                  return (
                    <View key={key} style={styles.permRow}>
                      <View style={[styles.statusIndicator, { backgroundColor: granted ? COLORS.neonCyan : COLORS.neonRed }]} />
                      <Text style={styles.permText}>{PERM_LABELS[key]}</Text>
                      <Text style={[styles.permStatusText, { color: granted ? COLORS.neonCyan : COLORS.neonRed }]}>
                        {granted ? 'OK' : 'FAIL'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              
              {!allPermsGranted ? (
                <TouchableOpacity style={styles.authButton} onPress={handlePermissions}>
                  <Text style={styles.authButtonText}>INITIALIZE PERMISSIONS</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.authButton, { backgroundColor: isDefault ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 42, 42, 0.15)', borderColor: isDefault ? COLORS.neonCyan : COLORS.neonRed }]} 
                  onPress={async () => { await requestDefaultDialer(); await checkDefaultStatus(); }}>
                  <Text style={[styles.authButtonText, { color: isDefault ? COLORS.neonCyan : COLORS.neonRed }]}>
                    {isDefault ? '✓ DEFAULT CALL ASSISTANT ACTIVE' : '⚡ SET AS DEFAULT CALL ASSISTANT'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Debugger Panel */}
            <View style={[styles.glassCard, { marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.cardTitle}>ENGINE DEBUG LOGS (LIVE)</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => { Share.share({ title: 'AI Caller Debug Logs', message: debugLogs || 'No logs captured' }); }}>
                    <Text style={{ color: COLORS.neonCyan, fontSize: 10, fontWeight: '700' }}>COPY / SHARE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { await clearDebugLogs(); refreshLogs(); }}>
                    <Text style={{ color: COLORS.neonRed, fontSize: 10, fontWeight: '700' }}>CLEAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView style={{ maxHeight: 150, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 }}>
                <Text selectable={true} style={{ color: COLORS.neonCyan, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {debugLogs || 'No logs captured yet...'}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}

      </Animated.View>

      {/* Call Active Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideUpAnim }] }]}>
        <View style={styles.sheetHeader}>
          <View style={styles.dragHandle} />
        </View>
        
        <View style={styles.callInfoCard}>
          <View>
            <Text style={styles.callLabel}>INCOMING TRANSMISSION</Text>
            <Text style={styles.callerIdText}>{callerId}</Text>
          </View>
          {callStatus === 'active' && (
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.transcriptContainer} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          {conversation.map((msg, index) => (
            <View key={index} style={[styles.msgWrapper, msg.sender === 'AI' ? styles.msgWrapperAi : styles.msgWrapperUser]}>
              <View style={[styles.msgBubble, msg.sender === 'AI' ? styles.msgBubbleAi : styles.msgBubbleUser]}>
                <Text style={styles.msgSender}>{msg.sender === 'AI' ? 'J.A.R.V.I.S' : 'CALLER'}</Text>
                <Text style={styles.msgContent}>{msg.text}</Text>
              </View>
            </View>
          ))}
          {callStatus === 'ringing' && (
            <Text style={styles.scanningText}>[ SCANNING INCOMING SIGNAL... ]</Text>
          )}
        </ScrollView>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bgDecorTop: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.neonBlue,
    opacity: 0.1,
    transform: [{ scaleY: 0.5 }],
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.neonCyan,
    opacity: 0.05,
  },
  mainContent: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.neonCyan,
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  coreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 350,
    marginTop: 20,
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  haloOuter: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    opacity: 0.3,
  },
  coreButtonContainer: {
    zIndex: 10,
  },
  coreButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  coreIcon: {
    fontSize: 28,
    marginBottom: 8,
    color: COLORS.text,
  },
  coreText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  dashboardSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  glassCard: {
    backgroundColor: COLORS.glassBg,
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    fontSize: 12,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: 16,
    fontWeight: '700',
  },
  permGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  permRow: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 10,
    borderRadius: 8,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  permText: {
    color: COLORS.text,
    fontSize: 11,
    flex: 1,
  },
  permStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  authButton: {
    marginTop: 16,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  authButtonText: {
    color: COLORS.neonCyan,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.65,
    backgroundColor: 'rgba(10, 15, 30, 0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 24,
    elevation: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textDim,
    borderRadius: 2,
  },
  callInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  callLabel: {
    fontSize: 11,
    color: COLORS.neonRed,
    letterSpacing: 2,
    marginBottom: 4,
  },
  callerIdText: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    letterSpacing: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
  },
  timerText: {
    color: COLORS.neonCyan,
    fontWeight: '800',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  transcriptContainer: {
    flex: 1,
  },
  msgWrapper: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  msgWrapperAi: {
    alignSelf: 'flex-start',
  },
  msgWrapperUser: {
    alignSelf: 'flex-end',
  },
  msgBubble: {
    padding: 14,
    borderRadius: 16,
  },
  msgBubbleAi: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderLeftWidth: 3,
    borderColor: COLORS.neonCyan,
    borderTopLeftRadius: 4,
  },
  msgBubbleUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRightWidth: 3,
    borderColor: COLORS.textDim,
    borderTopRightRadius: 4,
  },
  msgSender: {
    fontSize: 10,
    color: COLORS.textDim,
    marginBottom: 6,
    fontWeight: '700',
    letterSpacing: 1,
  },
  msgContent: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  scanningText: {
    color: COLORS.neonRed,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.8,
  }
});
