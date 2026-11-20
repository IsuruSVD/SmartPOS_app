import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppLanguage, translations, TranslationKey, getProductName as getProductNameHelper } from './index';
import type { DatabaseService } from '../db/services/DatabaseService';

export interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
  getProductName: (product: { name: string; name_en?: string | null; name_si?: string | null }, lang?: AppLanguage) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: TranslationKey) => translations.en[key] ?? key,
  getProductName: (product, lang) => product.name,
});

export interface LanguageProviderProps {
  children: React.ReactNode;
  db?: DatabaseService | null;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children, db }) => {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  // Load persisted language from SQLite settings
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    db.settings.get('app_language').then((val) => {
      if (isMounted && val && (val === 'en' || val === 'si')) {
        setLanguageState(val as AppLanguage);
      }
    }).catch(() => {
      // Default to English if unset
    });
    return () => { isMounted = false; };
  }, [db]);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    if (db) {
      try {
        await db.settings.set('app_language', lang);
      } catch {
        // Safe fallback
      }
    }
  }, [db]);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[language] || translations.en;
      return dict[key] ?? translations.en[key] ?? key;
    },
    [language]
  );

  const getProductName = useCallback(
    (product: { name: string; name_en?: string | null; name_si?: string | null }, lang?: AppLanguage): string => {
      return getProductNameHelper(product, lang || language);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      getProductName,
    }),
    [language, setLanguage, t, getProductName]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
