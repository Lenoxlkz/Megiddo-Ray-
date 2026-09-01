'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';

type Language = 'en' | 'es';

const translations = {
  en: {
    appTitle: 'Liquid Fast Download',
    tagline: 'Advanced search and data extraction engine.',
    enterUrl: 'Enter URL (Manga, Video, Image...)',
    addTracker: 'Add Tracker',
    modeSingle: 'Single',
    modeSequential: 'Sequential',
    modeContinuous: 'Continuous',
    categoryManga: 'Manga',
    categoryVideo: 'Video',
    categoryImage: 'Image',
    categoryNsfw: 'NSFW',
    statusIdle: 'Idle',
    statusRunning: 'Running',
    statusPaused: 'Paused',
    statusCompleted: 'Completed',
    statusError: 'Error',
    statusStopped: 'Stopped',
    download: 'Download',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    retry: 'Retry',
    delete: 'Delete',
    chapters: 'Chapters',
    images: 'Images',
    progress: 'Progress',
    speed: 'Speed',
    noTrackers: 'No active trackers. Add a URL to start.',
    slowServerMode: 'Slow Server Mode',
    exportPdf: 'Export PDF',
    exportZip: 'Export ZIP',
    exportCbz: 'Export CBZ',
    exportVideo: 'Export Video',
    exportAudio: 'Export Audio',
    settings: 'Settings',
    language: 'Language',
    clearAll: 'Clear All',
    confirmClear: 'Are you sure you want to clear all trackers?',
    yes: 'Yes',
    no: 'No',
    errorGeneric: 'An error occurred',
    loading: 'Loading...',
    searchPlaceholder: 'Search trackers...',
    totalChapters: 'Total Chapters',
    completedChapters: 'Completed',
    currentChapter: 'Current',
    author: 'Author',
    mediaType: 'Media Type',
    video: 'Video',
    image: 'Image',
  },
  es: {
    appTitle: 'Liquid Fast Download',
    tagline: 'Motor avanzado de búsqueda y extracción de datos.',
    enterUrl: 'Ingresa URL (Manga, Video, Imagen...)',
    addTracker: 'Agregar Rastreador',
    modeSingle: 'Único',
    modeSequential: 'Secuencial',
    modeContinuous: 'Continuo',
    categoryManga: 'Manga',
    categoryVideo: 'Video',
    categoryImage: 'Imagen',
    categoryNsfw: 'NSFW',
    statusIdle: 'Inactivo',
    statusRunning: 'Ejecutando',
    statusPaused: 'Pausado',
    statusCompleted: 'Completado',
    statusError: 'Error',
    statusStopped: 'Detenido',
    download: 'Descargar',
    pause: 'Pausar',
    resume: 'Reanudar',
    stop: 'Detener',
    retry: 'Reintentar',
    delete: 'Eliminar',
    chapters: 'Capítulos',
    images: 'Imágenes',
    progress: 'Progreso',
    speed: 'Velocidad',
    noTrackers: 'No hay rastreadores activos. Agrega una URL para comenzar.',
    slowServerMode: 'Modo Servidor Lento',
    exportPdf: 'Exportar PDF',
    exportZip: 'Exportar ZIP',
    exportCbz: 'Exportar CBZ',
    exportVideo: 'Exportar Video',
    exportAudio: 'Exportar Audio',
    settings: 'Configuración',
    language: 'Idioma',
    clearAll: 'Limpiar Todo',
    confirmClear: '¿Estás seguro de que quieres limpiar todos los rastreadores?',
    yes: 'Sí',
    no: 'No',
    errorGeneric: 'Ocurrió un error',
    loading: 'Cargando...',
    searchPlaceholder: 'Buscar rastreadores...',
    totalChapters: 'Total Capítulos',
    completedChapters: 'Completados',
    currentChapter: 'Actual',
    author: 'Autor',
    mediaType: 'Tipo de Medio',
    video: 'Video',
    image: 'Imagen',
  },
};

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('language');
  return (stored === 'es' || stored === 'en') ? stored : 'en';
}

function subscribeToLanguage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getLanguageSnapshot(): Language {
  return getStoredLanguage();
}

function getServerSnapshot(): Language {
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerSnapshot);
  const [lang, setLang] = useState<Language>(language);

  useEffect(() => {
    setLang(language);
  }, [language]);

  const setLanguage = useCallback((newLang: Language) => {
    localStorage.setItem('language', newLang);
    setLang(newLang);
    window.dispatchEvent(new Event('storage'));
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return translations[lang][key] || translations.en[key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ language: lang, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
