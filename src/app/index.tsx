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
  Share,
  TextInput
} from 'react-native';
import {
  requestPermissions,
  subscribeToCalls,
  answerCall,
  endCall,
  makeCall,
  enableSpeakerphone,
  muteMicrophone,
  getDebugLogs,
  clearDebugLogs,
  requestDefaultDialer,
  isDefaultDialer,
  setAiEnabled
} from '../services/CallManager';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#030610',
  glassBg: 'rgba(20, 30, 60, 0.5)',
  glassBorder: 'rgba(0, 240, 255, 0.2)',
  neonCyan: '#00F0FF',
  neonBlue: '#0A74DA',
  neonGreen: '#00FF66',
  neonRed: '#FF2A2A',
  text: '#FFFFFF',
  textDim: 'rgba(255, 255, 255, 0.6)',
  cardBg: 'rgba(10, 18, 40, 0.7)',
};

const PERM_LABELS = {
  READ_PHONE_STATE: 'Phone State',
  ANSWER_PHONE_CALLS: 'Answer Calls',
  RECORD_AUDIO: 'Microphone',
  CALL_PHONE: 'Make Calls',
  READ_CALL_LOG: 'Call Log',
  READ_CONTACTS: 'Contacts',
};

// Sample Contacts & Call Logs for rich dialer experience
const MOCK_CONTACTS = [
  { id: '1', name: 'Rahul Sharma', number: '+919997233530', category: 'VIP' },
  { id: '2', name: 'Priya Verma', number: '+919876543210', category: 'Work' },
  { id: '3', name: 'Amit Kumar', number: '+919123456789', category: 'Family' },
  { id: '4', name: 'Jarvis AI Support', number: '+918000112233', category: 'System' },
];

const MOCK_LOGS = [
  { id: '1', name: 'Rahul Sharma', number: '+919997233530', type: 'incoming', time: '10:45 AM', duration: '1m 24s' },
  { id: '2', name: 'Priya Verma', number: '+919876543210', type: 'outgoing', time: 'Yesterday', duration: '4m 10s' },
  { id: '3', name: 'Unknown Caller', number: '+919811223344', type: 'missed', time: 'Yesterday', duration: '0s' },
];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('jarvis'); // 'recents' | 'contacts' | 'dialpad' | 'jarvis'
  const [permResults, setPermResults] = useState({});
  const [allPermsGranted, setAllPermsGranted] = useState(false);
  const [aiActive, setAiActive] = useState(true);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'ringing' | 'active'
  const [callerId, setCallerId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [conversation, setConversation] = useState([]);
  const [debugLogs, setDebugLogs] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // In-Call States
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Dialpad States
  const [dialedNumber, setDialedNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');

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

  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let pulse, rotate;
    if (aiActive) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      rotate = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 9000,
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
    return () => { if (pulse) pulse.stop(); if (rotate) rotate.stop(); };
  }, [aiActive]);

  useEffect(() => {
    if (callStatus !== 'idle') {
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideUpAnim, {
        toValue: height,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [callStatus]);

  useEffect(() => {
    let interval;
    if (callStatus === 'active') {
      setCallDuration(0);
      interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Subscribe to Call Events
  useEffect(() => {
    const unsubscribe = subscribeToCalls(
      (number) => {
        setCallStatus('ringing');
        setCallerId(number || 'Incoming Call');
        if (aiActive) {
          setTimeout(() => {
            answerCall();
            enableSpeakerphone(true);
            setIsSpeakerOn(true);
          }, 1000);
        }
      },
      () => {
        setCallStatus('active');
      },
      () => {
        setCallStatus('idle');
        setCallerId('');
        setCallDuration(0);
        setIsMuted(false);
        setIsSpeakerOn(false);
      }
    );
    return () => unsubscribe();
  }, [aiActive]);

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
    const nextState = !aiActive;
    setAiActive(nextState);
    setAiEnabled(nextState);
  };

  const handleMuteToggle = async () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    await muteMicrophone(nextMute);
  };

  const handleSpeakerToggle = async () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    await enableSpeakerphone(nextSpeaker);
  };

  const handleHangup = async () => {
    await endCall();
    setCallStatus('idle');
  };

  const handleDialPress = (val) => {
    setDialedNumber((prev) => prev + val);
  };

  const handleDialDelete = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleInitiateCall = async (numToCall) => {
    const target = numToCall || dialedNumber;
    if (!target) return;
    setCallerId(target);
    setCallStatus('active');
    await makeCall(target);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const filteredContacts = MOCK_CONTACTS.filter(
    (c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch)
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Futuristic Background Glows */}
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <Animated.View style={[styles.mainContent, { opacity: fadeInAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>J.A.R.V.I.S</Text>
          <Text style={styles.subtitle}>Autonomous AI Dialer Engine</Text>
        </View>

        {/* Dynamic Tab Views */}
        <View style={styles.tabContentContainer}>
          {/* TAB 1: JARVIS AI CORE & STATUS */}
          {activeTab === 'jarvis' && (
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.coreContainer}>
                {aiActive && (
                  <Animated.View style={[styles.halo, { borderColor: COLORS.neonCyan, transform: [{ scale: pulseAnim }, { rotate: spin }] }]} />
                )}
                <TouchableOpacity activeOpacity={0.9} onPress={toggleAI} style={styles.coreButtonContainer}>
                  <Animated.View style={[styles.coreButton, { backgroundColor: aiActive ? 'rgba(0, 240, 255, 0.15)' : '#111', borderColor: aiActive ? COLORS.neonCyan : '#333' }]}>
                    <Text style={styles.coreIcon}>{aiActive ? '🎙️' : 'POWER'}</Text>
                    <Text style={[styles.coreText, { color: aiActive ? COLORS.neonCyan : COLORS.textDim }]}>
                      {aiActive ? 'SYSTEM ONLINE' : 'OFFLINE'}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Setup & Default Dialer Card */}
              <View style={styles.glassCard}>
                <Text style={styles.cardTitle}>SYSTEM CONTROL & AUTHORIZATION</Text>

                <TouchableOpacity
                  style={[styles.authButton, { backgroundColor: isDefault ? 'rgba(0, 255, 102, 0.12)' : 'rgba(255, 42, 42, 0.12)', borderColor: isDefault ? COLORS.neonGreen : COLORS.neonRed }]}
                  onPress={async () => {
                    await requestDefaultDialer();
                    await checkDefaultStatus();
                  }}
                >
                  <Text style={[styles.authButtonText, { color: isDefault ? COLORS.neonGreen : COLORS.neonRed }]}>
                    {isDefault ? '✓ DEFAULT DIALER ACTIVE' : '⚡ SET AS DEFAULT CALL ASSISTANT'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.authButton, { marginTop: 10, borderColor: COLORS.neonCyan }]} onPress={handlePermissions}>
                  <Text style={styles.authButtonText}>GRANT DIALER PERMISSIONS</Text>
                </TouchableOpacity>
              </View>

              {/* Debugger Panel */}
              <View style={[styles.glassCard, { marginTop: 14, marginBottom: 20 }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>ENGINE DEBUG LOGS (LIVE)</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => Share.share({ title: 'AI Caller Logs', message: debugLogs || 'No logs' })}>
                      <Text style={styles.actionTextCyan}>COPY / SHARE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { await clearDebugLogs(); refreshLogs(); }}>
                      <Text style={styles.actionTextRed}>CLEAR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView style={styles.debugLogBox}>
                  <Text selectable={true} style={styles.logText}>
                    {debugLogs || 'No logs captured yet...'}
                  </Text>
                </ScrollView>
              </View>
            </ScrollView>
          )}

          {/* TAB 2: DIALPAD */}
          {activeTab === 'dialpad' && (
            <View style={styles.dialpadContainer}>
              <View style={styles.dialDisplayCard}>
                <Text style={styles.dialedNumberText}>{dialedNumber || 'Type Number...'}</Text>
                {dialedNumber.length > 0 && (
                  <TouchableOpacity onPress={handleDialDelete} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>⌫</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.keypadGrid}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['*', '0', '#'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((val) => (
                      <TouchableOpacity key={val} style={styles.keypadButton} onPress={() => handleDialPress(val)}>
                        <Text style={styles.keypadValue}>{val}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.callCallButton} onPress={() => handleInitiateCall()}>
                <Text style={styles.callCallIcon}>📞 CALL</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contacts' && (
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search Contacts..."
                placeholderTextColor={COLORS.textDim}
                value={contactSearch}
                onChangeText={setContactSearch}
              />
              <ScrollView style={styles.tabScroll}>
                {filteredContacts.map((contact) => (
                  <View key={contact.id} style={styles.contactCard}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{contact.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactNumber}>{contact.number}</Text>
                    </View>
                    <TouchableOpacity style={styles.contactDialBtn} onPress={() => handleInitiateCall(contact.number)}>
                      <Text style={{ color: COLORS.neonCyan, fontSize: 16 }}>📞</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* TAB 4: CALL LOGS / RECENTS */}
          {activeTab === 'recents' && (
            <ScrollView style={styles.tabScroll}>
              <Text style={styles.cardTitle}>RECENT CALL HISTORY</Text>
              {MOCK_LOGS.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>
                    {log.type === 'incoming' ? '↙️' : log.type === 'outgoing' ? '↗️' : '❌'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{log.name}</Text>
                    <Text style={styles.contactNumber}>{log.number} • {log.time}</Text>
                  </View>
                  <TouchableOpacity style={styles.contactDialBtn} onPress={() => handleInitiateCall(log.number)}>
                    <Text style={{ color: COLORS.neonCyan, fontSize: 16 }}>📞</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* BOTTOM NAVIGATION TAB BAR */}
        <View style={styles.bottomTabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('recents')}>
            <Text style={[styles.tabIcon, activeTab === 'recents' && styles.tabActiveText]}>📋</Text>
            <Text style={[styles.tabLabel, activeTab === 'recents' && styles.tabActiveText]}>Recents</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('contacts')}>
            <Text style={[styles.tabIcon, activeTab === 'contacts' && styles.tabActiveText]}>👤</Text>
            <Text style={[styles.tabLabel, activeTab === 'contacts' && styles.tabActiveText]}>Contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('dialpad')}>
            <Text style={[styles.tabIcon, activeTab === 'dialpad' && styles.tabActiveText]}>🔢</Text>
            <Text style={[styles.tabLabel, activeTab === 'dialpad' && styles.tabActiveText]}>Dialpad</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('jarvis')}>
            <Text style={[styles.tabIcon, activeTab === 'jarvis' && styles.tabActiveText]}>🤖</Text>
            <Text style={[styles.tabLabel, activeTab === 'jarvis' && styles.tabActiveText]}>J.A.R.V.I.S</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* FULL IN-CALL OVERLAY SCREEN */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideUpAnim }] }]}>
        <View style={styles.sheetHeader}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.callInfoCard}>
          <View>
            <Text style={styles.callLabel}>{callStatus === 'ringing' ? 'INCOMING CALL' : 'CALL IN PROGRESS'}</Text>
            <Text style={styles.callerIdText}>{callerId || 'Unknown Number'}</Text>
          </View>
          {callStatus === 'active' && (
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
            </View>
          )}
        </View>

        {/* IN-CALL CONTROLS GRID */}
        <View style={styles.inCallActionGrid}>
          <TouchableOpacity style={[styles.inCallActionBtn, isMuted && styles.actionBtnActive]} onPress={handleMuteToggle}>
            <Text style={styles.inCallActionIcon}>{isMuted ? '🎙️❌' : '🎙️'}</Text>
            <Text style={styles.inCallActionText}>{isMuted ? 'UNMUTE' : 'MUTE'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.inCallActionBtn, isSpeakerOn && styles.actionBtnActive]} onPress={handleSpeakerToggle}>
            <Text style={styles.inCallActionIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
            <Text style={styles.inCallActionText}>{isSpeakerOn ? 'SPEAKER ON' : 'SPEAKER'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.inCallActionBtn} onPress={handleHangup}>
            <View style={styles.hangupBtnCircle}>
              <Text style={{ fontSize: 24 }}>📞</Text>
            </View>
            <Text style={[styles.inCallActionText, { color: COLORS.neonRed }]}>END CALL</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.transcriptContainer} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={styles.scanningText}>[ J.A.R.V.I.S AI LIVE AUDIO INTERACTION ]</Text>
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
    opacity: 0.12,
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.neonCyan,
    opacity: 0.08,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.neonCyan,
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tabContentContainer: {
    flex: 1,
    marginBottom: 10,
  },
  tabScroll: {
    flex: 1,
  },
  coreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 220,
  },
  halo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  coreButtonContainer: {
    zIndex: 10,
  },
  coreButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  coreIcon: {
    fontSize: 24,
    marginBottom: 4,
    color: COLORS.text,
  },
  coreText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  glassCard: {
    backgroundColor: COLORS.glassBg,
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  cardTitle: {
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: 12,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTextCyan: {
    color: COLORS.neonCyan,
    fontSize: 10,
    fontWeight: '700',
  },
  actionTextRed: {
    color: COLORS.neonRed,
    fontSize: 10,
    fontWeight: '700',
  },
  debugLogBox: {
    maxHeight: 140,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 8,
  },
  logText: {
    color: COLORS.neonCyan,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  authButton: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  authButtonText: {
    color: COLORS.neonCyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Dialpad Styles
  dialpadContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  dialDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    backgroundColor: COLORS.glassBg,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  dialedNumberText: {
    fontSize: 26,
    color: COLORS.neonCyan,
    fontWeight: '700',
    letterSpacing: 2,
  },
  deleteButton: {
    position: 'absolute',
    right: 16,
  },
  deleteButtonText: {
    color: COLORS.neonRed,
    fontSize: 22,
  },
  keypadGrid: {
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  keypadButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadValue: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '600',
  },
  callCallButton: {
    backgroundColor: COLORS.neonGreen,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  callCallIcon: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  // Contacts & Recents Styles
  searchInput: {
    backgroundColor: COLORS.glassBg,
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.text,
    fontWeight: '800',
  },
  contactName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  contactNumber: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  contactDialBtn: {
    padding: 8,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  // Bottom Navigation Bar
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    backgroundColor: 'rgba(5, 10, 25, 0.95)',
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: 20,
    marginBottom: 10,
  },
  tabItem: {
    alignItems: 'center',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    marginTop: 2,
  },
  tabActiveText: {
    color: COLORS.neonCyan,
    opacity: 1,
    fontWeight: '700',
  },
  // In-Call Overlay Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.75,
    backgroundColor: 'rgba(5, 10, 25, 0.98)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 24,
    elevation: 30,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  callLabel: {
    fontSize: 11,
    color: COLORS.neonRed,
    letterSpacing: 2,
    marginBottom: 4,
  },
  callerIdText: {
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '400',
  },
  timerBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderColor: COLORS.neonCyan,
    borderWidth: 1,
  },
  timerText: {
    color: COLORS.neonCyan,
    fontWeight: '800',
    fontSize: 15,
  },
  inCallActionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 16,
  },
  inCallActionBtn: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    borderColor: COLORS.neonCyan,
    borderWidth: 1,
  },
  inCallActionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  inCallActionText: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: '700',
  },
  hangupBtnCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.neonRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    transform: [{ rotate: '135deg' }],
  },
  transcriptContainer: {
    flex: 1,
  },
  scanningText: {
    color: COLORS.neonCyan,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    fontSize: 11,
    marginTop: 10,
  },
});
