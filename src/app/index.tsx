import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity,
  ScrollView, FlatList, TextInput, Modal, Dimensions, Animated, Easing,
  Vibration, Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  requestPermissions, answerCall, enableSpeakerphone, subscribeToCalls,
  requestDefaultDialer, isDefaultDialer, setAiEnabled, getDebugLogs,
  clearDebugLogs, endCall, makeCall, muteMicrophone, getRealCallLogs,
  getRealContacts, getSimCardsInfo, speakCallAudio, stopCallAudio,
} from '../services/CallManager';
import {
  generateAiCallReply, speakAiVoiceResponse, stopAiVoiceResponse,
} from '../services/GeminiAiService';

const { width, height } = Dimensions.get('window');

// ── Color Palette (ODialer Dark Theme) ──────────────────────────────────────
const C = {
  bg:         '#0b0b0f',
  surface:    '#161620',
  surfaceAlt: '#1e1e2c',
  border:     '#2a2a3a',
  accent:     '#2979ff',
  green:      '#00c853',
  red:        '#ff1744',
  orange:     '#ff9100',
  white:      '#ffffff',
  textPri:    '#f0f0f5',
  textSec:    '#8e8ea0',
  textDim:    '#55556a',
};

// ── Tiny Phone-End Icon (Zero Dependencies) ─────────────────────────────────
const PhoneEndIcon = ({ size = 24 }) => (
  <View style={{ width: size, height: size * 0.55, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: size * 0.85, height: size * 0.32,
      backgroundColor: C.white, borderRadius: size * 0.16,
      transform: [{ rotate: '135deg' }],
    }} />
  </View>
);

const PhoneIcon = ({ size = 24 }) => (
  <View style={{ width: size, height: size * 0.55, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: size * 0.85, height: size * 0.32,
      backgroundColor: C.white, borderRadius: size * 0.16,
      transform: [{ rotate: '225deg' }],
    }} />
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  // ── Tab & App State ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('recents');
  const [isDefault, setIsDefault] = useState(false);
  const [jarvisEnabled, setJarvisEnabled] = useState(false);
  const [debugLogs, setDebugLogs] = useState('');
  const [contacts, setContacts] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [simCards, setSimCards] = useState([]);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false);
  const [pendingCallTarget, setPendingCallTarget] = useState('');
  const [dialNumber, setDialNumber] = useState('');

  // ── Call State ──────────────────────────────────────────────────────────
  const [callStatus, setCallStatus] = useState('idle');
  const [callerNumber, setCallerNumber] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [aiCountdown, setAiCountdown] = useState(10);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [speechInput, setSpeechInput] = useState('');

  // ── Refs ────────────────────────────────────────────────────────────────
  const isIncomingCallRef = useRef(false);
  const manualAnswerFlag = useRef(false);
  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const aiCountdownRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // ═══ LIFECYCLE & SUBSCRIPTIONS ══════════════════════════════════════════
  useEffect(() => {
    checkDefaultDialer();
    fetchData();

    // subscribeToCalls takes 3 separate callbacks: (onIncoming, onAnswered, onEnded)
    const unsubscribe = subscribeToCalls(
      // ── onIncomingCall ── receives {phoneNumber}
      (evt) => {
        const number = (evt && evt.phoneNumber) || 'Unknown';
        isIncomingCallRef.current = true;
        setCallStatus('ringing');
        setCallerNumber(number);
        setCallerName(number);
        setChatMessages([]);
        setCallDuration(0);
        setIsMuted(false);
        setIsSpeaker(false);

        if (jarvisEnabled) {
          let count = 10;
          setAiCountdown(count);
          if (aiCountdownRef.current) clearInterval(aiCountdownRef.current);
          aiCountdownRef.current = setInterval(async () => {
            count--;
            setAiCountdown(count);
            if (count <= 0) {
              clearInterval(aiCountdownRef.current);
              aiCountdownRef.current = null;
              await answerCall();
              await enableSpeakerphone(true);
              setIsSpeaker(true);
            }
          }, 1000);
        }
      },
      // ── onCallAnswered ── receives {phoneNumber, success, isIncoming}
      async (evt) => {
        if (aiCountdownRef.current) {
          clearInterval(aiCountdownRef.current);
          aiCountdownRef.current = null;
        }

        const wasIncoming = isIncomingCallRef.current || (evt && evt.isIncoming);

        if (!wasIncoming) {
          setCallerNumber(prev => prev || (evt && evt.phoneNumber) || '');
          setCallerName(prev => prev || (evt && evt.phoneNumber) || '');
        }

        setCallStatus('active');

        // Start timer only when call actually connects
        callStartTimeRef.current = Date.now();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
          }
        }, 1000);

        // Jarvis greeting ONLY for incoming calls
        if (wasIncoming && jarvisEnabled && !manualAnswerFlag.current) {
          await enableSpeakerphone(true);
          setIsSpeaker(true);
          startAiGreeting();
        }
      },
      // ── onCallEnded ──
      async () => {
        setCallStatus('idle');
        isIncomingCallRef.current = false;
        manualAnswerFlag.current = false;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (aiCountdownRef.current) clearInterval(aiCountdownRef.current);
        timerIntervalRef.current = null;
        aiCountdownRef.current = null;
        callStartTimeRef.current = null;
        setCallDuration(0);
        setIsMuted(false);
        setIsSpeaker(false);
        setIsAiTalking(false);
        await stopAiVoiceResponse();
        fetchData();
      }
    );

    return () => {
      unsubscribe();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (aiCountdownRef.current) clearInterval(aiCountdownRef.current);
    };
  }, [jarvisEnabled]);

  // Incoming call ring pulse animation
  useEffect(() => {
    if (callStatus === 'ringing') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callStatus]);

  // ═══ HELPER FUNCTIONS ══════════════════════════════════════════════════
  const checkDefaultDialer = async () => {
    try { setIsDefault(await isDefaultDialer()); } catch (e) {}
  };

  const fetchData = async () => {
    try {
      const [logs, conts, sims] = await Promise.all([
        getRealCallLogs(), getRealContacts(), getSimCardsInfo()
      ]);
      if (logs && logs.length) setCallLogs(logs);
      if (conts && conts.length) setContacts(conts);
      if (sims && sims.length) setSimCards(sims);
    } catch (e) {}
  };

  const refreshLogs = async () => {
    try { setDebugLogs(await getDebugLogs() || ''); } catch (e) {}
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getInitial = (name) => {
    if (!name) return '?';
    const clean = name.replace(/[^a-zA-Z]/g, '');
    return clean ? clean[0].toUpperCase() : '#';
  };

  // ═══ JARVIS AI FUNCTIONS ═══════════════════════════════════════════════
  const startAiGreeting = async () => {
    const greeting = "Hello, main Rahul ka assistant Jarvis bol raha hu. Rahul ji abhi busy hain, bataiye main kya message de du?";
    setChatMessages([{ id: '1', sender: 'jarvis', text: greeting, time: new Date().toLocaleTimeString() }]);
    setIsAiTalking(true);
    await speakCallAudio(greeting);
    setIsAiTalking(false);
  };

  const handleSendSpeech = async (customText) => {
    const text = customText || speechInput;
    if (!text.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: 'caller', text, time: new Date().toLocaleTimeString() };
    setChatMessages(prev => [...prev, userMsg]);
    if (!customText) setSpeechInput('');

    setIsAiTalking(true);
    const aiReply = await generateAiCallReply(text, chatMessages);
    const aiMsg = { id: (Date.now() + 1).toString(), sender: 'jarvis', text: aiReply, time: new Date().toLocaleTimeString() };
    setChatMessages(prev => [...prev, aiMsg]);
    await speakAiVoiceResponse(aiReply, () => setIsAiTalking(false));
  };

  // ═══ CALL ACTIONS ══════════════════════════════════════════════════════
  const toggleJarvis = () => {
    const next = !jarvisEnabled;
    setJarvisEnabled(next);
    setAiEnabled(next);
    if (next) {
      Speech.stop();
      Speech.speak("Welcome Sir. Jarvis autonomous system is online.", {
        language: 'en-US', pitch: 1.0, rate: 0.9,
      });
    }
  };

  const handleAnswer = async () => {
    manualAnswerFlag.current = true;
    if (aiCountdownRef.current) { clearInterval(aiCountdownRef.current); aiCountdownRef.current = null; }
    await answerCall();
    await enableSpeakerphone(true);
    setIsSpeaker(true);
  };

  const handleHangup = async () => {
    if (aiCountdownRef.current) { clearInterval(aiCountdownRef.current); aiCountdownRef.current = null; }
    await stopAiVoiceResponse();
    await endCall();
    setCallStatus('idle');
  };

  const initiateCall = async (number, simSlot) => {
    if (!number) return;
    if (simCards.length > 1 && simSlot === undefined) {
      setPendingCallTarget(number);
      setShowSimModal(true);
      return;
    }
    setShowSimModal(false);
    setShowDialpad(false);
    setCallerNumber(number);
    setCallerName(number);
    setCallStatus('outgoing');
    isIncomingCallRef.current = false;
    setChatMessages([]);
    setCallDuration(0);
    await makeCall(number, simSlot !== undefined ? simSlot : 0);
  };

  // ═══ FILTERED DATA ════════════════════════════════════════════════════
  const filteredContacts = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.number || '').includes(searchQuery)
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── HEADER BAR ────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>☎ Phone</Text>
        <TouchableOpacity
          style={[s.jarvisChip, jarvisEnabled && s.jarvisChipActive]}
          onPress={toggleJarvis}
          activeOpacity={0.7}
        >
          <View style={[s.jarvisDot, jarvisEnabled && s.jarvisDotActive]} />
          <Text style={[s.jarvisChipText, jarvisEnabled && s.jarvisChipTextActive]}>
            {jarvisEnabled ? 'JARVIS ON' : 'JARVIS'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB CONTENT ───────────────────────────────────────────── */}

      {/* RECENTS TAB */}
      {activeTab === 'recents' && (
        <FlatList
          data={callLogs}
          keyExtractor={(item, i) => item.id || i.toString()}
          style={s.listContainer}
          contentContainerStyle={{ paddingBottom: 90 }}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={<Text style={s.emptyText}>No recent calls</Text>}
          renderItem={({ item }) => {
            const isMissed = item.type === 'missed';
            const icon = item.type === 'incoming' ? '↙' : item.type === 'outgoing' ? '↗' : '✕';
            const iconColor = isMissed ? C.red : item.type === 'incoming' ? C.green : C.accent;
            return (
              <TouchableOpacity style={s.callLogItem} onPress={() => initiateCall(item.number)} activeOpacity={0.6}>
                <View style={[s.callLogAvatar, isMissed && { borderColor: C.red }]}>
                  <Text style={s.callLogAvatarText}>{getInitial(item.name || item.number)}</Text>
                </View>
                <View style={s.callLogInfo}>
                  <Text style={[s.callLogName, isMissed && { color: C.red }]}>{item.name || item.number}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Text style={[s.callLogIcon, { color: iconColor }]}>{icon}</Text>
                    <Text style={s.callLogMeta}>{item.number} • {item.time}</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.callLogCallBtn} onPress={() => initiateCall(item.number)}>
                  <Text style={{ color: C.green, fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <View style={s.listContainer}>
          <View style={s.searchBar}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor={C.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <FlatList
            data={filteredContacts}
            keyExtractor={(item, i) => item.id || i.toString()}
            contentContainerStyle={{ paddingBottom: 90 }}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={5}
            removeClippedSubviews={true}
            ListEmptyComponent={<Text style={s.emptyText}>No contacts found</Text>}
            renderItem={({ item }) => {
              const hasName = item.name && item.name !== item.number;
              return (
                <TouchableOpacity style={s.contactItem} onPress={() => initiateCall(item.number)} activeOpacity={0.6}>
                  <View style={s.contactAvatar}>
                    <Text style={s.contactAvatarText}>{hasName ? item.name[0].toUpperCase() : '👤'}</Text>
                  </View>
                  <View style={s.contactInfo}>
                    <Text style={s.contactName}>{hasName ? item.name : item.number}</Text>
                    {hasName && <Text style={s.contactNumber}>{item.number}</Text>}
                  </View>
                  <TouchableOpacity style={s.contactCallBtn} onPress={() => initiateCall(item.number)}>
                    <Text style={{ color: C.green, fontSize: 18 }}>📞</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <ScrollView style={s.listContainer} contentContainerStyle={{ paddingBottom: 90 }}>
          <View style={s.settingsSection}>
            <Text style={s.settingsSectionTitle}>JARVIS AI</Text>
            <TouchableOpacity style={s.settingsRow} onPress={toggleJarvis}>
              <Text style={s.settingsLabel}>Jarvis AI Assistant</Text>
              <View style={[s.toggleTrack, jarvisEnabled && s.toggleTrackActive]}>
                <View style={[s.toggleThumb, jarvisEnabled && s.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={s.settingsSection}>
            <Text style={s.settingsSectionTitle}>PHONE SETUP</Text>
            <TouchableOpacity
              style={s.settingsRow}
              onPress={async () => { await requestDefaultDialer(); await checkDefaultDialer(); }}
            >
              <Text style={s.settingsLabel}>Default Phone App</Text>
              <Text style={[s.settingsBadge, isDefault && s.settingsBadgeActive]}>
                {isDefault ? '✓ Active' : 'Set Up'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.settingsRow}
              onPress={async () => { await requestPermissions(); await checkDefaultDialer(); await fetchData(); }}
            >
              <Text style={s.settingsLabel}>Grant Permissions</Text>
              <Text style={{ color: C.accent, fontSize: 13 }}>→</Text>
            </TouchableOpacity>
          </View>

          <View style={s.settingsSection}>
            <Text style={s.settingsSectionTitle}>DEBUG CONSOLE</Text>
            <View style={s.debugBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                <TouchableOpacity onPress={refreshLogs} style={{ marginRight: 14 }}>
                  <Text style={{ color: C.accent, fontSize: 12 }}>🔄 Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => { await clearDebugLogs(); setDebugLogs(''); }}>
                  <Text style={{ color: C.red, fontSize: 12 }}>Clear</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                <Text style={s.debugText}>{debugLogs || 'Tap "Refresh" to load logs...'}</Text>
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── FAB (Floating Action Button) ──────────────────────────── */}
      <TouchableOpacity style={s.fab} onPress={() => setShowDialpad(true)} activeOpacity={0.8}>
        <Text style={{ fontSize: 22 }}>⌨️</Text>
      </TouchableOpacity>

      {/* ── BOTTOM TAB BAR ────────────────────────────────────────── */}
      <View style={s.bottomBar}>
        {[
          { id: 'recents', icon: '🕒', label: 'Recents' },
          { id: 'contacts', icon: '👤', label: 'Contacts' },
          { id: 'settings', icon: '⚙️', label: 'Settings' },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={s.bottomTab} onPress={() => setActiveTab(tab.id)}>
            <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
            <Text style={[s.bottomTabText, activeTab === tab.id && s.bottomTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════
          DIALPAD MODAL
         ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showDialpad} animationType="slide" transparent={false}>
        <SafeAreaView style={s.dialpadScreen}>
          <View style={s.dialpadHeader}>
            <TouchableOpacity onPress={() => setShowDialpad(false)}>
              <Text style={{ color: C.accent, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
          </View>
          <View style={s.dialpadDisplay}>
            <Text style={s.dialpadNumber} numberOfLines={1} adjustsFontSizeToFit>{dialNumber || 'Enter number'}</Text>
          </View>
          <View style={s.keypadGrid}>
            {[
              { n: '1', sub: '' },    { n: '2', sub: 'ABC' },  { n: '3', sub: 'DEF' },
              { n: '4', sub: 'GHI' }, { n: '5', sub: 'JKL' },  { n: '6', sub: 'MNO' },
              { n: '7', sub: 'PQRS' },{ n: '8', sub: 'TUV' },  { n: '9', sub: 'WXYZ' },
              { n: '*', sub: '' },    { n: '0', sub: '+' },    { n: '#', sub: '' },
            ].map(k => (
              <TouchableOpacity key={k.n} style={s.keyBtn} onPress={() => setDialNumber(p => p + k.n)} activeOpacity={0.5}>
                <Text style={s.keyNum}>{k.n}</Text>
                {k.sub ? <Text style={s.keySub}>{k.sub}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.dialpadActions}>
            <View style={{ width: 56 }} />
            <TouchableOpacity
              style={[s.dialCallBtn, !dialNumber && { opacity: 0.4 }]}
              disabled={!dialNumber}
              onPress={() => initiateCall(dialNumber)}
              activeOpacity={0.7}
            >
              <PhoneIcon size={28} />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 56, alignItems: 'center', justifyContent: 'center' }} onPress={() => setDialNumber(p => p.slice(0, -1))}>
              <Text style={{ color: C.textSec, fontSize: 22 }}>⌫</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          FULL SCREEN IN-CALL MODAL
         ══════════════════════════════════════════════════════════════ */}
      <Modal visible={callStatus !== 'idle'} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={handleHangup}>
        <View style={s.callScreen}>
          <StatusBar barStyle="light-content" backgroundColor={C.bg} />

          {/* ── INCOMING CALL ─────────────────────────────────────── */}
          {callStatus === 'ringing' && (
            <View style={s.incomingScreen}>
              <Text style={s.incomingLabel}>Incoming call</Text>
              <Animated.View style={[s.incomingAvatarWrap, { transform: [{ scale: pulseAnim }] }]}>
                <View style={s.incomingAvatarRing} />
                <View style={s.incomingAvatar}>
                  <Text style={s.incomingAvatarText}>{getInitial(callerName)}</Text>
                </View>
              </Animated.View>
              <Text style={s.incomingName}>{callerName || 'Unknown'}</Text>
              <Text style={s.incomingNumber}>{callerNumber}</Text>
              {jarvisEnabled && (
                <View style={s.jarvisCountdownBadge}>
                  <Text style={s.jarvisCountdownText}>🤖 Jarvis answering in {aiCountdown}s</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <View style={s.incomingActions}>
                <TouchableOpacity style={s.declineBtn} onPress={handleHangup} activeOpacity={0.7}>
                  <PhoneEndIcon size={28} />
                </TouchableOpacity>
                <TouchableOpacity style={s.answerBtn} onPress={handleAnswer} activeOpacity={0.7}>
                  <PhoneIcon size={28} />
                </TouchableOpacity>
              </View>
              <View style={s.incomingLabelsRow}>
                <Text style={s.incomingActionLabel}>Decline</Text>
                <Text style={s.incomingActionLabel}>Answer</Text>
              </View>
            </View>
          )}

          {/* ── OUTGOING CALL ─────────────────────────────────────── */}
          {callStatus === 'outgoing' && (
            <View style={s.outgoingScreen}>
              <Text style={s.outgoingLabel}>Calling...</Text>
              <View style={s.outgoingAvatar}>
                <Text style={s.outgoingAvatarText}>{getInitial(callerName)}</Text>
              </View>
              <Text style={s.outgoingName}>{callerName || 'Unknown'}</Text>
              <Text style={s.outgoingNumber}>{callerNumber}</Text>
              <Text style={s.outgoingStatus}>Dialing...</Text>
              <View style={{ flex: 1 }} />
              <View style={s.outgoingControls}>
                <TouchableOpacity style={s.ctrlCircle} onPress={async () => { await muteMicrophone(!isMuted); setIsMuted(!isMuted); }}>
                  <Text style={s.ctrlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
                  <Text style={s.ctrlLabel}>Mute</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ctrlCircle} onPress={async () => { await enableSpeakerphone(!isSpeaker); setIsSpeaker(!isSpeaker); }}>
                  <Text style={s.ctrlIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
                  <Text style={s.ctrlLabel}>Speaker</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.endCallBtn} onPress={handleHangup} activeOpacity={0.7}>
                <PhoneEndIcon size={30} />
              </TouchableOpacity>
              <Text style={s.endCallLabel}>End Call</Text>
            </View>
          )}

          {/* ── ACTIVE CONNECTED CALL ─────────────────────────────── */}
          {callStatus === 'active' && (
            <View style={s.activeScreen}>
              <View style={s.activeHeader}>
                <Text style={s.activeName}>{callerName || 'Unknown'}</Text>
                <Text style={s.activeTimer}>{formatTime(callDuration)}</Text>
              </View>

              {/* Jarvis Chat Area (only for incoming AI calls) */}
              {chatMessages.length > 0 && (
                <View style={s.chatArea}>
                  <View style={s.chatHeader}>
                    <Text style={s.chatTitle}>🤖 Jarvis</Text>
                    {isAiTalking && <Text style={s.chatSpeaking}>Speaking...</Text>}
                  </View>
                  <ScrollView style={s.chatScroll} showsVerticalScrollIndicator={false}>
                    {chatMessages.map(msg => (
                      <View key={msg.id} style={[s.chatBubble, msg.sender === 'jarvis' ? s.chatBubbleAi : s.chatBubbleUser]}>
                        <Text style={s.chatSender}>{msg.sender === 'jarvis' ? '🤖 Jarvis' : '👤 Caller'}</Text>
                        <Text style={s.chatText}>{msg.text}</Text>
                        <Text style={s.chatTime}>{msg.time}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  {/* Speech simulation input */}
                  <View style={s.chatInputRow}>
                    <TextInput
                      style={s.chatInput}
                      placeholder="Simulate caller speech..."
                      placeholderTextColor={C.textDim}
                      value={speechInput}
                      onChangeText={setSpeechInput}
                      onSubmitEditing={() => handleSendSpeech()}
                    />
                    <TouchableOpacity style={s.chatSendBtn} onPress={() => handleSendSpeech()}>
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>SEND</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={{ flex: chatMessages.length > 0 ? 0 : 1 }} />

              {/* Control Buttons Grid (2 rows of 3) */}
              <View style={s.controlGrid}>
                <TouchableOpacity style={[s.ctrlCircle, isMuted && s.ctrlCircleActive]} onPress={async () => { await muteMicrophone(!isMuted); setIsMuted(!isMuted); }}>
                  <Text style={s.ctrlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
                  <Text style={s.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ctrlCircle} onPress={() => {}}>
                  <Text style={s.ctrlIcon}>⌨️</Text>
                  <Text style={s.ctrlLabel}>Keypad</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ctrlCircle, isSpeaker && s.ctrlCircleActive]} onPress={async () => { await enableSpeakerphone(!isSpeaker); setIsSpeaker(!isSpeaker); }}>
                  <Text style={s.ctrlIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
                  <Text style={s.ctrlLabel}>Speaker</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ctrlCircle, jarvisEnabled && s.ctrlCircleActive]} onPress={toggleJarvis}>
                  <Text style={s.ctrlIcon}>🤖</Text>
                  <Text style={s.ctrlLabel}>Jarvis</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ctrlCircle} onPress={() => {}}>
                  <Text style={s.ctrlIcon}>⏸️</Text>
                  <Text style={s.ctrlLabel}>Hold</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ctrlCircle} onPress={() => {}}>
                  <Text style={s.ctrlIcon}>➕</Text>
                  <Text style={s.ctrlLabel}>Add call</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.endCallBtn} onPress={handleHangup} activeOpacity={0.7}>
                <PhoneEndIcon size={30} />
              </TouchableOpacity>
              <Text style={s.endCallLabel}>End Call</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          DUAL SIM MODAL
         ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showSimModal} transparent animationType="fade">
        <View style={s.simOverlay}>
          <View style={s.simBox}>
            <Text style={s.simTitle}>Select SIM</Text>
            <Text style={s.simSubtitle}>Calling: {pendingCallTarget}</Text>
            {simCards.map((sim, i) => (
              <TouchableOpacity key={i} style={s.simOption} onPress={() => initiateCall(pendingCallTarget, sim.slot)}>
                <View style={[s.simBadge, i === 1 && { backgroundColor: C.accent }]}>
                  <Text style={s.simBadgeText}>{(sim.slot || 0) + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.simName}>{sim.name || `SIM ${(sim.slot || 0) + 1}`}</Text>
                  <Text style={s.simCarrier}>{sim.carrier || ''}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.simCancel} onPress={() => setShowSimModal(false)}>
              <Text style={{ color: C.red, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: (StatusBar.currentHeight || 0) + 12, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.textPri },
  jarvisChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  jarvisChipActive: { backgroundColor: 'rgba(0,200,83,0.12)', borderColor: C.green },
  jarvisDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textDim, marginRight: 6 },
  jarvisDotActive: { backgroundColor: C.green },
  jarvisChipText: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 0.5 },
  jarvisChipTextActive: { color: C.green },

  // ── Bottom Tab Bar ──
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 8, paddingTop: 8 },
  bottomTab: { flex: 1, alignItems: 'center' },
  bottomTabText: { fontSize: 10, color: C.textDim, marginTop: 2, fontWeight: '600' },
  bottomTabTextActive: { color: C.accent },

  // ── FAB ──
  fab: { position: 'absolute', right: 20, bottom: 74, width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },

  // ── Lists ──
  listContainer: { flex: 1, paddingHorizontal: 16 },
  emptyText: { color: C.textDim, textAlign: 'center', marginTop: 60, fontSize: 14 },

  // ── Call Log Item ──
  callLogItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  callLogAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  callLogAvatarText: { color: C.textPri, fontSize: 17, fontWeight: '700' },
  callLogInfo: { flex: 1, marginLeft: 14 },
  callLogName: { color: C.textPri, fontSize: 15, fontWeight: '500' },
  callLogIcon: { fontSize: 13, fontWeight: '900', marginRight: 4 },
  callLogMeta: { color: C.textSec, fontSize: 12 },
  callLogCallBtn: { padding: 10 },

  // ── Contact Item ──
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: C.textPri, fontSize: 17, fontWeight: '700' },
  contactInfo: { flex: 1, marginLeft: 14 },
  contactName: { color: C.textPri, fontSize: 15, fontWeight: '500' },
  contactNumber: { color: C.textSec, fontSize: 12, marginTop: 2 },
  contactCallBtn: { padding: 10 },

  // ── Search ──
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, marginBottom: 8 },
  searchInput: { flex: 1, height: 44, color: C.textPri, fontSize: 14 },

  // ── Settings ──
  settingsSection: { marginBottom: 24 },
  settingsSectionTitle: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 1.5, marginBottom: 10, marginTop: 16 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
  settingsLabel: { color: C.textPri, fontSize: 15 },
  settingsBadge: { color: C.accent, fontSize: 13, fontWeight: '600' },
  settingsBadgeActive: { color: C.green },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackActive: { backgroundColor: C.green },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.textDim },
  toggleThumbActive: { backgroundColor: C.white, alignSelf: 'flex-end' },
  debugBox: { backgroundColor: '#05070d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  debugText: { color: C.green, fontSize: 10, fontFamily: 'monospace', lineHeight: 15 },

  // ── Dialpad ──
  dialpadScreen: { flex: 1, backgroundColor: C.bg },
  dialpadHeader: { paddingHorizontal: 20, paddingTop: (StatusBar.currentHeight || 0) + 10, paddingBottom: 10 },
  dialpadDisplay: { height: 80, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  dialpadNumber: { color: C.textPri, fontSize: 34, fontWeight: '300', letterSpacing: 2 },
  keypadGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 30 },
  keyBtn: { width: (width - 90) / 3, height: 70, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  keyNum: { color: C.textPri, fontSize: 28, fontWeight: '400' },
  keySub: { color: C.textDim, fontSize: 9, letterSpacing: 2, marginTop: 1 },
  dialpadActions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  dialCallBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginHorizontal: 24 },

  // ── Call Screens (shared) ──
  callScreen: { flex: 1, backgroundColor: C.bg },
  endCallBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 20 },
  endCallLabel: { color: C.textSec, fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 30 },

  // ── Incoming ──
  incomingScreen: { flex: 1, alignItems: 'center', paddingTop: 60 },
  incomingLabel: { color: C.textSec, fontSize: 16, letterSpacing: 0.5 },
  incomingAvatarWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 20 },
  incomingAvatarRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: C.green, opacity: 0.4 },
  incomingAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.border },
  incomingAvatarText: { color: C.textPri, fontSize: 38, fontWeight: '300' },
  incomingName: { color: C.textPri, fontSize: 28, fontWeight: '400' },
  incomingNumber: { color: C.textSec, fontSize: 16, marginTop: 6 },
  jarvisCountdownBadge: { backgroundColor: 'rgba(0,200,83,0.12)', borderWidth: 1, borderColor: C.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 20 },
  jarvisCountdownText: { color: C.green, fontSize: 13, fontWeight: '600' },
  incomingActions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 60 },
  declineBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  answerBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  incomingLabelsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 60, marginTop: 8, marginBottom: 40 },
  incomingActionLabel: { color: C.textSec, fontSize: 13 },

  // ── Outgoing ──
  outgoingScreen: { flex: 1, alignItems: 'center', paddingTop: 60 },
  outgoingLabel: { color: C.textSec, fontSize: 16, letterSpacing: 0.5 },
  outgoingAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 20, borderWidth: 2, borderColor: C.border },
  outgoingAvatarText: { color: C.textPri, fontSize: 38, fontWeight: '300' },
  outgoingName: { color: C.textPri, fontSize: 28, fontWeight: '400' },
  outgoingNumber: { color: C.textSec, fontSize: 16, marginTop: 6 },
  outgoingStatus: { color: C.accent, fontSize: 14, marginTop: 14, letterSpacing: 1 },
  outgoingControls: { flexDirection: 'row', justifyContent: 'space-around', width: '60%', marginBottom: 20 },

  // ── Active Call ──
  activeScreen: { flex: 1, paddingTop: 50 },
  activeHeader: { alignItems: 'center', marginBottom: 10 },
  activeName: { color: C.textPri, fontSize: 24, fontWeight: '400' },
  activeTimer: { color: C.green, fontSize: 18, marginTop: 6, fontFamily: 'monospace', letterSpacing: 2 },

  // ── Control Grid ──
  controlGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 10 },
  ctrlCircle: { width: (width - 80) / 3, alignItems: 'center', paddingVertical: 14 },
  ctrlCircleActive: {},
  ctrlIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.surfaceAlt, textAlign: 'center', textAlignVertical: 'center', fontSize: 22, lineHeight: 56, overflow: 'hidden' },
  ctrlLabel: { color: C.textSec, fontSize: 11, marginTop: 6 },

  // ── Chat Area ──
  chatArea: { flex: 1, marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chatTitle: { color: C.accent, fontSize: 12, fontWeight: '800' },
  chatSpeaking: { color: C.green, fontSize: 10, fontWeight: '700' },
  chatScroll: { flex: 1 },
  chatBubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  chatBubbleAi: { alignSelf: 'flex-start', backgroundColor: 'rgba(41,121,255,0.12)', borderWidth: 1, borderColor: 'rgba(41,121,255,0.25)' },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: C.surfaceAlt },
  chatSender: { color: C.accent, fontSize: 10, fontWeight: '800', marginBottom: 3 },
  chatText: { color: C.textPri, fontSize: 13, lineHeight: 18 },
  chatTime: { color: C.textDim, fontSize: 9, alignSelf: 'flex-end', marginTop: 3 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  chatInput: { flex: 1, height: 40, backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, color: C.textPri, fontSize: 13, borderWidth: 1, borderColor: C.border },
  chatSendBtn: { marginLeft: 8, backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },

  // ── SIM Modal ──
  simOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  simBox: { width: '85%', backgroundColor: C.surface, borderRadius: 20, padding: 24 },
  simTitle: { color: C.textPri, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  simSubtitle: { color: C.textSec, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  simOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 16, marginBottom: 10 },
  simBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  simBadgeText: { color: '#000', fontSize: 16, fontWeight: '900' },
  simName: { color: C.textPri, fontSize: 15, fontWeight: '600' },
  simCarrier: { color: C.textSec, fontSize: 12 },
  simCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
});
