import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Keyboard,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { PatientUser, Visit, ChatMessage } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';

import { useLanguage } from '../utils/LanguageContext';
import { SupportedLanguage } from '../utils/languageTranslations';

interface ChatbotScreenProps {
  user: PatientUser;
  onNavigateToDoctors?: () => void;
  onNavigateToVisits?: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Kannada', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'Bhojpuri', label: 'भोजपुरी (Bhojpuri)' },
  { code: 'Urdu', label: 'اردو (Urdu)' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)' },
  { code: 'Tamil', label: 'தமிழ் (Tamil)' },
  { code: 'Marathi', label: 'मराठी (Marathi)' },
  { code: 'Malayalam', label: 'മലയാളം (Malayalam)' },
  { code: 'Punjabi', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'Bengali', label: 'বাংলা (Bengali)' },
  { code: 'Gujarati', label: 'ગુજરાતી (Gujarati)' },
  { code: 'Hinglish', label: 'Hinglish' },
];

const CODE_TO_CHAT_LANG: Record<string, string> = {
  hi: 'Hindi',
  kn: 'Kannada',
  en: 'English',
  bho: 'Bhojpuri',
  ur: 'Urdu',
  te: 'Telugu',
  ta: 'Tamil',
  mr: 'Marathi',
  ml: 'Malayalam',
  pa: 'Punjabi',
};

const CHAT_LANG_TO_CODE: Record<string, SupportedLanguage> = {
  Hindi: 'hi',
  Kannada: 'kn',
  English: 'en',
  Bhojpuri: 'bho',
  Urdu: 'ur',
  Telugu: 'te',
  Tamil: 'ta',
  Marathi: 'mr',
  Malayalam: 'ml',
  Punjabi: 'pa',
};

const cleanDoctorName = (name?: string): string => {
  if (!name) return 'Physician';
  const clean = name.replace(/^(Dr\.?\s*)+/i, '').trim();
  return `Dr. ${clean || 'Physician'}`;
};

export const ChatbotScreen: React.FC<ChatbotScreenProps> = ({
  user,
  onNavigateToDoctors,
  onNavigateToVisits,
}) => {
  const { language, setLanguage: setGlobalLanguage, t } = useLanguage();
  const initialChatLang = CODE_TO_CHAT_LANG[language] || 'English';
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialChatLang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState<boolean>(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{ id: string; query: string; reply: string; timestamp: string }>>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadPatientContext();
    loadChatHistory();

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [user.id]);

  const loadChatHistory = async () => {
    try {
      const data = await AsyncStorage.getItem('@praxirence_patient_chat_history');
      if (data) setChatHistory(JSON.parse(data));
    } catch (_) {}
  };

  const saveToHistory = async (query: string, reply: string) => {
    try {
      const dateStr = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const newItem = {
        id: `hist_${Date.now()}`,
        query,
        reply,
        timestamp: dateStr,
      };
      setChatHistory((prev) => {
        const updated = [newItem, ...prev.slice(0, 49)];
        AsyncStorage.setItem('@praxirence_patient_chat_history', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch (_) {}
  };

  const handleClearHistory = async () => {
    try {
      await AsyncStorage.removeItem('@praxirence_patient_chat_history');
      setChatHistory([]);
    } catch (_) {}
  };

  const handlePromptClearChat = () => {
    Alert.alert(
      'Clear Conversation?',
      'Are you sure you want to clear your AI chat history? All current messages and saved queries will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@praxirence_patient_chat_history');
              await AsyncStorage.removeItem('@praxirence_patient_chat_messages');
              setChatHistory([]);
              initializeWelcomeMessage(selectedLanguage);
              Alert.alert('Chat Cleared', 'Your AI chat conversation has been reset.');
            } catch (err) {
              console.warn('Clear chat notice:', err);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const targetChatLang = CODE_TO_CHAT_LANG[language] || 'English';
    setSelectedLanguage(targetChatLang);
    initializeWelcomeMessage(targetChatLang);
  }, [language, user.name]);

  const loadPatientContext = async () => {
    try {
      const data = await mobileApi.getVisits(user.id);
      setVisits(data);
    } catch (e) {
      console.log('Error loading visits for chatbot context:', e);
    }
  };

  const initializeWelcomeMessage = (lang: string) => {
    let initialGreeting = `Hello ${user.name}! I am your Praxirence AI Clinical Assistant. I can help explain your doctor's consultation notes, doctor's advice, medication schedule, and connect you with verified specialists.`;
    let quickSuggestions = ['What did the doctor advise me?', 'Explain my medication schedule', 'What warning signs to watch for?', 'Find a verified specialist'];

    if (lang === 'Kannada' || lang === 'ಕನ್ನಡ') {
      initialGreeting = `ನಮಸ್ಕಾರ ${user.name}! ನಾನು ನಿಮ್ಮ ಪ್ರ್ಯಾಕ್ಸಿರೆನ್ಸ್ AI ಆರೋಗ್ಯ ಸಹಾಯಕ. ವೈದ್ಯರ ಸಲಹೆಗಳು, ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ ಮತ್ತು ಮಾತ್ರೆಗಳ ವಿವರವನ್ನು ಸುಲಭವಾಗಿ ವಿವರಿಸಬಲ್ಲೆ.`;
      quickSuggestions = ['ವೈದ್ಯರು ನನಗೆ ಏನು ಸಲಹೆ ನೀಡಿದ್ದಾರೆ?', 'ನನ್ನ ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ ವಿವರಿಸಿ', 'ಎಚ್ಚರಿಕೆ ಚಿಹ್ನೆಗಳೇನು?', 'ತಜ್ಞ ವೈದ್ಯರನ್ನು ಹುಡುಕಿ'];
    } else if (lang === 'Bhojpuri' || lang === 'भोजपुरी') {
      initialGreeting = `प्रणाम ${user.name}! हम रउआ के प्रैक्सिरेंस एआई स्वास्थ्य सहायक हईं। डॉक्टर साहेब का सलाह दिहलें, दवाई के खुराक आ जांच में हम रउआ के पूरा मदद करब।`;
      quickSuggestions = ['डॉक्टर साहेब का सलाह दिहलें?', 'हमार दवाई आ खुराक समझाईं', 'कवन लक्षण पर धियान दीं?', 'सत्यापित डॉक्टर खोजीं'];
    } else if (lang === 'Urdu' || lang === 'اردو') {
      initialGreeting = `السلام علیکم ${user.name}! میں آپ کا پریکسیرینس AI طبی معاون ہوں۔ میں آپ کو ڈاکٹر کے مشورے، ادویات کا شیڈول اور اہم ہدایات سمجھا سکتا ہوں۔`;
      quickSuggestions = ['ڈاکٹر نے مجھے کیا مشورہ دیا؟', 'میری ادویات کا شیڈول سمجھائیں', 'خطرے کی علامات کیا ہیں؟', 'ماہر ڈاکٹر تلاش کریں'];
    } else if (['Hindi', 'हिन्दी', 'Hinglish'].includes(lang)) {
      initialGreeting = `नमस्ते ${user.name}! मैं आपका प्रैक्सिरेंस एआई स्वास्थ्य सहायक हूँ। मैं आपके डॉक्टर के परामर्श, डॉक्टर की सलाह, दवाओं की खुराक और रिपोर्ट को सरल भाषा में समझाने में मदद कर सकता हूँ।`;
      quickSuggestions = ['डॉक्टर ने मुझे क्या सलाह दी?', 'मेरी दवाएं और खुराक समझाइए', 'खतरे के लक्षण क्या हैं?', 'सत्यापित डॉक्टर खोजें'];
    } else if (lang === 'Telugu' || lang === 'తెలుగు') {
      initialGreeting = `నమస్కారం ${user.name}! నేను మీ ప్రాక్సిరెన్స్ AI క్లినికల్ అసిస్టెంట్‌ని. డాక్టర్ ఇచ్చిన సలహాలు, ప్రిస్క్రిప్షన్ మరియు మందుల షెడ్యూల్ వివరాలలో నేను మీకు సహాయం చేయగలను.`;
      quickSuggestions = ['డాక్టర్ నాకు ఏమి సలహా ఇచ్చారు?', 'నా మందుల షెడ్యూల్ వివరించండి', 'హెచ్చరిక సంకేతాలు ఏమిటి?', 'డాక్టర్లను కనుగొనండి'];
    } else if (lang === 'Tamil' || lang === 'தமிழ்') {
      initialGreeting = `வணக்கம் ${user.name}! நான் உங்கள் பிராக்சிரென்ஸ் AI மருத்துவ உதவியாளர். மருத்துவர் கூறிய ஆலோசனைகள் மற்றும் மருந்து அட்டவணையை நான் தெளிவாக விளக்க முடியும்.`;
      quickSuggestions = ['மருத்துவர் எனக்கு என்ன ஆலோசனை கூறினார்?', 'மருந்து அட்டவணையை விளக்குங்கள்', 'எச்சரிக்கை அறிகுறிகள் என்ன?', 'மருத்துவரைத் தேடுங்கள்'];
    }

    const welcomeMsg: ChatMessage = {
      id: 'welcome_1',
      sender: 'assistant',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: lang,
      quickSuggestions,
    };
    setMessages([welcomeMsg]);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setShowLanguagePicker(false);
    initializeWelcomeMessage(lang);
    const mapped = CHAT_LANG_TO_CODE[lang];
    if (mapped) {
      setGlobalLanguage(mapped);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const latestVisitId = visits.length > 0 ? visits[0].id : undefined;
      const res = await mobileApi.chatWithAssistant({
        message: query,
        language: selectedLanguage,
        patient_id: user.id,
        visit_id: latestVisitId,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: res.language,
        medicinesReferenced: res.medicines_referenced,
        recommendedDoctors: res.recommended_doctors,
        quickSuggestions: res.quick_suggestions,
        citations: res.citations,
        emergencyAlert: res.emergency_alert,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      saveToHistory(query, res.reply);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered a network glitch reaching the clinical engine. Please ensure you are connected to the internet.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Top Clinical Header with Brand Logo and Chatbot Emblem */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../../assets/features/chatbot.png')} style={{ width: 34, height: 34 }} resizeMode="contain" />
          <BrandLogoMobile variant="header" size="sm" subtitleText={t('aiAssistantTitle')} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Query History Pill */}
          <TouchableOpacity
            style={styles.historyPill}
            onPress={() => setShowHistoryModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="reader-outline" size={13} color="#0D9488" style={{ marginRight: 4 }} />
            <Text style={styles.historyPillText}>History</Text>
          </TouchableOpacity>

          {/* Clear / Reset Chat Pill */}
          <TouchableOpacity
            style={styles.clearPill}
            onPress={handlePromptClearChat}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.clearPillText}>Clear</Text>
          </TouchableOpacity>

          {/* Language Selection Pill */}
          <TouchableOpacity
            style={styles.languagePill}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          >
            <Ionicons name="globe-outline" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.languagePillText}>{selectedLanguage}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Language Selector Dropdown Modal / Bar */}
      {showLanguagePicker && (
        <View style={styles.languageDropdown}>
          <Text style={styles.languageDropdownTitle}>Select Preferred Language:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langScroll}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOptionButton,
                  selectedLanguage === lang.code && styles.langOptionButtonActive,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text
                  style={[
                    styles.langOptionText,
                    selectedLanguage === lang.code && styles.langOptionTextActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Clinical Disclaimer Banner */}
      <View style={styles.safetyBanner}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.safetyText}>
          Trained Clinical Assistant • For emergency care, call 108 / 112 immediately.
        </Text>
      </View>

      {/* Chat Messages List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageWrapper,
                isUser ? styles.userMessageWrapper : styles.assistantMessageWrapper,
              ]}
            >
              {!isUser && (
                <View style={styles.botAvatarBadge}>
                  <BrandLogoMobile variant="widget" size="sm" />
                </View>
              )}

              <View
                style={[
                  styles.messageBubble,
                  isUser ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isUser ? styles.userMessageText : styles.assistantMessageText,
                  ]}
                  selectable={!isUser}
                >
                  {msg.text}
                </Text>

                {/* ESI Tier-1 Hospital-Grade Emergency Alert Card */}
                {msg.emergencyAlert && (
                  <View style={styles.emergencyCard}>
                    <View style={styles.emergencyHeaderRow}>
                      <Ionicons name="warning" size={22} color="#DC2626" />
                      <Text style={styles.emergencyTitleText}>
                        {msg.emergencyAlert.title || 'CLINICAL EMERGENCY RED-FLAG'}
                      </Text>
                    </View>
                    <Text style={styles.emergencyReasonBadge}>
                      {msg.emergencyAlert.reason}
                    </Text>

                    {/* Direct Quick-Dial Calling Actions */}
                    <View style={styles.emergencyActionsRow}>
                      <TouchableOpacity
                        style={styles.emergencyDialPrimary}
                        onPress={() => Linking.openURL('tel:108')}
                      >
                        <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.emergencyDialPrimaryText}>Call 108 Ambulance</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.emergencyDialSecondary}
                        onPress={() => Linking.openURL('tel:112')}
                      >
                        <Ionicons name="call" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={styles.emergencyDialSecondaryText}>Call 112</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Emergency Protocol Guidance */}
                    {msg.emergencyAlert.guidance && msg.emergencyAlert.guidance.length > 0 && (
                      <View style={styles.emergencyGuidanceList}>
                        {msg.emergencyAlert.guidance.map((item, gIdx) => (
                          <View key={gIdx} style={styles.emergencyGuidanceRow}>
                            <Ionicons name="alert-circle" size={13} color="#DC2626" style={{ marginRight: 6, marginTop: 2 }} />
                            <Text style={styles.emergencyGuidanceText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Verified Grounded Clinical Citations (Deduplicated) */}
                {msg.citations && msg.citations.length > 0 && (() => {
                  const uniqueCitations = Array.from(
                    new Map(msg.citations.map((c) => [`${cleanDoctorName(c.doctor_name)}_${c.visit_date}`, c])).values()
                  );
                  return (
                    <View style={styles.citationsContainer}>
                      {uniqueCitations.map((c, cIdx) => (
                        <View key={cIdx} style={styles.citationBadge}>
                          <Ionicons name="shield-checkmark" size={12} color={Colors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.citationText}>
                            Grounded in {cleanDoctorName(c.doctor_name)}'s Consultation ({c.visit_date})
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Render Doctor Recommendation Cards */}
                {msg.recommendedDoctors && msg.recommendedDoctors.length > 0 && (
                  <View style={styles.doctorCardsContainer}>
                    <Text style={styles.doctorCardsHeader}>Verified Specialists:</Text>
                    {msg.recommendedDoctors.map((doc) => (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.doctorCard}
                        onPress={onNavigateToDoctors}
                      >
                        <View style={styles.doctorCardAvatar}>
                          <Ionicons name="medkit" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.doctorCardName}>{cleanDoctorName(doc.name)}</Text>
                          <Text style={styles.doctorCardSpecialty}>{doc.specialty}</Text>
                          <Text style={styles.doctorCardClinic}>{doc.clinic_name}</Text>
                          <Text style={styles.doctorCardNmc}>Reg: {doc.reg_number}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text
                  style={[
                    styles.timestampText,
                    isUser ? styles.userTimestamp : styles.assistantTimestamp,
                  ]}
                >
                  {msg.timestamp}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Typing Indicator */}
        {loading && (
          <View style={[styles.messageWrapper, styles.assistantMessageWrapper]}>
            <View style={styles.botAvatarBadge}>
              <BrandLogoMobile variant="widget" size="sm" />
            </View>
            <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Analyzing clinical records...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Dynamic Quick Suggestion Chips */}
      {!isKeyboardVisible && messages.length > 0 && messages[messages.length - 1].quickSuggestions && (
        <View style={styles.quickChipsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {messages[messages.length - 1].quickSuggestions?.map((suggestion, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chipButton}
                onPress={() => handleSendMessage(suggestion)}
              >
                <Text style={styles.chipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Message Input Box */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={t('typeHealthQuery')}
          placeholderTextColor={Colors.textSecondary}
          value={inputMessage}
          onChangeText={setInputMessage}
          onFocus={() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          multiline={false}
          onSubmitEditing={() => handleSendMessage()}
          returnKeyType="send"
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputMessage.trim() || loading) && styles.sendButtonDisabled,
          ]}
          onPress={() => handleSendMessage()}
          disabled={!inputMessage.trim() || loading}
        >
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {/* Chat & Query History Modal with Date and Time */}
      <Modal
        visible={showHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalCard}>
            <View style={styles.historyModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.historyModalIconWrap}>
                  <Ionicons name="reader-outline" size={18} color="#0D9488" />
                </View>
                <View>
                  <Text style={styles.historyModalTitle}>Consultation Records</Text>
                  <Text style={styles.historyModalSubtitle}>Logged health queries & explanations</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={true}>
              {chatHistory.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={38} color="#CBD5E1" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyHistoryText}>No past health queries searched yet.</Text>
                  <Text style={styles.emptyHistorySub}>Your questions and clinical explanations will appear here with date and time.</Text>
                </View>
              ) : (
                chatHistory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyItemCard}
                    onPress={() => {
                      setShowHistoryModal(false);
                      handleSendMessage(item.query);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.historyItemTimeRow}>
                      <Ionicons name="calendar-outline" size={12} color="#0D9488" style={{ marginRight: 4 }} />
                      <Text style={styles.historyItemTimestamp}>{item.timestamp}</Text>
                      <View style={styles.reAskPill}>
                        <Text style={styles.reAskPillText}>Review</Text>
                      </View>
                    </View>
                    <Text style={styles.historyItemQuery}>{item.query}</Text>
                    {item.reply ? (
                      <Text style={styles.historyItemReply} numberOfLines={2}>
                        {item.reply}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {chatHistory.length > 0 && (
              <View style={styles.historyModalFooter}>
                <TouchableOpacity style={styles.clearHistoryBtn} onPress={handleClearHistory}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.clearHistoryBtnText}>Clear History</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearPillText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: '#EF4444',
  },
  languagePill: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  languagePillText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
  },
  languageDropdown: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  languageDropdownTitle: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  langScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  langOptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langOptionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langOptionText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  langOptionTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.2)',
  },
  safetyIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  safetyText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: Colors.amber,
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  assistantMessageWrapper: {
    justifyContent: 'flex-start',
  },
  botAvatarBadge: {
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  messageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: 24,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: Colors.text,
    letterSpacing: 0.15,
  },
  timestampText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  assistantTimestamp: {
    color: Colors.textSecondary,
  },
  doctorCardsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  doctorCardsHeader: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
  },
  doctorCardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  doctorCardName: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  doctorCardSpecialty: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: Colors.primary,
  },
  doctorCardClinic: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  doctorCardNmc: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 9,
    color: Colors.textSecondary,
  },
  doctorCardArrow: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  quickChipsWrapper: {
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chipsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chipButton: {
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 12.5,
    color: Colors.primaryDark,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    minHeight: 64,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    minHeight: 46,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Emergency Triage Card Styles
  emergencyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  emergencyTitleText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  emergencyReasonBadge: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: '#991B1B',
    marginBottom: 10,
  },
  emergencyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  emergencyDialPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  emergencyDialPrimaryText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    color: '#FFFFFF',
  },
  emergencyDialSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emergencyDialSecondaryText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    color: '#DC2626',
  },
  emergencyGuidanceList: {
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingTop: 8,
    gap: 4,
  },
  emergencyGuidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emergencyGuidanceText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  // Grounded Citations Styles
  citationsContainer: {
    marginTop: 8,
    gap: 4,
  },
  citationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  citationText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: Colors.primaryDark,
  },

  historyPill: {
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyPillText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.caption,
    color: '#0D9488',
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  historyModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  historyModalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyModalTitle: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 16,
    color: Colors.text,
  },
  historyModalSubtitle: {
    fontFamily: FontFamily.regular,
    fontWeight: '400',
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  historyItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyItemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyItemTimestamp: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: '#0D9488',
    flex: 1,
  },
  reAskPill: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  reAskPillText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 10,
    color: '#0D9488',
  },
  historyItemQuery: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
  },
  historyItemReply: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  emptyHistoryBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyHistoryText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  emptyHistorySub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyModalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'flex-end',
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearHistoryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: '#DC2626',
  },
});
