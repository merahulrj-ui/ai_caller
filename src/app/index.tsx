import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  requestPermissions,
  answerCall,
  enableSpeakerphone,
  subscribeToCalls,
  requestDefaultDialer,
  isDefaultDialer,
  setAiEnabled,
  getDebugLogs,
  clearDebugLogs,
  endCall,
  makeCall,
  muteMicrophone,
  getRealCallLogs,
  getRealContacts,
  getSimCardsInfo,
  speakCallAudio,
  stopCallAudio,
} from '../services/CallManager';
import {
  generateAiCallReply,
  speakAiVoiceResponse,
  stopAiVoiceResponse,
} from '../services/GeminiAiService';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#050814',
  bgCard: 'rgba(13, 22, 45, 0.75)',
  bgCardSolid: '#0B152B',
  glassBorder: 'rgba(0, 240, 255, 0.2)',
  neonCyan: '#00F0FF',
  neonBlue: '#0070FF',
  neonGreen: '#10B981',
  neonRed: '#EF4444',
  neonAmber: '#F59E0B',
  text: '#FFFFFF',
  textSub: '#94A3B8',
  textDim: '#64748B',
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

// Pure Zero-Dependency Vector Call End Icon
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
  const [activeTab, setActiveTab] = useState('jarvis'); // 'jarvis' | 'contacts' | 'recents' | 'dialpad'
  const [permResults, setPermResults] = useState({});
  const [allPermsGranted, setAllPermsGranted] = useState(false);
  const [aiActive, setAiActive] = useState(true);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'ringing' | 'active' | 'outgoing'
  const [callerId, setCallerId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [debugLogs, setDebugLogs] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // In-Call Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Dialpad & SIM Chooser States
  const [dialedNumber, setDialedNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showSimModal, setShowSimModal] = useState(false);
  const [pendingCallTarget, setPendingCallTarget] = useState('');
  const [selectedSim, setSelectedSim] = useState('SIM 1');

  // Real Contacts & Call Logs & SIM Info
  const [contactsList, setContactsList] = useState(MOCK_CONTACTS);
  const [callLogsList, setCallLogsList] = useState(MOCK_LOGS);
  const [simCardsList, setSimCardsList] = useState([
    { slot: 0, name: 'SIM 1 • Primary Line', carrier: 'Cellular SIM 1' },
    { slot: 1, name: 'SIM 2 • Secondary Line', carrier: 'Cellular SIM 2' }
  ]);

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
      const sims = await getSimCardsInfo();
      if (sims && sims.length > 0) {
        setSimCardsList(sims);
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
    if (activeTab === 'jarvis') {
      refreshLogs();
    } else if (activeTab === 'recents' || activeTab === 'contacts') {
      fetchPhoneData();
    }
  }, [activeTab]);

  // High-Tech Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let pulse, rotate;
    if (aiActive) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
      pulseAnim.setValue(1);
      rotationAnim.setValue(0);
    }
    return () => {
      if (pulse) pulse.stop();
      if (rotate) rotate.stop();
    };
  }, [aiActive]);

  useEffect(() => {
    let interval;
    if (callStatus === 'active') {
      setCallDuration(0);
      interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
      startAiCallGreeting();
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Live Conversation Feed
  const [conversation, setConversation] = useState([]);
  const [speechInput, setSpeechInput] = useState('');
  const [isAiTalking, setIsAiTalking] = useState(false);

  const startAiCallGreeting = async () => {
    try {
      const greeting = "Hello! Main Rahul ka assistant Jarvis bol raha hu. Rahul ji abhi busy hain, bataiye main kya message de du?";
      setConversation([{ id: '1', sender: 'jarvis', text: greeting, time: new Date().toLocaleTimeString() }]);
      setIsAiTalking(true);
      await speakCallAudio(greeting);
      setIsAiTalking(false);
    } catch (e) {}
  };

  const handleSendSpeechInput = async (customText) => {
    const textToSend = customText || speechInput;
    if (!textToSend.trim()) return;

    const userMsg = { id: Date.now().toString(), sender: 'caller', text: textToSend, time: new Date().toLocaleTimeString() };
    setConversation((prev) => [...prev, userMsg]);
    if (!customText) setSpeechInput('');

    setIsAiTalking(true);
    const aiReply = await generateAiCallReply(textToSend, conversation);
    const aiMsg = { id: (Date.now() + 1).toString(), sender: 'jarvis', text: aiReply, time: new Date().toLocaleTimeString() };
    setConversation((prev) => [...prev, aiMsg]);

    await speakAiVoiceResponse(aiReply, () => {
      setIsAiTalking(false);
    });
  };

  // 10-Second Auto-Answer Timer Ref
  const autoAnswerTimerRef = useRef(null);

  // Subscribe to Native Call Events
  useEffect(() => {
    const unsubscribe = subscribeToCalls(
      (number) => {
        setCallStatus('ringing');
        setCallerId(number || 'Incoming Call');

        if (autoAnswerTimerRef.current) {
          clearTimeout(autoAnswerTimerRef.current);
        }

        if (aiActive) {
          autoAnswerTimerRef.current = setTimeout(async () => {
            await answerCall();
            await enableSpeakerphone(true);
            setIsSpeakerOn(true);
            setCallStatus('active');
          }, 10000);
        }
      },
      async (evt) => {
        if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
        const wasRinging = callStatus === 'ringing';
        setCallStatus('active');
        await enableSpeakerphone(true);
        setIsSpeakerOn(true);
        if (wasRinging || (evt && evt.isIncoming)) {
          await startAiCallGreeting();
        }
      },
      async () => {
        if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
        setCallStatus('idle');
        setCallerId('');
        setCallDuration(0);
        setIsMuted(false);
        setIsSpeakerOn(false);
        await stopAiVoiceResponse();
        await fetchPhoneData();
        setTimeout(fetchPhoneData, 1500);
      }
    );
    return () => {
      if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
      unsubscribe();
    };
  }, [aiActive, callStatus]);

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

  const toggleAI = async () => {
    const nextState = !aiActive;
    setAiActive(nextState);
    setAiEnabled(nextState);
    if (nextState) {
      Speech.stop();
      Speech.speak("Welcome Sir. Jarvis autonomous system is online.", {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    }
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
    if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
    await stopAiVoiceResponse();
    await endCall();
    await fetchPhoneData();
    setTimeout(fetchPhoneData, 1500);
    setCallStatus('idle');
  };

  const handleDialpadPress = (val) => {
    setDialedNumber((prev) => prev + val);
  };

  const handleDialpadDelete = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const triggerCallSimSelection = (numToCall) => {
    const target = numToCall || dialedNumber;
    if (!target) return;
    setPendingCallTarget(target);
    setShowSimModal(true);
  };

  const confirmCallWithSim = async (simSlot) => {
    const slotIndex = simSlot === 'SIM 1' ? 0 : 1;
    setSelectedSim(simSlot);
    setShowSimModal(false);
    setCallerId(pendingCallTarget);
    setCallStatus('outgoing');
    await makeCall(pendingCallTarget, slotIndex);
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
    (c) => (c.name || '').toLowerCase().includes(contactSearch.toLowerCase()) || (c.number || '').includes(contactSearch)
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Atmospheric Background Glows */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <Animated.View style={[styles.mainContent, { opacity: fadeInAnim }]}>
        {/* Sleek Futuristic Top Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.appTitle}>J.A.R.V.I.S</Text>
            <Text style={styles.appSubtitle}>AUTONOMOUS AI CALL SYSTEM</Text>
          </View>
          <View style={[styles.statusPill, aiActive ? styles.statusPillActive : styles.statusPillOffline]}>
            <View style={[styles.statusDot, aiActive ? styles.statusDotActive : styles.statusDotOffline]} />
            <Text style={[styles.statusPillText, aiActive ? styles.statusTextActive : styles.statusTextOffline]}>
              {aiActive ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        {/* Dynamic Navigation Tab Bar */}
        <View style={styles.navigationTabBar}>
          {[
            { id: 'jarvis', icon: '🤖', label: 'J.A.R.V.I.S' },
            { id: 'contacts', icon: '👤', label: 'Contacts' },
            { id: 'recents', icon: '🕒', label: 'Recents' },
            { id: 'dialpad', icon: '⌨️', label: 'Keypad' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.navTabBtn, isActive && styles.navTabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={styles.navTabIcon}>{tab.icon}</Text>
                <Text style={[styles.navTabLabel, isActive && styles.navTabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: J.A.R.V.I.S REACTOR CORE CONTROL CENTER */}
        {activeTab === 'jarvis' && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Glowing Reactor Core Unit */}
            <View style={styles.reactorSection}>
              <View style={styles.reactorCoreRingContainer}>
                <Animated.View style={[styles.reactorOuterRing, { transform: [{ rotate: spin }] }]} />
                <Animated.View style={[styles.reactorPulseRing, { transform: [{ scale: pulseAnim }] }]} />

                <TouchableOpacity style={styles.reactorCoreButton} onPress={toggleAI} activeOpacity={0.8}>
                  <Text style={styles.reactorButtonIcon}>{aiActive ? '⚡' : '⭕'}</Text>
                  <Text style={styles.reactorButtonTitle}>{aiActive ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}</Text>
                  <Text style={styles.reactorButtonSub}>{aiActive ? 'TOUCH TO DEACTIVATE' : 'TOUCH TO ACTIVATE'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* System Controls & Authorization Card */}
            <View style={styles.glassCard}>
              <Text style={styles.cardHeaderTitle}>SYSTEM AUTHORIZATION & CONTROLS</Text>

              <TouchableOpacity
                style={[styles.actionBtnBlock, isDefault ? styles.btnBlockSuccess : styles.btnBlockDanger]}
                onPress={async () => {
                  await requestDefaultDialer();
                  await checkDefaultStatus();
                }}
              >
                <Text style={[styles.btnBlockText, { color: isDefault ? COLORS.neonGreen : COLORS.neonRed }]}>
                  {isDefault ? '✓ DEFAULT PHONE ASSISTANT ACTIVE' : '⚡ SET AS DEFAULT DIALER'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtnBlock, { marginTop: 10, borderColor: COLORS.neonCyan }]} onPress={handlePermissions}>
                <Text style={[styles.btnBlockText, { color: COLORS.neonCyan }]}>GRANT DIALER PERMISSIONS</Text>
              </TouchableOpacity>
            </View>

            {/* Live System Debugger Console Card */}
            <View style={[styles.glassCard, { marginTop: 14 }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>LIVE ENGINE LOG DIAGNOSTICS</Text>
                <TouchableOpacity onPress={refreshLogs}>
                  <Text style={styles.refreshBtnText}>🔄 REFRESH</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.consoleBox} nestedScrollEnabled={true}>
                <Text style={styles.consoleText}>{debugLogs || 'No system logs recorded yet.'}</Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.clearLogsBtn}
                onPress={async () => {
                  await clearDebugLogs();
                  await refreshLogs();
                }}
              >
                <Text style={styles.clearLogsBtnText}>CLEAR DIAGNOSTIC LOGS</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* TAB 2: CONTACTS BOOK */}
        {activeTab === 'contacts' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBarContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search 5000+ Contacts..."
                placeholderTextColor={COLORS.textDim}
                value={contactSearch}
                onChangeText={setContactSearch}
              />
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id || item.number}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: contact }) => {
                const hasName = contact.name && contact.name !== contact.number;
                const displayName = hasName ? contact.name : contact.number;
                const displayNum = hasName ? contact.number : '';
                const initialChar = hasName ? contact.name[0].toUpperCase() : '👤';

                return (
                  <View style={styles.contactItemCard}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitialText}>{initialChar}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.contactItemName}>{displayName}</Text>
                      {displayNum ? <Text style={styles.contactItemNumber}>{displayNum}</Text> : null}
                    </View>

                    <TouchableOpacity style={styles.dialIconBtn} onPress={() => triggerCallSimSelection(contact.number)}>
                      <Text style={{ fontSize: 20 }}>📞</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* TAB 3: RECENT CALL HISTORY */}
        {activeTab === 'recents' && (
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeaderTitle}>RECENT CALL LOG HISTORY</Text>
            <FlatList
              data={callLogsList}
              keyExtractor={(item) => item.id || item.time + Math.random()}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: log }) => (
                <View style={styles.contactItemCard}>
                  <View style={[styles.avatarCircle, { backgroundColor: log.type === 'missed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 240, 255, 0.15)' }]}>
                    <Text style={{ fontSize: 18 }}>
                      {log.type === 'incoming' ? '📥' : log.type === 'outgoing' ? '📤' : '❌'}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.contactItemName}>{log.name || log.number}</Text>
                    <Text style={styles.contactItemNumber}>
                      {log.number} • {log.time}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.dialIconBtn} onPress={() => triggerCallSimSelection(log.number)}>
                    <Text style={{ fontSize: 20 }}>📞</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        )}

        {/* TAB 4: HIGH-TECH KEYPAD DIALER */}
        {activeTab === 'dialpad' && (
          <View style={styles.dialpadContainer}>
            <View style={styles.dialedNumberDisplay}>
              <Text style={styles.dialedNumberText}>{dialedNumber || 'Enter Phone Number'}</Text>
              {dialedNumber.length > 0 && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDialpadDelete}>
                  <Text style={styles.deleteBtnText}>⌫</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Keypad Grid */}
            <View style={styles.keypadGrid}>
              {[
                { num: '1', sub: '' },
                { num: '2', sub: 'ABC' },
                { num: '3', sub: 'DEF' },
                { num: '4', sub: 'GHI' },
                { num: '5', sub: 'JKL' },
                { num: '6', sub: 'MNO' },
                { num: '7', sub: 'PQRS' },
                { num: '8', sub: 'TUV' },
                { num: '9', sub: 'WXYZ' },
                { num: '*', sub: '' },
                { num: '0', sub: '+' },
                { num: '#', sub: '' },
              ].map((key) => (
                <TouchableOpacity key={key.num} style={styles.keypadBtn} onPress={() => handleDialpadPress(key.num)}>
                  <Text style={styles.keypadNumText}>{key.num}</Text>
                  {key.sub ? <Text style={styles.keypadSubText}>{key.sub}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Call Button */}
            <View style={styles.dialpadActionRow}>
              <TouchableOpacity
                style={[styles.bigCallBtn, !dialedNumber && { opacity: 0.5 }]}
                disabled={!dialedNumber}
                onPress={() => triggerCallSimSelection()}
              >
                <Text style={styles.bigCallBtnIcon}>📞</Text>
                <Text style={styles.bigCallBtnText}>PLACE CELLULAR CALL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>

      {/* DUAL SIM SELECTION MODAL */}
      <Modal transparent={true} visible={showSimModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.simModalBox}>
            <Text style={styles.simModalTitle}>SELECT CELLULAR LINE</Text>
            <Text style={styles.simModalSub}>Placing call to: {pendingCallTarget}</Text>

            {simCardsList.map((sim, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.simOptionCard}
                onPress={() => confirmCallWithSim(`SIM ${sim.slot + 1}`)}
              >
                <View style={[styles.simBadgeCircle, idx === 1 && { backgroundColor: COLORS.neonBlue }]}>
                  <Text style={styles.simBadgeText}>{sim.slot + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.simNameText}>{sim.name}</Text>
                  <Text style={styles.simCarrierText}>{sim.carrier}</Text>
                </View>
                <Text style={{ fontSize: 20 }}>📶</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelSimBtn} onPress={() => setShowSimModal(false)}>
              <Text style={styles.cancelSimBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FULL-SCREEN IN-CALL SYSTEM OVERLAY NATIVE MODAL */}
      <Modal
        visible={callStatus === 'ringing' || callStatus === 'active' || callStatus === 'outgoing'}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={handleHangup}
      >
        <View style={styles.fullInCallContainer}>
          {callStatus === 'ringing' ? (
            /* INCOMING CALL BANNER SCREEN */
            <View style={styles.incomingContainer}>
              <View style={styles.incomingTagBadge}>
                <View style={styles.pulseDotRed} />
                <Text style={styles.incomingTagText}>INCOMING TELECOM CALL TRANSMISSION</Text>
              </View>

              <View style={styles.glowingAvatarBox}>
                <Animated.View style={[styles.avatarPulseWaveRing, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.avatarCircleBig}>
                  <Text style={styles.avatarInitialBig}>{callerId ? callerId[0].toUpperCase() : '📞'}</Text>
                </View>
              </View>

              <Text style={styles.incomingCallerTitle}>{callerId || 'Incoming Call'}</Text>
              <Text style={styles.incomingCallerSubTitle}>Cellular Voice Line • India</Text>

              {aiActive && (
                <View style={styles.aiTagCard}>
                  <Text style={styles.aiTagCardText}>🤖 J.A.R.V.I.S AUTO-ANSWER ACTIVE (10s)</Text>
                </View>
              )}

              {/* Action Buttons Row */}
              <View style={styles.incomingActionRowBtns}>
                <TouchableOpacity style={styles.circleCallActionBtn} onPress={handleHangup}>
                  <View style={[styles.circleIconBox, { backgroundColor: COLORS.neonRed }]}>
                    <PureVectorCallEndIcon />
                  </View>
                  <Text style={[styles.actionBtnLabelText, { color: COLORS.neonRed }]}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.circleCallActionBtn}
                  onPress={async () => {
                    if (autoAnswerTimerRef.current) clearTimeout(autoAnswerTimerRef.current);
                    await answerCall();
                    await enableSpeakerphone(true);
                    setIsSpeakerOn(true);
                    setCallStatus('active');
                  }}
                >
                  <View style={[styles.circleIconBox, { backgroundColor: COLORS.neonGreen }]}>
                    <Text style={{ fontSize: 26, color: '#000' }}>📞</Text>
                  </View>
                  <Text style={[styles.actionBtnLabelText, { color: COLORS.neonGreen }]}>Answer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ACTIVE IN-CALL & OUTGOING CHAT BUBBLES VIEW */
            <View style={{ flex: 1, padding: 24 }}>
              <View style={styles.activeCallHeaderCard}>
                <View>
                  <Text style={styles.activeCallerTitle}>{callerId || 'Active Call'}</Text>
                  <Text style={styles.activeCallerSubTitle}>
                    {selectedSim} • {callStatus === 'outgoing' ? 'DIALING RECEIVER...' : formatDuration(callDuration)}
                  </Text>
                </View>

                <TouchableOpacity style={styles.hangupCircleSmallBtn} onPress={handleHangup}>
                  <PureVectorCallEndIcon />
                </TouchableOpacity>
              </View>

              {/* Call Controls Bar */}
              <View style={styles.inCallControlsRow}>
                <TouchableOpacity style={[styles.controlPillBtn, isMuted && styles.controlPillActive]} onPress={handleMuteToggle}>
                  <Text style={styles.controlPillIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
                  <Text style={styles.controlPillLabel}>{isMuted ? 'UNMUTE' : 'MUTE'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlPillBtn, isSpeakerOn && styles.controlPillActive]} onPress={handleSpeakerToggle}>
                  <Text style={styles.controlPillIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
                  <Text style={styles.controlPillLabel}>SPEAKER</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlPillBtn, aiActive && styles.controlPillActive]} onPress={toggleAI}>
                  <Text style={styles.controlPillIcon}>🤖</Text>
                  <Text style={styles.controlPillLabel}>J.A.R.V.I.S</Text>
                </TouchableOpacity>
              </View>

              {/* Live Conversation Chat Feed */}
              <View style={styles.chatFeedCardBox}>
                <View style={styles.chatHeaderRowBox}>
                  <Text style={styles.chatTitleText}>LIVE AI CONVERSATION FEED</Text>
                  {isAiTalking && (
                    <View style={styles.talkingBadgeBox}>
                      <Text style={styles.talkingBadgeText}>🎙️ J.A.R.V.I.S SPEAKING</Text>
                    </View>
                  )}
                </View>

                <ScrollView style={styles.chatFeedScroll} showsVerticalScrollIndicator={false}>
                  {conversation.map((msg) => (
                    <View key={msg.id} style={[styles.msgBubble, msg.sender === 'jarvis' ? styles.msgJarvis : styles.msgCaller]}>
                      <Text style={styles.msgSenderLabel}>{msg.sender === 'jarvis' ? '🤖 J.A.R.V.I.S' : '👤 CALLER'}</Text>
                      <Text style={styles.msgTextContent}>{msg.text}</Text>
                      <Text style={styles.msgTimeLabel}>{msg.time}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Live Speech Simulation Input */}
              <View style={styles.speechSimulationInputRow}>
                <TextInput
                  style={styles.speechTextInputField}
                  placeholder="Simulate Caller Speech..."
                  placeholderTextColor={COLORS.textDim}
                  value={speechInput}
                  onChangeText={setSpeechInput}
                  onSubmitEditing={() => handleSendSpeechInput()}
                />
                <TouchableOpacity style={styles.speechSendBtn} onPress={() => handleSendSpeechInput()}>
                  <Text style={styles.speechSendBtnText}>SPEAK</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.neonCyan,
    opacity: 0.12,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -80,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: COLORS.neonBlue,
    opacity: 0.1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neonCyan,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.neonGreen,
  },
  statusPillOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: COLORS.neonRed,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: COLORS.neonGreen,
  },
  statusDotOffline: {
    backgroundColor: COLORS.neonRed,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusTextActive: {
    color: COLORS.neonGreen,
  },
  statusTextOffline: {
    color: COLORS.neonRed,
  },
  // Floating Tab Navigation Bar
  navigationTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 4,
    marginBottom: 18,
    elevation: 8,
  },
  navTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  navTabBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
  },
  navTabIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDim,
  },
  navTabLabelActive: {
    color: COLORS.text,
    fontWeight: '900',
  },
  // Reactor Core Section
  reactorSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  reactorCoreRingContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactorOuterRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  reactorPulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: COLORS.neonCyan,
  },
  reactorCoreButton: {
    width: 145,
    height: 145,
    borderRadius: 72.5,
    backgroundColor: COLORS.bgCardSolid,
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 15,
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  reactorButtonIcon: {
    fontSize: 32,
  },
  reactorButtonTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
    marginTop: 4,
  },
  reactorButtonSub: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.neonCyan,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  // Cards & Layout
  glassCard: {
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 18,
    elevation: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  actionBtnBlock: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBlockSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.neonGreen,
  },
  btnBlockDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: COLORS.neonRed,
  },
  btnBlockText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.neonCyan,
  },
  consoleBox: {
    height: 140,
    backgroundColor: '#02050E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  consoleText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.neonCyan,
    lineHeight: 16,
  },
  clearLogsBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  clearLogsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.neonRed,
  },
  // Contacts & Recents List Styling
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  contactItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  contactItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  contactItemNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 2,
  },
  dialIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: COLORS.neonGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // High-Tech Keypad
  dialpadContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  dialedNumberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginVertical: 10,
  },
  dialedNumberText: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  deleteBtn: {
    position: 'absolute',
    right: 10,
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 24,
    color: COLORS.neonRed,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  keypadBtn: {
    width: (width - 80) / 3,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.bgCardSolid,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  keypadNumText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  keypadSubText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.neonCyan,
    letterSpacing: 1,
  },
  dialpadActionRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  bigCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: width - 80,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.neonGreen,
    elevation: 10,
  },
  bigCallBtnIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  bigCallBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 5, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  simModalBox: {
    width: width - 40,
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    padding: 20,
  },
  simModalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 1.5,
  },
  simModalSub: {
    fontSize: 12,
    color: COLORS.textSub,
    marginBottom: 16,
    marginTop: 4,
  },
  simOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    padding: 14,
    marginBottom: 10,
  },
  simBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.neonGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  simNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  simCarrierText: {
    fontSize: 11,
    color: COLORS.textSub,
  },
  cancelSimBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelSimBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.neonRed,
  },
  // Full-Screen In-Call Overlay Modal
  fullInCallContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  incomingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 30,
  },
  incomingTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: COLORS.neonRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pulseDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.neonRed,
    marginRight: 8,
  },
  incomingTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.neonRed,
    letterSpacing: 1,
  },
  glowingAvatarBox: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseWaveRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.neonCyan,
  },
  avatarCircleBig: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.bgCardSolid,
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialBig: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.text,
  },
  incomingCallerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  incomingCallerSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 4,
  },
  aiTagCard: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  aiTagCardText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.neonCyan,
  },
  incomingActionRowBtns: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  circleCallActionBtn: {
    alignItems: 'center',
  },
  circleIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  actionBtnLabelText: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
  // Active In-Call Styling
  activeCallHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 16,
    marginBottom: 16,
  },
  activeCallerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  activeCallerSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.neonCyan,
    marginTop: 2,
  },
  hangupCircleSmallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neonRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCallControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  controlPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  controlPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    borderColor: COLORS.neonCyan,
  },
  controlPillIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  controlPillLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.text,
  },
  chatFeedCardBox: {
    flex: 1,
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 16,
    marginBottom: 14,
  },
  chatHeaderRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatTitleText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 1,
  },
  talkingBadgeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  talkingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neonGreen,
  },
  chatFeedScroll: {
    flex: 1,
  },
  msgBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '85%',
  },
  msgJarvis: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
  },
  msgCaller: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  msgSenderLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neonCyan,
    marginBottom: 4,
  },
  msgTextContent: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  msgTimeLabel: {
    fontSize: 9,
    color: COLORS.textDim,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  speechSimulationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speechTextInputField: {
    flex: 1,
    height: 46,
    backgroundColor: COLORS.bgCardSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 13,
  },
  speechSendBtn: {
    marginLeft: 10,
    backgroundColor: COLORS.neonCyan,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  speechSendBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
});
