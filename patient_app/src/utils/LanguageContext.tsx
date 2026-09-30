import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, translateText } from './languageTranslations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = 'praxirence_selected_lang';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLangState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'hi' || saved === 'en' || saved === 'kn' || saved === 'bho' || saved === 'ur' || saved === 'te' || saved === 'ta' || saved === 'mr' || saved === 'ml' || saved === 'pa')) {
          setLangState(saved as SupportedLanguage);
        }
      } catch (err) {
        console.warn('Failed to load saved language:', err);
      }
    };
    loadSavedLanguage();
  }, []);

  const setLanguage = async (newLang: SupportedLanguage) => {
    try {
      setLangState(newLang);
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (err) {
      console.warn('Failed to persist language choice:', err);
    }
  };

  const t = (key: string): string => {
    return translateText(key, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  return useContext(LanguageContext);
};
