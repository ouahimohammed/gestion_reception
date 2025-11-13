import { createContext, useContext, useEffect, useState } from 'react';

const initialState = {
  theme: 'system',
  setTheme: () => null,
  language: 'fr',
  setLanguage: () => null,
  direction: 'ltr',
};

const ThemeProviderContext = createContext(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultLanguage = 'fr',
  storageKey = 'warehouse-ui-theme',
  languageKey = 'warehouse-language',
  ...props
}) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || defaultTheme;
    }
    return defaultTheme;
  });
  
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(languageKey) || defaultLanguage;
    }
    return defaultLanguage;
  });

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    
    // Supprimer les classes précédentes
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    let currentTheme = theme;
    
    if (theme === 'system') {
      currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
    }

    root.classList.add(currentTheme);
    body.classList.add(currentTheme);
    
    // Mettre à jour les attributs de couleur
    root.style.colorScheme = currentTheme;
    
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.dir = direction;
      document.documentElement.lang = language;
    }
  }, [language, direction]);

  const value = {
    theme,
    setTheme: (newTheme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newTheme);
      }
      setTheme(newTheme);
    },
    language,
    setLanguage: (newLanguage) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(languageKey, newLanguage);
      }
      setLanguage(newLanguage);
    },
    direction,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};