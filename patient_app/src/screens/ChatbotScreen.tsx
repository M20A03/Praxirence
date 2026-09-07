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
} from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { PatientUser, Visit, ChatMessage } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';

interface ChatbotScreenProps {
  user: PatientUser;
  onNavigateToDoctors?: () => void;
  onNavigateToVisits?: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'Bengali', label: 'বাংলা (Bengali)' },
  { code: 'Tamil', label: 'தமிழ் (Tamil)' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)' },
  { code: 'Marathi', label: 'मराठी (Marathi)' },
  { code: 'Gujarati', label: 'ગુજરાતી (Gujarati)' },
  { code: 'Hinglish', label: 'Hinglish' },
];

export const ChatbotScreen: React.FC<ChatbotScreenProps> = ({
  user,
  onNavigateToDoctors,
  onNavigateToVisits,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState<boolean>(false);
  const [visits, setVisits] = useState<Visit[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadPatientContext();
    initializeWelcomeMessage(selectedLanguage);
  }, [user.id]);

  const loadPatientContext = async () => {
    try {
      const data = await mobileApi.getVisits(user.id);
      setVisits(data);
    } catch (e) {
      console.log('Error loading visits for chatbot context:', e);
    }
  };

  const initializeWelcomeMessage = (lang: string) => {
    const isHindi = ['Hindi', 'हिन्दी', 'Hinglish'].includes(lang);
    const initialGreeting = isHindi
      ? `नमस्ते ${user.name}! मैं आपका प्रैक्सिरेंस एआई स्वास्थ्य सहायक हूँ। मैं आपकी दवाओं, खुराक और डॉक्टर परामर्श में मदद कर सकता हूँ।`
      : `Hello ${user.name}! I am your Praxirence AI Clinical Assistant. I can help explain your active prescription, medication schedule, and connect you with verified specialists.`;

    const welcomeMsg: ChatMessage = {
      id: 'welcome_1',
      sender: 'assistant',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: lang,
      quickSuggestions: isHindi
        ? ['मेरी दवाएं और खुराक समझाइए', 'दवा के दुष्प्रभाव क्या हैं?', 'सत्यापित डॉक्टर खोजें', 'प्रिस्क्रिप्शन डाउनलोड करें']
        : ['Explain my medication schedule', 'What are potential side effects?', 'Find a verified specialist', 'How to download prescription PDF?'],
    };
    setMessages([welcomeMsg]);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setShowLanguagePicker(false);
    initializeWelcomeMessage(lang);
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
      };

      setMessages((prev) => [...prev, assistantMsg]);
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
          <BrandLogoMobile variant="header" size="sm" subtitleText="AI Health Assistant" />
        </View>

        {/* Language Selection Pill */}
        <TouchableOpacity
          style={styles.languagePill}
          onPress={() => setShowLanguagePicker(!showLanguagePicker)}
        >
          <Ionicons name="globe-outline" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.languagePillText}>{selectedLanguage}</Text>
        </TouchableOpacity>
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
                >
                  {msg.text}
                </Text>

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
                          <Text style={styles.doctorCardName}>{doc.name}</Text>
                          <Text style={styles.doctorCardSpecialty}>{doc.specialty}</Text>
                          <Text style={styles.doctorCardClinic}>{doc.clinic_name}</Text>
                          <Text style={styles.doctorCardNmc}>NMC: {doc.reg_number}</Text>
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
      {messages.length > 0 && messages[messages.length - 1].quickSuggestions && (
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
          placeholder={`Ask about medicines, timings, doctors (${selectedLanguage})...`}
          placeholderTextColor={Colors.textSecondary}
          value={inputMessage}
          onChangeText={setInputMessage}
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
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  langOptionTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
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
    fontSize: 11,
    color: Colors.amber,
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
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
    paddingVertical: 10,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
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
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  messageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: Colors.text,
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
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  doctorCardSpecialty: {
    fontFamily: FontFamily.medium,
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
    paddingVertical: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    maxHeight: 90,
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
});
