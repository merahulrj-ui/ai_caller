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
} from 'react-native';
import { requestPermissions, subscribeToCalls, answerCall, enableSpeakerphone } from '../services/CallManager';
import { startConversation, stopConversation, setApiKey } from '../services/AiService';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#0A0E1A',
  card: '#131829',
  cardBorder: '#1E2540',
  accent: '#00D4AA',
  accentDim: '#00A88A',
  danger: '#FF4757',
  warning: '#FFA502',
  text: '#EAECF0',
  textDim: '#6B7280',
  purple: '#8B5CF6',
  blue: '#3B82F6',
};

const PERM_LABELS = {
  READ_PHONE_STATE: { icon: '📱', label: 'Phone State' },
  ANSWER_PHONE_CALLS: { icon: '📞', label: 'Answer Calls' },
  RECORD_AUDIO: { icon: '🎙️', label: 'Microphone' },
  CALL_PHONE: { icon: '📲', label: 'Make Calls' },
  READ_CALL_LOG: { icon: '📋', label: 'Call Log' },
  READ_PHONE_NUMBERS: { icon: '🔢', label: 'Phone Numbers' },
};

export default function HomeScreen() {
  const [permResults, setPermResults] = useState({});
  const [allPermsGranted, setAllPermsGranted] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callerId, setCallerId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callLog, setCallLog] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [apiKey, setApiKeyValue] = useState('');

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation
  useEffect(() => {
    if (aiActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      glow.start();
      return () => { pulse.stop(); glow.stop(); };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [aiActive]);

  // Ring animation
  useEffect(() => {
    if (callStatus === 'ringing') {
      const ring = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 300, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: -1, duration: 300, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 300, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      ring.start();
      return () => ring.stop();
    } else {
      ringAnim.setValue(0);
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

  // AI Conversation trigger
  useEffect(() => {
    if (callStatus === 'active' && aiActive) {
      setConversation([]);
      const onAiLog = (log) => setConversation(prev => [...prev, log]);
      startConversation(onAiLog);
    } else {
      stopConversation();
    }
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
          }, 1500); // 1.5 second delay before picking up
        }
      },
      () => { setCallStatus('active'); },
      () => {
        if (callerId) {
          setCallLog((prev) => [
            { number: callerId, time: new Date().toLocaleTimeString(), duration: callDuration },
            ...prev.slice(0, 9),
          ]);
        }
        setCallStatus('idle');
        setCallerId('');
        setCallDuration(0);
      }
    );
    return () => unsubscribe();
  }, [callerId, callDuration, aiActive]);

  const handlePermissions = async () => {
    const result = await requestPermissions();
    setPermResults(result.results || {});
    setAllPermsGranted(result.allGranted);
  };

  const toggleAI = () => {
    if (!allPermsGranted) {
      handlePermissions();
      return;
    }
    setAiActive(!aiActive);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'ringing': return 'Incoming Call...';
      case 'active': return 'AI Handling Call';
      default: return aiActive ? 'Listening for Calls' : 'AI is Off';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'ringing': return COLORS.warning;
      case 'active': return COLORS.accent;
      default: return aiActive ? COLORS.accent : COLORS.textDim;
    }
  };

  const permEntries = Object.keys(permResults);
  const grantedCount = permEntries.filter((k) => permResults[k]).length;

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>⚡ AI Caller</Text>
          <TouchableOpacity style={styles.permBadge} onPress={handlePermissions}>
            <View style={[styles.permDot, { backgroundColor: allPermsGranted ? COLORS.accent : COLORS.danger }]} />
            <Text style={styles.permText}>
              {permEntries.length > 0 ? `${grantedCount}/${permEntries.length} Granted` : 'No Permissions'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Bar */}
        <View style={[styles.statusBar, { borderColor: getStatusColor() + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
          {callStatus === 'active' && (
            <Text style={styles.timer}>{formatDuration(callDuration)}</Text>
          )}
        </View>

        {/* AI Orb */}
        <View style={styles.orbContainer}>
          {aiActive && (
            <>
              <Animated.View style={[styles.glowRing, styles.glowRing3, { opacity: glowAnim, transform: [{ scale: Animated.multiply(pulseAnim, 1.4) }] }]} />
              <Animated.View style={[styles.glowRing, styles.glowRing2, { opacity: glowAnim, transform: [{ scale: Animated.multiply(pulseAnim, 1.2) }] }]} />
              <Animated.View style={[styles.glowRing, styles.glowRing1, { opacity: Animated.multiply(glowAnim, 1.5), transform: [{ scale: pulseAnim }] }]} />
            </>
          )}
          <Animated.View style={{ transform: [{ scale: aiActive ? pulseAnim : 1 }] }}>
            <TouchableOpacity activeOpacity={0.8} onPress={toggleAI} style={[styles.orbButton, aiActive && styles.orbButtonActive]}>
              <Text style={styles.orbIcon}>{aiActive ? '🤖' : '⏸️'}</Text>
              <Text style={[styles.orbLabel, aiActive && styles.orbLabelActive]}>
                {aiActive ? 'AI Active' : 'Tap to Start'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Caller Info */}
        {callStatus !== 'idle' && (
          <View style={[styles.callerCard, { borderColor: callStatus === 'active' ? COLORS.accent + '40' : COLORS.warning + '40' }]}>
            <Text style={styles.callerIcon}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.callerNumber}>{callerId || 'Unknown'}</Text>
              <Text style={styles.callerStatus}>
                {callStatus === 'ringing' ? 'Ringing... AI will answer' : 'Connected • AI Speaking'}
              </Text>
            </View>
            {callStatus === 'active' && <Text style={styles.callerTimer}>{formatDuration(callDuration)}</Text>}
          </View>
        )}

        {/* Permissions Detail */}
        {permEntries.length > 0 && (
          <View style={styles.permSection}>
            <Text style={styles.sectionTitle}>📋 Permissions</Text>
            <View style={styles.permGrid}>
              {permEntries.map((key) => {
                const info = PERM_LABELS[key] || { icon: '🔒', label: key };
                const granted = permResults[key];
                return (
                  <View key={key} style={[styles.permItem, { borderColor: granted ? COLORS.accent + '30' : COLORS.danger + '30' }]}>
                    <Text style={styles.permItemIcon}>{info.icon}</Text>
                    <Text style={styles.permItemLabel}>{info.label}</Text>
                    <Text style={[styles.permItemStatus, { color: granted ? COLORS.accent : COLORS.danger }]}>
                      {granted ? '✓' : '✗'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* AI Conversation History */}
        {callStatus === 'active' && conversation.length > 0 && (
          <View style={styles.convoSection}>
            <Text style={styles.sectionTitle}>💬 Live Conversation</Text>
            <View style={styles.convoBox}>
              {conversation.map((msg, index) => (
                <View key={index} style={[styles.msgBubble, msg.sender === 'AI' ? styles.msgAi : styles.msgSystem]}>
                  <Text style={styles.msgText}>
                    <Text style={{fontWeight: 'bold'}}>{msg.sender}: </Text>
                    {msg.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Features Grid */}
        <Text style={styles.sectionTitle}>🚀 Features</Text>
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🎙️</Text>
            <Text style={styles.featureTitle}>Auto Answer</Text>
            <Text style={styles.featureDesc}>Picks up calls automatically</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🔊</Text>
            <Text style={styles.featureTitle}>Speaker Mode</Text>
            <Text style={styles.featureDesc}>Enables loudspeaker for AI</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🧠</Text>
            <Text style={styles.featureTitle}>AI Response</Text>
            <Text style={styles.featureDesc}>Talks naturally with caller</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>📝</Text>
            <Text style={styles.featureTitle}>Call Logs</Text>
            <Text style={styles.featureDesc}>Records all conversations</Text>
          </View>
        </View>

        {/* Recent Calls */}
        {callLog.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>📞 Recent AI Calls</Text>
            {callLog.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Text style={styles.logNumber}>{log.number}</Text>
                <Text style={styles.logTime}>{log.time} • {formatDuration(log.duration)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Permission Button */}
        {!allPermsGranted && (
          <TouchableOpacity style={styles.permButton} onPress={handlePermissions}>
            <Text style={styles.permButtonText}>🔐 Grant All Permissions</Text>
            <Text style={styles.permButtonSub}>Phone, Microphone, Call Log & more</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  permBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  permDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  permText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  timer: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
    fontVariant: ['tabular-nums'],
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: 20,
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  glowRing1: { width: 160, height: 160, borderColor: COLORS.accent + '50' },
  glowRing2: { width: 195, height: 195, borderColor: COLORS.accent + '30' },
  glowRing3: { width: 230, height: 230, borderColor: COLORS.accent + '15' },
  orbButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
  },
  orbButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#0D2A23',
  },
  orbIcon: { fontSize: 40, marginBottom: 4 },
  orbLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  orbLabelActive: { color: COLORS.accent },
  callerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  callerIcon: { fontSize: 28, marginRight: 14 },
  callerNumber: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  callerStatus: { fontSize: 13, color: COLORS.textDim, marginTop: 2 },
  callerTimer: { fontSize: 18, fontWeight: '800', color: COLORS.accent },

  // Permissions section
  permSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  permGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  permItemIcon: { fontSize: 14 },
  permItemLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  permItemStatus: { fontSize: 14, fontWeight: '800' },

  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  featureCard: {
    width: (width - 50) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  featureIcon: { fontSize: 22, marginBottom: 6 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  featureDesc: { fontSize: 11, color: COLORS.textDim, lineHeight: 15 },

  // Recent
  recentSection: { marginBottom: 20 },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logNumber: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  logTime: { fontSize: 12, color: COLORS.textDim },

  // Permission Button
  permButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    elevation: 8,
  },
  permButtonText: {
    color: '#0A0E1A',
    fontSize: 16,
    fontWeight: '800',
  },
  permButtonSub: {
    color: '#0A0E1A90',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  convoSection: { marginBottom: 20 },
  convoBox: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  msgBubble: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  msgAi: {
    backgroundColor: COLORS.accent + '20',
    borderLeftWidth: 3,
    borderColor: COLORS.accent,
  },
  msgSystem: {
    backgroundColor: COLORS.warning + '20',
    borderLeftWidth: 3,
    borderColor: COLORS.warning,
  },
  msgText: {
    color: COLORS.text,
    fontSize: 13,
  }
});
