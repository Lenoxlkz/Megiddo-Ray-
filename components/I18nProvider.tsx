'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';

export type Language = 'en' | 'es';

export const translations = {
  en: {
    appTitle: 'Liquid Fast Download',
    tagline: 'Advanced search, streaming media and sequential data extraction engine.',
    enterUrl: 'Enter URL to track...',
    modeSingle: 'Single Chapter',
    modeSequential: 'Sequential Chapters',
    modeContinuous: 'Continuous Tracking',
    startTracking: 'Start Tracking',
    trackingStatus: 'Status',
    tracking: 'Tracking',
    running: 'Downloading',
    completed: 'Completed',
    failed: 'Failed',
    error: 'Error',
    paused: 'Paused',
    idle: 'Idle',
    stopped: 'Stopped',
    imagesFound: 'Images / Frames',
    images: 'Images',
    exportPdf: 'Export PDF',
    exportPdfPdfLib: 'PDF (pdf-lib)',
    exportPdfImg2Pdf: 'PDF (img2pdf)',
    pdfLibDescription: 'Direct binary vector embed',
    img2PdfDescription: 'Direct 1:1 image-to-PDF packaging',
    previewView: 'Preview',
    fullView: 'Full View',
    generatingPdf: 'Generating PDF...',
    generatingPdfLib: 'Exporting (pdf-lib)...',
    generatingImg2Pdf: 'Exporting (img2pdf)...',
    emptyState: 'No active tracking tasks. Use the New Task button above to start extracting and downloading chapters.',
    noActiveTasks: 'No active tracking tasks',
    loading: 'Loading...',
    progress: 'Progress',
    speed: 'Speed',
    date: 'Date',
    controls: 'Controls',
    newTask: 'New Task',
    createNewTask: 'Create New Task',
    createTaskSubtitle: 'Enter the link and configure the extraction & download mode',
    mangaUrl: 'Target URL',
    videoUrlLabel: 'Video URL',
    imageUrlLabel: 'Image / Gallery URL',
    trackingMode: 'Tracking Mode',
    trackAllSimultaneously: 'Track all chapters simultaneously',
    trackAllOneAfterAnother: 'Track all chapters one after another',
    trackOnlyOneSpecified: 'Track only one specified chapter',
    cancel: 'Cancel',
    addTask: 'Add Task',
    restart: 'Restart',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    delete: 'Delete',
    pageNumber: 'Page / Frame',
    selectPdfEngine: 'Choose export engine',
    calculating: 'Calculating...',
    chapters: 'Chapters / Items',
    discoveringChapters: 'Discovering chapters...',
    chapter: 'Chapter',
    downloadingBatch: 'Downloading in parallel...',
    exportAllPdf: 'Export All (PDF)',
    exportChapter: 'Export PDF',
    pages: 'items',
    collapse: 'Collapse',
    expand: 'Expand',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    pending: 'Pending',
    downloading: 'Downloading...',
    customDownload: 'Custom Selection & Download',
    firstN: 'First',
    lastN: 'Last',
    atOnce: 'at once',
    downloadSelected: 'Download Selected',
    exportSelectedPdfLib: 'Export Selected (pdf-lib)',
    exportSelectedImg2Pdf: 'Export Selected (img2pdf)',
    exportIndividualPdfs: 'Export Each Chapter as 1 File',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    invertSelection: 'Invert',
    selectedCount: 'selected',
    quickPresets: 'Quick Presets',
    enterQuantity: 'Qty',
    apply: 'Select',
    checkboxMode: 'Checkbox Selection Mode',
    allCollapsedNotice: 'Chapters are collapsed by default for smooth visual performance',
    manageSelectionAndDownload: 'Custom Selection & Batch Download',
    closeSelectionPanel: 'Close Manager',
    openSelectionPanel: 'Custom Batches & Selection',
    batchDownloadDescription: 'Select chapters with checkboxes or quick presets to download and export in batch or individually.',
    searchCategory: 'Category',
    categoryManga: 'Manga',
    categoryVideo: 'Video',
    categoryImage: 'Image',
    categoryNsfw: 'Image',
    categoryMangaDesc: 'Comics, manhwas, webtoons (single, sequential, parallel) with PDF Export',
    categoryVideoDesc: 'YouTube, TikTok, Shorts, clips, playlists with MP4, MKV, WebM & MP3 Export',
    categoryImageDesc: 'TikTok photos, X / Twitter, Instagram & galleries with ZIP, CBZ, WebP Export',
    categoryNsfwDesc: 'TikTok photos, X / Twitter, Instagram & galleries with ZIP, CBZ, WebP Export',
    paste: 'Paste',
    clear: 'Clear',
    videoSingle: 'Single Video / Short',
    videoSequential: 'Sequential / Playlist',
    videoParallel: 'Batch Extraction',
    imageSingle: 'Single Image / Post',
    imageSequential: 'Sequential Thread / Gallery',
    imageParallel: 'Batch Image Extraction',
    nsfwVideoSingle: 'Single Image / Post',
    nsfwVideoSequential: 'Sequential Thread / Gallery',
    nsfwVideoParallel: 'Batch Image Extraction',
    videoPlayer: 'Video Player',
    authorBy: 'by',
    author: 'Author',
    link: 'Link',
    copiedToClipboard: 'copied to clipboard',
    selectedFirstN: 'Selected the first',
    selectedLastN: 'Selected the last',
    smartWaitMode: 'Smart Wait Mode (Recommended)',
    antiCrash: 'Anti-Crash',
    smartWaitModeDesc: 'Prevents broken chapters when manga and media servers take time to respond.',
    serverSlowResponse: 'The server took too long to respond when requesting this chapter.',
    retryWithWaitModeHint: 'You can retry now using Smart Wait Mode with automated rate limiting and pauses.',
    retryChapterWaitMode: 'Retry Chapter (Wait Mode)',
    copyAuthor: 'Copy author name',
    copyUrl: 'Copy URL',
    
    // Language capsule & switcher
    languageCapsuleTitle: 'Language',
    spanish: 'Spanish',
    english: 'English',
    currentLanguage: 'Current Language: English',
    switchLanguage: 'Switch to Spanish',
    languageSwitchedNotification: 'Switched to English',
    
    // Image Category Export
    exportImageZip: 'ZIP Package',
    exportImageCbz: 'CBZ Comic',
    exportImageWebp: 'WebP Batch',
    exportImageJpg: 'JPG Batch',
    exportImagePng: 'PNG Batch',
    exportSelectedZip: 'Export Selected (ZIP)',
    exportSelectedWebp: 'Export Selected (WebP)',
    packagingImages: 'Packaging images...',
    packagingZip: 'Compressing to ZIP...',
    packagingWebp: 'Converting to WebP...',

    // Video Category Export
    exportVideoMp4: 'Video (MP4)',
    exportVideoWebm: 'Video (WebM)',
    exportVideoMkv: 'Video (MKV)',
    exportAudioMp3: 'Audio (MP3)',
    exportSelectedVideo: 'Download Video (MP4)',
    exportSelectedAudio: 'Extract Audio (MP3)',
    exportingVideo: 'Exporting Video...',
    exportingAudio: 'Extracting MP3...',
    imageWithAudio: 'Image with Audio',
    exportImageAudioVideo: 'Export as Video (MP4)',
    exportAudioTrack: 'Export Audio (MP3)',
    exportImageOnly: 'Download Image',
    playAudio: 'Play Audio',
    pauseAudio: 'Pause Audio',
    synthesizingVideo: 'Generating MP4 Video from Image + Audio...'
  },
  es: {
    appTitle: 'Liquid Fast Download',
    tagline: 'Motor avanzado de búsqueda, medios continuos y extracción secuencial de datos.',
    enterUrl: 'Introduce la URL a rastrear...',
    modeSingle: 'Capítulo Único',
    modeSequential: 'Capítulos Secuenciales',
    modeContinuous: 'Descarga Continua',
    startTracking: 'Iniciar Rastreo',
    trackingStatus: 'Estado',
    tracking: 'Rastreando',
    running: 'Descargando',
    completed: 'Completado',
    failed: 'Fallido',
    error: 'Error',
    paused: 'Pausado',
    idle: 'Inactivo',
    stopped: 'Detenido',
    imagesFound: 'Imágenes / Miniaturas',
    images: 'Imágenes',
    exportPdf: 'Exportar PDF',
    exportPdfPdfLib: 'PDF (pdf-lib)',
    exportPdfImg2Pdf: 'PDF (img2pdf)',
    pdfLibDescription: 'Incrustación de flujo binario vectorial',
    img2PdfDescription: 'Empaquetado 1:1 directo imagen-a-PDF',
    previewView: 'Vista Previa',
    fullView: 'Vista Completa',
    generatingPdf: 'Generando PDF...',
    generatingPdfLib: 'Exportando (pdf-lib)...',
    generatingImg2Pdf: 'Exportando (img2pdf)...',
    emptyState: 'No hay rastreadores activos. Usa el botón superior de "Nueva Tarea" para comenzar a extraer.',
    noActiveTasks: 'No hay tareas activas de rastreo',
    loading: 'Cargando...',
    progress: 'Progreso',
    speed: 'Velocidad',
    date: 'Fecha',
    controls: 'Controles',
    newTask: 'Nueva Tarea',
    createNewTask: 'Crear Nueva Tarea',
    createTaskSubtitle: 'Ingresa el enlace y configura el modo de extracción y descarga',
    mangaUrl: 'URL Objetivo',
    videoUrlLabel: 'URL del Video',
    imageUrlLabel: 'URL de la Imagen / Galería',
    trackingMode: 'Modo de Rastreo',
    trackAllSimultaneously: 'Rastrear todos los capítulos simultáneamente',
    trackAllOneAfterAnother: 'Rastrear todos los capítulos uno tras otro',
    trackOnlyOneSpecified: 'Rastrear solo un capítulo específico',
    cancel: 'Cancelar',
    addTask: 'Añadir Tarea',
    restart: 'Reiniciar',
    pause: 'Pausar',
    resume: 'Reanudar',
    stop: 'Detener',
    delete: 'Eliminar',
    pageNumber: 'Página / Frame',
    selectPdfEngine: 'Elegir motor de exportación',
    calculating: 'Calculando...',
    chapters: 'Capítulos / Videos',
    discoveringChapters: 'Descubriendo capítulos...',
    chapter: 'Capítulo',
    downloadingBatch: 'Descargando en paralelo...',
    exportAllPdf: 'Exportar Todo (PDF)',
    exportChapter: 'Exportar PDF',
    pages: 'elementos',
    collapse: 'Plegar',
    expand: 'Desplegar',
    expandAll: 'Expandir Todos',
    collapseAll: 'Plegar Todos',
    pending: 'Pendiente',
    downloading: 'Descargando...',
    customDownload: 'Descarga y Selección Personalizada',
    firstN: 'Primeros',
    lastN: 'Últimos',
    atOnce: 'a la vez',
    downloadSelected: 'Descargar seleccionados',
    exportSelectedPdfLib: 'Exportar Seleccionados (pdf-lib)',
    exportSelectedImg2Pdf: 'Exportar Seleccionados (img2pdf)',
    exportIndividualPdfs: 'Exportar cada cap. en 1 archivo individual',
    selectAll: 'Seleccionar Todos',
    deselectAll: 'Deselect. Todos',
    invertSelection: 'Invertir',
    selectedCount: 'seleccionados',
    quickPresets: 'Cantidades rápidas',
    enterQuantity: 'Cant.',
    apply: 'Seleccionar',
    checkboxMode: 'Modo Selección con Casillas (Check)',
    allCollapsedNotice: 'Todos los capítulos inician plegados para una carga suave',
    manageSelectionAndDownload: 'Administrar Selección y Descargas',
    closeSelectionPanel: 'Cerrar Gestor',
    openSelectionPanel: 'Selección y Lotes Personalizados',
    batchDownloadDescription: 'Selecciona capítulos con casillas o cantidades rápidas para descargar y exportar en lote o individualmente.',
    searchCategory: 'Categoría',
    categoryManga: 'Manga',
    categoryVideo: 'Video',
    categoryImage: 'Imagen',
    categoryNsfw: 'Imagen',
    categoryMangaDesc: 'Cómics, manhwas, webtoons (único, secuencial, simultáneo) con exportación a PDF',
    categoryVideoDesc: 'YouTube, TikTok, Shorts, clips, playlists con exportación a MP4, MKV, WebM y MP3',
    categoryImageDesc: 'Fotos de TikTok, X / Twitter, Instagram y galerías con exportación a ZIP, CBZ y WebP',
    categoryNsfwDesc: 'Fotos de TikTok, X / Twitter, Instagram y galerías con exportación a ZIP, CBZ y WebP',
    paste: 'Pegar',
    clear: 'Borrar',
    videoSingle: 'Video / Short Único',
    videoSequential: 'Playlist / Secuencial',
    videoParallel: 'Extracción Simultánea / Lote',
    imageSingle: 'Imagen / Publicación Única',
    imageSequential: 'Hilo Secuencial / Galería',
    imageParallel: 'Extracción de Imágenes en Lote',
    nsfwVideoSingle: 'Imagen / Publicación Única',
    nsfwVideoSequential: 'Hilo Secuencial / Galería',
    nsfwVideoParallel: 'Extracción de Imágenes en Lote',
    videoPlayer: 'Reproductor de Video',
    authorBy: 'por',
    author: 'Autor',
    link: 'Enlace',
    copiedToClipboard: 'copiado al portapapeles',
    selectedFirstN: 'Seleccionados los primeros',
    selectedLastN: 'Seleccionados los últimos',
    smartWaitMode: 'Modo Espera Inteligente (Recomendado)',
    antiCrash: 'Anticaídas',
    smartWaitModeDesc: 'Evita que los capítulos queden rotos cuando servidores de manga y medios tardan en responder.',
    serverSlowResponse: 'El servidor tardó en responder al solicitar este capítulo.',
    retryWithWaitModeHint: 'Puedes reintentarlo ahora usando el Modo Espera que hace pausas inteligentes y evita bloqueos.',
    retryChapterWaitMode: 'Reintentar Capítulo (Modo Espera)',
    copyAuthor: 'Copiar nombre del autor',
    copyUrl: 'Copiar URL',

    // Cápsula de idioma y selector
    languageCapsuleTitle: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    currentLanguage: 'Idioma actual: Español',
    switchLanguage: 'Cambiar a Inglés',
    languageSwitchedNotification: 'Cambiado a Español',

    // Exportación Categoría Imagen
    exportImageZip: 'Paquete ZIP',
    exportImageCbz: 'Cómic CBZ',
    exportImageWebp: 'Lote WebP',
    exportImageJpg: 'Lote JPG',
    exportImagePng: 'Lote PNG',
    exportSelectedZip: 'Exportar Seleccionados (ZIP)',
    exportSelectedWebp: 'Exportar Seleccionados (WebP)',
    packagingImages: 'Empaquetando imágenes...',
    packagingZip: 'Comprimiendo a ZIP...',
    packagingWebp: 'Convirtiendo a WebP...',

    // Exportación Categoría Video
    exportVideoMp4: 'Video (MP4)',
    exportVideoWebm: 'Video (WebM)',
    exportVideoMkv: 'Video (MKV)',
    exportAudioMp3: 'Audio (MP3)',
    exportSelectedVideo: 'Descargar Video (MP4)',
    exportSelectedAudio: 'Extraer Audio (MP3)',
    exportingVideo: 'Exportando Video...',
    exportingAudio: 'Extrayendo Audio MP3...',
    imageWithAudio: 'Imagen con Audio',
    exportImageAudioVideo: 'Exportar como Video (MP4)',
    exportAudioTrack: 'Exportar Audio (MP3)',
    exportImageOnly: 'Descargar Imagen',
    playAudio: 'Reproducir Audio',
    pauseAudio: 'Pausar Audio',
    synthesizingVideo: 'Generando Video MP4 de Imagen + Audio...'
  }
} as const;

export type TranslationKey = keyof typeof translations['en'];

type I18nContextType = {
  t: (key: TranslationKey) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'liquid_preferred_lang';

/**
 * High-accuracy multi-tier browser and system language detection.
 * Prioritizes:
 * 1. User manual localStorage setting.
 * 2. navigator.languages ordered preference list.
 * 3. navigator.language.
 * 4. Fallback system properties.
 */
export function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'es';
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore storage issues in private browsing
  }

  if (typeof navigator === 'undefined') {
    return 'es';
  }

  const candidateLanguages: string[] = [];

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    candidateLanguages.push(...navigator.languages);
  }
  if (navigator.language) {
    candidateLanguages.push(navigator.language);
  }
  const userLang = (navigator as unknown as { userLanguage?: string; browserLanguage?: string }).userLanguage;
  if (userLang) {
    candidateLanguages.push(userLang);
  }
  const browserLang = (navigator as unknown as { browserLanguage?: string }).browserLanguage;
  if (browserLang) {
    candidateLanguages.push(browserLang);
  }

  for (const lang of candidateLanguages) {
    if (typeof lang === 'string') {
      const lower = lang.toLowerCase().trim();
      if (lower.startsWith('es') || lower.includes('spanish') || lower.includes('es-')) {
        return 'es';
      }
      if (lower.startsWith('en') || lower.includes('english') || lower.includes('en-')) {
        return 'en';
      }
    }
  }

  return 'es';
}

const languageListeners = new Set<() => void>();

function subscribeLanguage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  languageListeners.add(callback);
  
  const handleNativeLangChange = () => {
    // If no manual preference is saved, update automatically on browser change
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        callback();
      }
    } catch {
      callback();
    }
  };

  window.addEventListener('languagechange', handleNativeLangChange);
  return () => {
    languageListeners.delete(callback);
    window.removeEventListener('languagechange', handleNativeLangChange);
  };
}

let cachedLang: Language | null = null;

function getLanguageSnapshot(): Language {
  if (cachedLang !== null) return cachedLang;
  cachedLang = detectBrowserLanguage();
  return cachedLang;
}

function getServerLanguageSnapshot(): Language {
  return 'es';
}

function updateLanguage(newLang: Language) {
  cachedLang = newLang;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    }
  } catch (e) {
    console.warn('Could not save language preference:', e);
  }
  languageListeners.forEach(fn => fn());
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const currentLang = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);

  const handleSetLanguage = useCallback((lang: Language) => {
    updateLanguage(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const nextLang = currentLang === 'es' ? 'en' : 'es';
    updateLanguage(nextLang);
  }, [currentLang]);

  const t = useCallback((key: TranslationKey): string => {
    const langObj = translations[currentLang] as Record<TranslationKey, string>;
    const defaultObj = translations.es as Record<TranslationKey, string>;
    return langObj?.[key] || defaultObj?.[key] || translations.en[key] || String(key);
  }, [currentLang]);

  return (
    <I18nContext.Provider value={{ t, language: currentLang, setLanguage: handleSetLanguage, toggleLanguage }}>
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
