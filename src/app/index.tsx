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
  TextInput,
  Modal
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
  requestDefaultDialer,
  isDefaultDialer,
  setAiEnabled,
  getRealCallLogs,
  getRealContacts
} from '../services/CallManager';
import {
  generateAiCallReply,
  speakAiVoiceResponse,
  stopAiVoiceResponse
} from '../services/GeminiAiService';

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

// Pure Zero-Dependency 100% Crisp White Vector Phone Receiver Icon
const PureVectorCallEndIcon = () => (
  <View style={{ width: 28, height: 16, alignItems: 'center', justifyContent: 'center' }}>
    <View
      style={{
        width: 24,
        height: 12,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 3.5,
        borderColor: '#FFFFFF',
        borderBottomWidth: 0,
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: 1,
        bottom: 0,
        width: 6,
        height: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
      }}
    />
    <View
      style={{
        position: 'absolute',
        right: 1,
        bottom: 0,
        width: 6,
        height: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
      }}
    />
  </View>
);

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('jarvis'); // 'recents' | 'contacts' | 'dialpad' | 'jarvis'
  const [permResults, setPermResults] = useState({});
  const [allPermsGranted, setAllPermsGranted] = useState(false);
  const [aiActive, setAiActive] = useState(true);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'ringing' | 'active'
  const [callerId, setCallerId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [debugLogs, setDebugLogs] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // In-Call States
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Dialpad & SIM Modal States
  const [dialedNumber, setDialedNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showSimModal, setShowSimModal] = useState(false);
  const [pendingCallTarget, setPendingCallTarget] = useState('');
  const [selectedSim, setSelectedSim] = useState('SIM 1');

  // Real Contacts & Real Call History Logs States
  const [contactsList, setContactsList] = useState(MOCK_CONTACTS);
  const [callLogsList, setCallLogsList] = useState(MOCK_LOGS);

  const fetchPhoneData = async () => {
    try {
      const realLogs = await getRealCallLogs();
      if (realLogs && realLogs.length > 0) {
        setCallLogsList(realLogs);
      }
      const realContacts = await getRealContacts();
      if (realContacts && realContacts.length > 0) {
        setContactsList(realContacts);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchPhoneData();
  }, []);

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

  // Phase 2: Live AI Speech & Voice Conversation States
  const [conversation, setConversation] = useState([]);
  const [speechInput, setSpeechInput] = useState('');
  const [isAiTalking, setIsAiTalking] = useState(false);

  const startAiCallGreeting = async () => {
    if (!aiActive) return;
    const initialGreeting = "Namaste! Main Rahul ka J.A.R.V.I.S AI Assistant bol raha hu. Rahul ji abhi busy hain, bataiye main kya sahayata kar sakta hu?";
    setConversation([{ id: '1', sender: 'jarvis', text: initialGreeting, time: 'Just now' }]);
    setIsAiTalking(true);
    await speakAiVoiceResponse(initialGreeting, () => {
      setIsAiTalking(false);
    });
  };

  const handleSendSpeechInput = async (inputText) => {
    const textToSend = inputText || speechInput;
    if (!textToSend) return;

    const userMsg = { id: Date.now().toString(), sender: 'caller', text: textToSend, time: 'Just now' };
    setConversation((prev) => [...prev, userMsg]);
    setSpeechInput('');

    setIsAiTalking(true);
    const aiReply = await generateAiCallReply(textToSend, conversation);
    const aiMsg = { id: (Date.now() + 1).toString(), sender: 'jarvis', text: aiReply, time: 'Just now' };
    setConversation((prev) => [...prev, aiMsg]);

    await speakAiVoiceResponse(aiReply, () => {
      setIsAiTalking(false);
    });
  };

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
        startAiCallGreeting();
      },
      () => {
        setCallStatus('idle');
        setCallerId('');
        setCallDuration(0);
        setIsMuted(false);
        setIsSpeakerOn(false);
        stopAiVoiceResponse();
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
    await fetchPhoneData();
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
    await stopAiVoiceResponse();
    await endCall();
    setCallStatus('idle');
  };

  const handleDialPress = (val) => {
    setDialedNumber((prev) => prev + val);
  };

  const handleDialDelete = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  // Open SIM Selection Modal before placing call
  const triggerCallSimSelection = (numToCall) => {
    const target = numToCall || dialedNumber;
    if (!target) return;
    setPendingCallTarget(target);
    setShowSimModal(true);
  };

  // Start Call on selected SIM (SIM 1 or SIM 2)
  const confirmCallWithSim = async (simSlot) => {
    setSelectedSim(simSlot);
    setShowSimModal(false);
    setCallerId(pendingCallTarget);
    setCallStatus('active');
    await makeCall(pendingCallTarget);
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

  const filteredContacts = contactsList.filter(
    (c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch)
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Background Glows */}
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

              <TouchableOpacity style={styles.callCallButton} onPress={() => triggerCallSimSelection()}>
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
                    <TouchableOpacity style={styles.contactDialBtn} onPress={() => triggerCallSimSelection(contact.number)}>
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
              {callLogsList.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>
                    {log.type === 'incoming' ? '↙️' : log.type === 'outgoing' ? '↗️' : '❌'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{log.name}</Text>
                    <Text style={styles.contactNumber}>{log.number} • {log.time}</Text>
                  </View>
                  <TouchableOpacity style={styles.contactDialBtn} onPress={() => triggerCallSimSelection(log.number)}>
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

      {/* DUAL SIM SELECTION POPUP MODAL */}
      <Modal transparent={true} visible={showSimModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.simModalBox}>
            <Text style={styles.simModalTitle}>SELECT TELECOM LINE</Text>
            <Text style={styles.simModalSub}>Make Call to: {pendingCallTarget}</Text>

            {/* SIM 1 Selection Card */}
            <TouchableOpacity style={styles.simOptionCard} onPress={() => confirmCallWithSim('SIM 1')}>
              <View style={styles.simIconBadge}>
                <Text style={styles.simBadgeText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simTitle}>SIM 1 • Jio 4G / Airtel</Text>
                <Text style={styles.simSubText}>Primary Voice & Data Line</Text>
              </View>
              <Text style={{ fontSize: 18 }}>📶</Text>
            </TouchableOpacity>

            {/* SIM 2 Selection Card */}
            <TouchableOpacity style={styles.simOptionCard} onPress={() => confirmCallWithSim('SIM 2')}>
              <View style={[styles.simIconBadge, { backgroundColor: COLORS.neonBlue }]}>
                <Text style={styles.simBadgeText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simTitle}>SIM 2 • Vi 4G / BSNL</Text>
                <Text style={styles.simSubText}>Secondary Voice Line</Text>
              </View>
              <Text style={{ fontSize: 18 }}>📶</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeSimModalBtn} onPress={() => setShowSimModal(false)}>
              <Text style={styles.closeSimModalText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FULL IN-CALL OVERLAY SCREEN */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideUpAnim }] }]}>
        <View style={styles.sheetHeader}>
          <View style={styles.dragHandle} />
        </View>

        {callStatus === 'ringing' ? (
          /* DEDICATED INCOMING CALL SCREEN VIEW */
          <View style={styles.incomingCallContainer}>
            <View style={styles.incomingBadge}>
              <View style={styles.redPulseDot} />
              <Text style={styles.incomingBadgeText}>INCOMING CALL TRANSMISSION</Text>
            </View>

            {/* Glowing Avatar */}
            <View style={styles.incomingAvatarRing}>
              <Animated.View style={[styles.avatarPulseWave, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.incomingAvatarCircle}>
                <Text style={styles.incomingAvatarInitial}>
                  {callerId ? callerId[0].toUpperCase() : '📞'}
                </Text>
              </View>
            </View>

            <Text style={styles.incomingCallerName}>{callerId || 'Incoming Call'}</Text>
            <Text style={styles.incomingCallerSub}>Telecom Voice Line • India</Text>

            {aiActive && (
              <View style={styles.aiAnsweringTag}>
                <Text style={styles.aiAnsweringText}>🤖 J.A.R.V.I.S AUTO-ANSWER ACTIVE</Text>
              </View>
            )}

            {/* INCOMING ACTION BUTTONS (DECLINE / ACCEPT) */}
            <View style={styles.incomingActionRow}>
              <TouchableOpacity style={styles.hangupButtonContainer} onPress={handleHangup}>
                <View style={styles.hangupCircleBtn}>
                  <PureVectorCallEndIcon />
                </View>
                <Text style={styles.hangupText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hangupButtonContainer}
                onPress={async () => {
                  await answerCall();
                  await enableSpeakerphone(true);
                  setIsSpeakerOn(true);
                  setCallStatus('active');
                }}
              >
                <View style={[styles.hangupCircleBtn, { backgroundColor: COLORS.neonGreen, shadowColor: COLORS.neonGreen }]}>
                  <Text style={{ fontSize: 26, color: '#000' }}>📞</Text>
                </View>
                <Text style={[styles.hangupText, { color: COLORS.neonGreen }]}>Answer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ACTIVE CALL SCREEN VIEW */
          <View style={{ flex: 1 }}>
            <View style={styles.callInfoCard}>
              <View>
                <Text style={styles.callLabel}>{`CALL VIA ${selectedSim}`}</Text>
                <Text style={styles.callerIdText}>{callerId || 'Unknown Number'}</Text>
              </View>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
              </View>
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

              <TouchableOpacity style={styles.hangupButtonContainer} onPress={handleHangup}>
                <View style={styles.hangupCircleBtn}>
                  <PureVectorCallEndIcon />
                </View>
                <Text style={styles.hangupText}>End Call</Text>
              </TouchableOpacity>
            </View>

            {/* AI SPEAKING / LISTENING STATUS BAR */}
            <View style={[styles.aiVoiceStatusBar, isAiTalking ? styles.statusTalking : styles.statusListening]}>
              <Text style={styles.aiVoiceStatusText}>
                {isAiTalking ? '🎙️ J.A.R.V.I.S IS SPEAKING...' : '👂 LISTENING TO CALLER...'}
              </Text>
            </View>

            {/* LIVE TRANSCRIPT CONVERSATION BUBBLES */}
            <ScrollView style={styles.transcriptContainer} contentContainerStyle={{ paddingBottom: 15 }}>
              {conversation.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'jarvis' ? styles.jarvisBubble : styles.callerBubble,
                  ]}
                >
                  <Text style={styles.bubbleSender}>
                    {msg.sender === 'jarvis' ? '🤖 J.A.R.V.I.S AI' : '👤 CALLER'}
                  </Text>
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                </View>
              ))}
            </ScrollView>

            {/* LIVE SIMULATED SPEECH INPUT BAR (FOR IN-CALL TESTING) */}
            <View style={styles.liveSpeechInputBar}>
              <TextInput
                style={styles.liveTextInput}
                placeholder="Simulate Caller Speech..."
                placeholderTextColor={COLORS.textDim}
                value={speechInput}
                onChangeText={setSpeechInput}
                onSubmitEditing={() => handleSendSpeechInput()}
              />
              <TouchableOpacity style={styles.sendSpeechBtn} onPress={() => handleSendSpeechInput()}>
                <Text style={styles.sendSpeechBtnText}>SPEAK</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  // SIM Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  simModalBox: {
    width: '100%',
    backgroundColor: 'rgba(10, 18, 40, 0.98)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: 24,
    padding: 20,
  },
  simModalTitle: {
    fontSize: 14,
    color: COLORS.neonCyan,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  simModalSub: {
    fontSize: 12,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  simOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  simIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.neonGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  simBadgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  simTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  simSubText: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  closeSimModalBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  closeSimModalText: {
    color: COLORS.neonRed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  // In-Call Overlay Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height,
    backgroundColor: '#030610',
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
  hangupButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  hangupCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  hangupPhoneIcon: {
    fontSize: 26,
    color: '#FFFFFF',
    transform: [{ rotate: '135deg' }],
  },
  hangupText: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
  },
  // Dedicated Incoming Call Screen Styles
  incomingCallContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
  incomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 42, 42, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.neonRed,
  },
  redPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neonRed,
    marginRight: 8,
  },
  incomingBadgeText: {
    color: COLORS.neonRed,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  incomingAvatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseWave: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    opacity: 0.5,
  },
  incomingAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  incomingAvatarInitial: {
    fontSize: 40,
    color: COLORS.text,
    fontWeight: '800',
  },
  incomingCallerName: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  incomingCallerSub: {
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 4,
  },
  aiAnsweringTag: {
    backgroundColor: 'rgba(0, 255, 102, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderColor: COLORS.neonGreen,
    borderWidth: 1,
  },
  aiAnsweringText: {
    color: COLORS.neonGreen,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  incomingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 20,
  },
  transcriptContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  aiVoiceStatusBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  statusTalking: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderColor: COLORS.neonCyan,
  },
  statusListening: {
    backgroundColor: 'rgba(0, 255, 102, 0.12)',
    borderColor: COLORS.neonGreen,
  },
  aiVoiceStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 1,
  },
  chatBubble: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  jarvisBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderColor: COLORS.neonCyan,
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  callerBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderBottomRightRadius: 2,
  },
  bubbleSender: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.neonCyan,
    marginBottom: 2,
    letterSpacing: 1,
  },
  bubbleText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  liveSpeechInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glassBg,
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  liveTextInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    paddingVertical: 6,
  },
  sendSpeechBtn: {
    backgroundColor: COLORS.neonCyan,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sendSpeechBtnText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
