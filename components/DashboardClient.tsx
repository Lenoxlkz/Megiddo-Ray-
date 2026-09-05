"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Plus, 
  ArrowDownToLine, 
  Zap, 
  List, 
  RotateCw, 
  LayoutGrid, 
  Maximize2, 
  FileText,
  Layers,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
  DownloadCloud,
  Download,
  SlidersHorizontal,
  FolderDown,
  X,
  Clipboard,
  Archive,
  Copy,
  CheckCheck,
  Video as VideoIcon,
  Image as ImageIcon,
  Music,
  ExternalLink,
  RotateCcw,
  Clock,
  AlertTriangle,
  AlertCircle,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tracker, TrackingMode, ChapterInfo, SearchCategory } from '@/types';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { useI18n } from '@/components/I18nProvider';
import { TerminalTitle } from '@/components/TerminalTitle';
import { LanguageCapsule } from '@/components/LanguageCapsule';
import { exportWithPdfLib, exportWithImg2Pdf } from '@/lib/pdfExporter';
import { exportImagesPackage, downloadSingleImage } from '@/lib/imageExporter';
import { exportVideo, exportAudioMp3, exportImageWithAudioAsVideo } from '@/lib/videoExporter';
import { AudioLinkModal } from '@/components/AudioLinkModal';
import { useTheme } from '@/components/ThemeProvider';
import { 
  StarOSAtmosphereBackground, 
  StarOSToggle, 
  StarOSPillButton, 
  StarOSSelectorPanel, 
  starosSpring, 
  starosBouncySpring 
} from '@/components/StarOSControls';

const getProxiedImageUrl = (url: string) => {
  if (!url) return '';
  const clean = url.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/').trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return clean;
  if (clean.startsWith('/api/proxy-image')) return clean;
  return `/api/proxy-image?url=${encodeURIComponent(clean)}`;
};

// Adaptive chapter downloader with exponential backoff & jitter for slow/unstable manga servers
async function downloadChapterWithAdaptiveRetry(
  chapterUrl: string,
  slowServer: boolean,
  onAttempt?: (attempt: number, maxAttempts: number, statusText: string) => void
): Promise<{ success: boolean; images: string[]; chapterName?: string; videoUrl?: string; mediaType?: 'image' | 'video'; author?: string }> {
  const maxAttempts = slowServer ? 4 : 2;
  const baseDelayMs = slowServer ? 1800 : 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (onAttempt && attempt > 1) {
        onAttempt(attempt, maxAttempts, `Reintentando (${attempt}/${maxAttempts})...`);
      }

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: chapterUrl, mode: 'single', slowServerMode: slowServer })
      });

      if (res.ok) {
        const data = await res.json();
        const imgs = data.images || [];
        if (imgs.length > 0 || data.videoUrl) {
          return {
            success: true,
            images: imgs,
            chapterName: data.chapterName,
            videoUrl: data.videoUrl,
            mediaType: data.mediaType,
            author: data.author
          };
        }
      }
    } catch (e) {
      console.warn(`Retry attempt ${attempt} error for ${chapterUrl}:`, e);
    }

    if (attempt < maxAttempts) {
      const waitMs = baseDelayMs * Math.pow(1.5, attempt - 1) + Math.random() * 500;
      if (onAttempt) {
        onAttempt(attempt, maxAttempts, `Esperando servidor (${Math.round(waitMs / 1000)}s)...`);
      }
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  return { success: false, images: [] };
}

interface TaskControl {
  isPaused: boolean;
  isStopped: boolean;
  resumeResolver?: () => void;
}

const EMPTY_TRACKERS: Tracker[] = [];
let memoryTrackers: Tracker[] = EMPTY_TRACKERS;
let isTrackersInitialized = false;
const trackerListeners = new Set<() => void>();

function getStoredTrackers(): Tracker[] {
  if (typeof window === 'undefined') return EMPTY_TRACKERS;
  if (!isTrackersInitialized) {
    isTrackersInitialized = true;
    try {
      const saved = localStorage.getItem('liquid_trackers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          memoryTrackers = parsed.map((item: any) => {
            const tracker: Tracker = {
              id: typeof item.id === 'string' ? item.id : uuidv4(),
              url: typeof item.url === 'string' ? item.url : '',
              title: typeof item.title === 'string' ? item.title : undefined,
              category: (item.category === 'manga' || item.category === 'video' || item.category === 'image' || item.category === 'nsfw') ? item.category : 'manga',
              mode: (item.mode === 'single' || item.mode === 'sequential' || item.mode === 'continuous') ? item.mode : 'single',
              status: (item.status === 'idle' || item.status === 'running' || item.status === 'paused' || item.status === 'completed' || item.status === 'error' || item.status === 'stopped') ? item.status : 'idle',
              progress: typeof item.progress === 'number' ? item.progress : 0,
              downloadSpeed: typeof item.downloadSpeed === 'string' ? item.downloadSpeed : '0 B/s',
              imageCount: typeof item.imageCount === 'number' ? item.imageCount : 0,
              totalImages: typeof item.totalImages === 'number' ? item.totalImages : undefined,
              images: Array.isArray(item.images) ? item.images : [],
              dateAdded: typeof item.dateAdded === 'string' ? item.dateAdded : new Date().toISOString(),
              totalChapters: typeof item.totalChapters === 'number' ? item.totalChapters : undefined,
              completedChapters: typeof item.completedChapters === 'number' ? item.completedChapters : undefined,
              currentChapter: typeof item.currentChapter === 'string' ? item.currentChapter : undefined,
              chapters: Array.isArray(item.chapters) ? item.chapters : [],
              mediaType: (item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'image_with_audio' || item.mediaType === 'audio') ? item.mediaType : undefined,
              videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : undefined,
              audioUrl: typeof item.audioUrl === 'string' ? item.audioUrl : undefined,
              hasAudio: typeof item.hasAudio === 'boolean' ? item.hasAudio : undefined,
              videoEmbedUrl: typeof item.videoEmbedUrl === 'string' ? item.videoEmbedUrl : undefined,
              author: typeof item.author === 'string' ? item.author : undefined,
              authorUrl: typeof item.authorUrl === 'string' ? item.authorUrl : undefined,
              slowServerMode: typeof item.slowServerMode === 'boolean' ? item.slowServerMode : true,
            };
            return tracker;
          });
        }
      }
    } catch {
      memoryTrackers = EMPTY_TRACKERS;
    }
  }
  return memoryTrackers;
}

function getServerTrackers(): Tracker[] {
  return EMPTY_TRACKERS;
}

function subscribeTrackers(callback: () => void) {
  trackerListeners.add(callback);
  return () => trackerListeners.delete(callback);
}

function updateTrackersGlobal(updater: Tracker[] | ((prev: Tracker[]) => Tracker[])) {
  const next = typeof updater === 'function' ? updater(memoryTrackers) : updater;
  memoryTrackers = next;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('liquid_trackers', JSON.stringify(next));
    }
  } catch (e) {
    console.error('Failed to save trackers', e);
  }
  trackerListeners.forEach(fn => fn());
}

export default function DashboardClient() {
  const { t, language } = useI18n();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const trackers = useSyncExternalStore(
    subscribeTrackers,
    getStoredTrackers,
    getServerTrackers
  );

  const setTrackers = useCallback((updater: Tracker[] | ((prev: Tracker[]) => Tracker[])) => {
    updateTrackersGlobal(updater);
  }, []);

  const [showNewModal, setShowNewModal] = useState(false);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<SearchCategory>('manga');
  const [newMode, setNewMode] = useState<TrackingMode>('single');
  const [newSlowServerMode, setNewSlowServerMode] = useState<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedViews, setExpandedViews] = useState<Record<string, 'preview' | 'full'>>({});
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [openCustomPanels, setOpenCustomPanels] = useState<Record<string, boolean>>({});
  const [selectedChapters, setSelectedChapters] = useState<Record<string, Record<string | number, boolean>>>({});
  const [customQty, setCustomQty] = useState<Record<string, string>>({});
  const [customDir, setCustomDir] = useState<Record<string, 'first' | 'last'>>({});
  const [isBatchDownloading, setIsBatchDownloading] = useState<Record<string, boolean>>({});
  const [generatingPdf, setGeneratingPdf] = useState<{ id: string; chapterId?: string | number; engine: 'pdflib' | 'img2pdf' } | null>(null);
  const [generatingExport, setGeneratingExport] = useState<{ id: string; chapterId?: string | number; type: string } | null>(null);
  const [downloadingSinglePage, setDownloadingSinglePage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [audioModalData, setAudioModalData] = useState<{
    isOpen: boolean;
    tracker: Tracker | null;
    chapter?: ChapterInfo | null;
  }>({
    isOpen: false,
    tracker: null,
    chapter: null,
  });

  // Active tracking controllers for pausing / stopping / resuming
  const controlsRef = useRef<Record<string, TaskControl>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const cleanInputUrl = (input: string) => {
    let cleaned = input.trim();
    // Strip any leading https://, http://, //, https:/, http:/
    cleaned = cleaned.replace(/^(?:https?:\/\/|\/\/|https?:\/|https?:)+/i, '');
    return cleaned;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = cleanInputUrl(e.target.value);
    setNewUrl(sanitized);
  };

  const handlePasteUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const sanitized = cleanInputUrl(text);
          setNewUrl(sanitized);
          inputRef.current?.focus();
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleClearUrl = () => {
    setNewUrl('');
    inputRef.current?.focus();
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast(`${label} ${t('copiedToClipboard')}`);
      }
    } catch (err) {
      console.warn('Copy error:', err);
    }
  };

  const openNewTaskModal = () => {
    setNewUrl('');
    setShowNewModal(true);
    setIsTypeSelectorOpen(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  };

  const closeNewTaskSettings = () => {
    setShowNewModal(false);
    setNewUrl('');
    setIsTypeSelectorOpen(false);
  };

  const toggleCustomPanel = (trackerId: string) => {
    setOpenCustomPanels(prev => ({
      ...prev,
      [trackerId]: !prev[trackerId]
    }));
  };

  const toggleView = (id: string, view: 'preview' | 'full') => {
    setExpandedViews(prev => {
      if (prev[id] === view) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: view };
    });
  };

  const toggleChapterCollapse = (trackerId: string, chapterId: string | number) => {
    const key = `${trackerId}_${chapterId}`;
    setCollapsedChapters(prev => {
      const current = prev[key] ?? true;
      return {
        ...prev,
        [key]: !current
      };
    });
  };

  const toggleCollapseAll = (tracker: Tracker, collapse: boolean) => {
    if (!tracker.chapters) return;
    setCollapsedChapters(prev => {
      const next = { ...prev };
      tracker.chapters?.forEach(ch => {
        next[`${tracker.id}_${ch.id}`] = collapse;
      });
      return next;
    });
  };

  // Checkbox & Custom Selection Logic
  const toggleChapterSelect = (trackerId: string, chapterId: string | number) => {
    setSelectedChapters(prev => {
      const trackerSel = prev[trackerId] || {};
      const currentVal = !!trackerSel[chapterId];
      return {
        ...prev,
        [trackerId]: {
          ...trackerSel,
          [chapterId]: !currentVal
        }
      };
    });
  };

  const selectFirstNChapters = (tracker: Tracker, count: number) => {
    if (!tracker.chapters) return;
    const newSel: Record<string | number, boolean> = {};
    const limit = Math.min(count, tracker.chapters.length);
    for (let i = 0; i < tracker.chapters.length; i++) {
      const chId = tracker.chapters[i].id;
      newSel[chId] = i < limit;
    }
    setSelectedChapters(prev => ({
      ...prev,
      [tracker.id]: newSel
    }));
    showToast(`${t('selectedFirstN')} ${limit} ${t('chapters')}`);
  };

  const selectLastNChapters = (tracker: Tracker, count: number) => {
    if (!tracker.chapters) return;
    const newSel: Record<string | number, boolean> = {};
    const total = tracker.chapters.length;
    const startIdx = Math.max(0, total - count);
    let selectedCount = 0;
    for (let i = 0; i < total; i++) {
      const chId = tracker.chapters[i].id;
      const isSel = i >= startIdx;
      newSel[chId] = isSel;
      if (isSel) selectedCount++;
    }
    setSelectedChapters(prev => ({
      ...prev,
      [tracker.id]: newSel
    }));
    showToast(`${t('selectedLastN')} ${selectedCount} ${t('chapters')}`);
  };

  const selectAllInTracker = (tracker: Tracker) => {
    if (!tracker.chapters) return;
    const newSel: Record<string | number, boolean> = {};
    tracker.chapters.forEach(ch => {
      newSel[ch.id] = true;
    });
    setSelectedChapters(prev => ({
      ...prev,
      [tracker.id]: newSel
    }));
    showToast(`${t('selectAll')} (${tracker.chapters.length})`);
  };

  const deselectAllInTracker = (tracker: Tracker) => {
    setSelectedChapters(prev => ({
      ...prev,
      [tracker.id]: {}
    }));
    showToast(t('deselectAll'));
  };

  const invertSelectionInTracker = (tracker: Tracker) => {
    if (!tracker.chapters) return;
    setSelectedChapters(prev => {
      const currentSel = prev[tracker.id] || {};
      const newSel: Record<string | number, boolean> = {};
      tracker.chapters?.forEach(ch => {
        newSel[ch.id] = !currentSel[ch.id];
      });
      return {
        ...prev,
        [tracker.id]: newSel
      };
    });
    showToast(t('invertSelection'));
  };

  // Toggle Slow Server / Wait Mode on a tracker
  const toggleSlowServerMode = (trackerId: string) => {
    setTrackers(prev => prev.map(item => {
      if (item.id === trackerId) {
        const nextVal = !(item.slowServerMode ?? true);
        showToast(nextVal ? `${t('smartWaitMode')}: ON` : `${t('smartWaitMode')}: OFF`);
        return {
          ...item,
          slowServerMode: nextVal
        };
      }
      return item;
    }));
  };

  // Download specific selected chapters (batch / custom) with adaptive pacing and retries
  const handleDownloadSelectedChapters = async (tracker: Tracker) => {
    const trackerSel = selectedChapters[tracker.id] || {};
    const selectedChapterList = (tracker.chapters || []).filter(ch => trackerSel[ch.id]);
    if (selectedChapterList.length === 0) return;

    const isSlow = tracker.slowServerMode ?? true;
    setIsBatchDownloading(prev => ({ ...prev, [tracker.id]: true }));
    showToast(`Iniciando descarga de ${selectedChapterList.length} capítulos ${isSlow ? '(Modo Espera)' : ''}...`);
    
    // Controlled concurrency to prevent overwhelming slow manga host servers
    const CONCURRENCY = isSlow ? 2 : 4;
    let curIdx = 0;
    const updatedChapters = [...(tracker.chapters || [])];

    const worker = async () => {
      while (curIdx < selectedChapterList.length) {
        const targetCh = selectedChapterList[curIdx++];
        if (!targetCh) break;

        const chIdx = updatedChapters.findIndex(c => c.id === targetCh.id);
        if (chIdx === -1) continue;

        updatedChapters[chIdx] = { 
          ...updatedChapters[chIdx], 
          status: 'downloading',
          errorMsg: undefined
        };
        setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));

        try {
          const res = await downloadChapterWithAdaptiveRetry(targetCh.url, isSlow, (attempt, max, text) => {
            updatedChapters[chIdx] = { ...updatedChapters[chIdx], errorMsg: text };
            setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));
          });

          updatedChapters[chIdx] = {
            ...updatedChapters[chIdx],
            status: res.success ? 'completed' : 'error',
            images: res.images,
            imageCount: res.images.length,
            videoUrl: res.videoUrl || updatedChapters[chIdx].videoUrl,
            mediaType: res.mediaType || updatedChapters[chIdx].mediaType,
            author: res.author || updatedChapters[chIdx].author,
            errorMsg: res.success ? undefined : 'Servidor tardó en responder'
          };
        } catch (e) {
          console.error("Error downloading chapter:", e);
          updatedChapters[chIdx] = { ...updatedChapters[chIdx], status: 'error', errorMsg: 'Error de red' };
        }

        setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));

        // Intelligent pacing delay between chapter requests when in slow server mode
        if (isSlow) {
          await new Promise(r => setTimeout(r, 600));
        }
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, selectedChapterList.length); w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // Re-aggregate ordered images
    const finalImgs: string[] = [];
    updatedChapters.forEach(c => {
      if (c.images) finalImgs.push(...c.images);
    });

    const failedCount = updatedChapters.filter(c => c.status === 'error').length;

    setTrackers(prev => prev.map(item => item.id === tracker.id ? {
      ...item,
      chapters: updatedChapters,
      images: finalImgs,
      imageCount: finalImgs.length,
      status: updatedChapters.every(c => c.status === 'completed') ? 'completed' : item.status
    } : item));

    setIsBatchDownloading(prev => ({ ...prev, [tracker.id]: false }));
    if (failedCount === 0) {
      showToast(`Descarga de capítulos completada con éxito (${finalImgs.length} páginas)`);
    } else {
      showToast(`Finalizado. ${failedCount} capítulos requieren reintento (Modo Espera disponible).`);
    }
  };

  // Dedicated one-click recovery for all failed / broken chapters with Mode Espera
  const handleRetryFailedChapters = async (tracker: Tracker) => {
    const failedList = (tracker.chapters || []).filter(c => 
      c.status === 'error' || 
      (c.status !== 'pending' && (!c.images || c.images.length === 0) && !c.videoUrl)
    );

    if (failedList.length === 0) {
      showToast('No hay capítulos con error para reintentar');
      return;
    }

    setIsBatchDownloading(prev => ({ ...prev, [tracker.id]: true }));
    showToast(`Iniciando Modo Espera: Reintentando ${failedList.length} capítulos lentos...`);

    // Ensure slow server mode is active for this recovery
    setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, slowServerMode: true } : item));

    const CONCURRENCY = 2; // Strict 2 workers to avoid rate-limiting or 503s
    let curIdx = 0;
    const updatedChapters = [...(tracker.chapters || [])];

    const worker = async () => {
      while (curIdx < failedList.length) {
        const targetCh = failedList[curIdx++];
        if (!targetCh) break;

        const chIdx = updatedChapters.findIndex(c => c.id === targetCh.id);
        if (chIdx === -1) continue;

        updatedChapters[chIdx] = { 
          ...updatedChapters[chIdx], 
          status: 'downloading', 
          errorMsg: 'Conectando en Modo Espera...' 
        };
        setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));

        try {
          const res = await downloadChapterWithAdaptiveRetry(targetCh.url, true, (attempt, max, text) => {
            updatedChapters[chIdx] = { ...updatedChapters[chIdx], errorMsg: text };
            setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));
          });

          updatedChapters[chIdx] = {
            ...updatedChapters[chIdx],
            status: res.success ? 'completed' : 'error',
            images: res.images,
            imageCount: res.images.length,
            videoUrl: res.videoUrl || updatedChapters[chIdx].videoUrl,
            mediaType: res.mediaType || updatedChapters[chIdx].mediaType,
            author: res.author || updatedChapters[chIdx].author,
            errorMsg: res.success ? undefined : 'Servidor no respondió'
          };
        } catch (e) {
          console.error("Error retrying chapter:", e);
          updatedChapters[chIdx] = { ...updatedChapters[chIdx], status: 'error', errorMsg: 'Fallo de conexión' };
        }

        setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));
        // Generous pacing between retried chapters
        await new Promise(r => setTimeout(r, 750));
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, failedList.length); w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    const finalImgs: string[] = [];
    updatedChapters.forEach(c => {
      if (c.images) finalImgs.push(...c.images);
    });

    const remainingFails = updatedChapters.filter(c => c.status === 'error').length;
    setTrackers(prev => prev.map(item => item.id === tracker.id ? {
      ...item,
      chapters: updatedChapters,
      images: finalImgs,
      imageCount: finalImgs.length,
      status: updatedChapters.every(c => c.status === 'completed') ? 'completed' : item.status
    } : item));

    setIsBatchDownloading(prev => ({ ...prev, [tracker.id]: false }));
    if (remainingFails === 0) {
      showToast(`¡Recuperación completada! Todos los capítulos descargados (${finalImgs.length} páginas).`);
    } else {
      showToast(`Recuperados ${failedList.length - remainingFails} capítulos. Quedan ${remainingFails} con error.`);
    }
  };

  // Re-download a single specific chapter in Wait Mode
  const handleRetrySingleChapter = async (tracker: Tracker, chapterId: string | number) => {
    const chIdx = (tracker.chapters || []).findIndex(c => c.id === chapterId);
    if (chIdx === -1) return;
    const targetCh = tracker.chapters![chIdx];

    showToast(`Reintentando "${targetCh.name}" en Modo Espera...`);

    const updatedChapters = [...(tracker.chapters || [])];
    updatedChapters[chIdx] = { 
      ...updatedChapters[chIdx], 
      status: 'downloading', 
      errorMsg: 'Conectando con el servidor...' 
    };
    setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));

    const res = await downloadChapterWithAdaptiveRetry(targetCh.url, true, (attempt, max, text) => {
      updatedChapters[chIdx] = { ...updatedChapters[chIdx], errorMsg: text };
      setTrackers(prev => prev.map(item => item.id === tracker.id ? { ...item, chapters: [...updatedChapters] } : item));
    });

    updatedChapters[chIdx] = {
      ...updatedChapters[chIdx],
      status: res.success ? 'completed' : 'error',
      images: res.images,
      imageCount: res.images.length,
      videoUrl: res.videoUrl || updatedChapters[chIdx].videoUrl,
      mediaType: res.mediaType || updatedChapters[chIdx].mediaType,
      author: res.author || updatedChapters[chIdx].author,
      errorMsg: res.success ? undefined : 'Servidor tardó en responder'
    };

    const finalImgs: string[] = [];
    updatedChapters.forEach(c => {
      if (c.images) finalImgs.push(...c.images);
    });

    setTrackers(prev => prev.map(item => item.id === tracker.id ? {
      ...item,
      chapters: updatedChapters,
      images: finalImgs,
      imageCount: finalImgs.length,
      status: updatedChapters.every(c => c.status === 'completed') ? 'completed' : item.status
    } : item));

    if (res.success) {
      showToast(`"${targetCh.name}" descargado con éxito (${res.images.length} páginas)`);
    } else {
      showToast(`El servidor de "${targetCh.name}" no respondió a tiempo.`);
    }
  };

  // Export all selected chapters into 1 combined PDF
  const handleExportSelectedCombined = async (tracker: Tracker, engine: 'pdflib' | 'img2pdf') => {
    const trackerSel = selectedChapters[tracker.id] || {};
    const selectedChapterList = (tracker.chapters || []).filter(ch => trackerSel[ch.id]);
    const combinedImages: string[] = [];
    selectedChapterList.forEach(ch => {
      if (ch.images && ch.images.length > 0) {
        combinedImages.push(...ch.images);
      }
    });

    if (combinedImages.length === 0) {
      showToast('Los capítulos seleccionados no tienen páginas descargadas aún');
      return;
    }
    const title = `${tracker.title || 'manga'}_${selectedChapterList.length}_capitulos`;
    showToast(`Generando PDF combinado (${combinedImages.length} páginas)...`);
    await handleExportPdf(tracker, engine, combinedImages, title);
    showToast('Descarga de PDF combinado completada');
  };

  // Export each selected chapter as an individual separate PDF file
  const handleExportSelectedIndividual = async (tracker: Tracker, engine: 'pdflib' | 'img2pdf') => {
    const trackerSel = selectedChapters[tracker.id] || {};
    const selectedChapterList = (tracker.chapters || []).filter(ch => trackerSel[ch.id] && ch.images && ch.images.length > 0);
    if (selectedChapterList.length === 0) {
      showToast('No hay capítulos seleccionados con páginas descargadas');
      return;
    }

    showToast(`Exportando ${selectedChapterList.length} PDFs individuales...`);
    for (const ch of selectedChapterList) {
      if (ch.images && ch.images.length > 0) {
        const title = `${tracker.title || 'manga'}_${ch.name}`;
        await handleExportPdf(tracker, engine, ch.images, title, ch.id);
        await new Promise(r => setTimeout(r, 400));
      }
    }
    showToast('Exportación de PDFs individuales finalizada');
  };

  // Helper to extract all ordered deduplicated images from a tracker
  const getTrackerImages = (tracker: Tracker): string[] => {
    const list: string[] = [];
    const seenUrls = new Set<string>();

    const addImg = (img: string | undefined | null) => {
      if (!img || typeof img !== 'string') return;
      const clean = img.trim().replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
      if (!clean) return;

      if (!seenUrls.has(clean)) {
        seenUrls.add(clean);
        list.push(clean);
      }
    };

    if (tracker.images && Array.isArray(tracker.images)) {
      tracker.images.forEach(addImg);
    }
    if (tracker.chapters && Array.isArray(tracker.chapters)) {
      tracker.chapters.forEach(ch => {
        if (ch.images && Array.isArray(ch.images)) {
          ch.images.forEach(addImg);
        }
      });
    }
    return list;
  };

  const getTrackerImageCount = (tracker: Tracker): number => {
    const imgs = getTrackerImages(tracker);
    if (imgs.length > 0) return imgs.length;
    if (tracker.chapters && tracker.chapters.length > 0) {
      return tracker.chapters.reduce((acc, c) => acc + (c.imageCount || c.images?.length || 0), 0);
    }
    return tracker.imageCount || tracker.images?.length || 0;
  };

  const handleExportPdf = async (
    tracker: Tracker, 
    engine: 'pdflib' | 'img2pdf', 
    customImages?: string[], 
    customTitle?: string,
    chapterId?: string | number
  ) => {
    const effectiveImgs = getTrackerImages(tracker);
    const imagesToExport = customImages && customImages.length > 0 ? customImages : effectiveImgs;
    if (!imagesToExport || imagesToExport.length === 0) {
      showToast('No hay páginas disponibles para exportar');
      return;
    }
    setGeneratingPdf({ id: tracker.id, chapterId, engine });

    try {
      if (engine === 'pdflib') {
        await exportWithPdfLib(tracker, imagesToExport, customTitle);
      } else {
        await exportWithImg2Pdf(tracker, imagesToExport, customTitle);
      }
      showToast('Descarga de PDF lista');
    } catch (err) {
      console.error(`Export failed with engine ${engine}:`, err);
      showToast('Error al generar PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Dedicated Exporter for Manga Image Package (ZIP / CBZ)
  const handleExportImagePackage = async (
    tracker: Tracker,
    format: 'original' | 'webp' | 'png' | 'jpg' = 'original',
    archiveType: 'zip' | 'cbz' = 'zip',
    customImages?: string[],
    customTitle?: string,
    chapterId?: string | number
  ) => {
    const effectiveImgs = getTrackerImages(tracker);
    const imagesToExport = customImages && customImages.length > 0 ? customImages : effectiveImgs;
    if (!imagesToExport || imagesToExport.length === 0) {
      showToast('No hay imágenes disponibles para empaquetar');
      return;
    }
    const typeKey = `${archiveType}_${format}`;
    setGeneratingExport({ id: tracker.id, chapterId, type: typeKey });
    showToast(`Empaquetando archivo ${archiveType.toUpperCase()} (${imagesToExport.length} páginas)...`);

    try {
      const defaultTitle = tracker.title || 'Manga_Export';
      const title = customTitle || defaultTitle;
      await exportImagesPackage({
        images: imagesToExport,
        title,
        format,
        archiveType
      });
      showToast(`Descarga de ${archiveType.toUpperCase()} completada`);
    } catch (err) {
      console.error('Image export failed:', err);
      showToast('Error al empaquetar archivo');
    } finally {
      setGeneratingExport(null);
    }
  };

  // Dedicated Exporter for Videos, Audio MP3, and Static Image + Audio to MP4 Video
  const handleUpdateAudio = useCallback((
    trackerId: string,
    chapterId: string | number | undefined,
    audioUrl: string,
    audioTitle?: string
  ) => {
    setTrackers(prev => {
      return prev.map(t => {
        if (t.id === trackerId) {
          const updatedChapters = t.chapters?.map(c => {
            if (c.id === chapterId || (!chapterId && t.chapters?.length === 1)) {
              return {
                ...c,
                audioUrl: audioUrl || undefined,
                hasAudio: !!audioUrl,
                mediaType: (audioUrl ? 'image_with_audio' : c.mediaType) as any,
              };
            }
            return c;
          });

          return {
            ...t,
            audioUrl: audioUrl || undefined,
            hasAudio: !!audioUrl,
            mediaType: (audioUrl ? 'image_with_audio' : t.mediaType) as any,
            chapters: updatedChapters || t.chapters,
          };
        }
        return t;
      });
    });

    if (audioUrl) {
      showToast('Pista de audio vinculada con éxito. Ya puedes exportar MP3 o video MP4 con sonido.');
    } else {
      showToast('Pista de audio desvinculada');
    }
  }, [showToast, setTrackers]);

  const handleExportVideo = async (
    tracker: Tracker,
    format: 'mp4' | 'mp3' = 'mp4',
    customUrl?: string,
    customTitle?: string,
    chapterId?: string | number
  ) => {
    const activeChapter = chapterId ? tracker.chapters?.find(c => c.id === chapterId) : tracker.chapters?.[0];
    const targetUrl = customUrl || activeChapter?.videoUrl || activeChapter?.audioUrl || activeChapter?.url || tracker.videoUrl || tracker.audioUrl || tracker.url;
    const targetAudioUrl = activeChapter?.audioUrl || tracker.audioUrl;
    const targetImageUrl = activeChapter?.images?.[0] || tracker.images?.[0];
    const isImageWithAudio = tracker.mediaType === 'image_with_audio' || activeChapter?.mediaType === 'image_with_audio' || (targetImageUrl && targetAudioUrl);

    // If Instagram post has no direct audio or video, prompt user to link or search audio
    const hasValidAudioOrVideo = targetAudioUrl || tracker.videoUrl || activeChapter?.videoUrl || (targetUrl && (targetUrl.endsWith('.mp4') || targetUrl.endsWith('.mp3')));
    const isInstagramPhotoPost = (tracker.url?.includes('instagram.com') || tracker.url?.includes('instagr.am')) && !hasValidAudioOrVideo;

    if (isInstagramPhotoPost && !targetAudioUrl) {
      showToast('Instagram restringe la música en fotos estáticas. Abre el panel para vincular o buscar la canción en 1 clic.');
      setAudioModalData({ isOpen: true, tracker, chapter: activeChapter || null });
      return;
    }

    setGeneratingExport({ id: tracker.id, chapterId, type: format });
    const defaultTitle = activeChapter?.name || tracker.title || (format === 'mp3' ? 'Audio_Export' : 'Video_Export');
    const title = customTitle || defaultTitle;

    try {
      if (format === 'mp3') {
        showToast(t('exportingAudio'));
        const success = await exportAudioMp3({
          videoUrl: targetUrl,
          audioUrl: targetAudioUrl,
          imageUrl: targetImageUrl,
          title,
          onProgress: (pct, msg) => {
            if (pct === 100) showToast('Audio MP3 listo');
          }
        });
        if (success) {
          showToast('Descarga de MP3 completada');
        } else {
          showToast('Error al extraer audio MP3');
        }
      } else {
        if (isImageWithAudio && targetImageUrl) {
          showToast(t('synthesizingVideo'));
          const success = await exportImageWithAudioAsVideo({
            imageUrl: targetImageUrl,
            audioUrl: targetAudioUrl,
            title,
            onProgress: (pct, msg) => {
              if (pct === 100) showToast('Video MP4 generado con éxito');
            }
          });
          if (success) {
            showToast('Video MP4 descargado');
          } else {
            showToast('Error al sintetizar video MP4');
          }
        } else {
          showToast(t('exportingVideo'));
          const success = await exportVideo({
            videoUrl: targetUrl,
            imageUrl: targetImageUrl,
            audioUrl: targetAudioUrl,
            title,
            format: 'mp4',
            onProgress: (pct, msg) => {
              if (pct === 100) showToast('Video descargado');
            }
          });
          if (success) {
            showToast('Descarga de video completada');
          } else {
            showToast('Error al descargar video');
          }
        }
      }
    } catch (err) {
      console.error('Video/Audio export error:', err);
      showToast('Error durante la exportación de medios');
    } finally {
      setGeneratingExport(null);
    }
  };

  // Single page direct download handler without external redirection
  const handleDownloadSinglePage = async (imgUrl: string, pageNumber: number, chapterName?: string) => {
    const key = `${imgUrl}_${pageNumber}`;
    setDownloadingSinglePage(key);
    showToast(`Descargando página ${pageNumber}...`);
    try {
      const sanitizedCh = (chapterName || 'Capitulo').replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `${sanitizedCh}_Pagina_${String(pageNumber).padStart(3, '0')}`;
      const success = await downloadSingleImage(imgUrl, filename);
      if (success) {
        showToast(`Página ${pageNumber} descargada`);
      } else {
        showToast(`Error al descargar página ${pageNumber}`);
      }
    } catch (err) {
      console.error('Download single page error:', err);
      showToast('Fallo en la descarga de la página');
    } finally {
      setDownloadingSinglePage(null);
    }
  };

  // Helper to wait while paused
  const checkPauseOrStop = async (trackerId: string): Promise<boolean> => {
    const ctrl = controlsRef.current[trackerId];
    if (!ctrl) return false;
    if (ctrl.isStopped) return false;

    if (ctrl.isPaused) {
      await new Promise<void>((resolve) => {
        ctrl.resumeResolver = resolve;
      });
      if (ctrl.isStopped) return false;
    }
    return true;
  };

  // Core execution routine for a Tracker
  const executeTracker = useCallback(async (trackerId: string, url: string, mode: TrackingMode, category: SearchCategory = 'manga') => {
    controlsRef.current[trackerId] = { isPaused: false, isStopped: false };

    // Update status to running
    setTrackers(prev => prev.map(item => {
      if (item.id === trackerId) {
        return {
          ...item,
          status: 'running',
          progress: 5,
          downloadSpeed: t('calculating'),
          currentChapter: mode === 'single' ? undefined : t('discoveringChapters')
        };
      }
      return item;
    }));

    const startTime = Date.now();
    let totalBytesEstimated = 0;

    // 1. Single Chapter / Media Mode
    if (mode === 'single') {
      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, mode: 'single' })
        });

        if (!res.ok) throw new Error('Download failed');
        const data = await res.json();
        const images: string[] = data.images || [];
        const detectedMediaType: 'image' | 'video' = data.mediaType || (category === 'video' ? 'video' : 'image');

        const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.5);
        totalBytesEstimated = images.length * 180 * 1024; // ~180KB per webp
        const speedMb = ((totalBytesEstimated / (1024 * 1024)) / elapsedSec).toFixed(1);

        const singleChapterName = data.chapterName || (detectedMediaType === 'video' ? 'Video 1' : (t('chapter') + ' 1'));
        const singleChapter: ChapterInfo = {
          id: 1,
          name: singleChapterName,
          url,
          images,
          imageCount: images.length,
          status: 'completed',
          mediaType: detectedMediaType,
          videoUrl: data.videoUrl,
          videoEmbedUrl: data.videoEmbedUrl,
          author: data.author,
          authorUrl: data.authorUrl
        };

        setTrackers(prev => prev.map(item => {
          if (item.id === trackerId) {
            const updatedTitle = data.seriesTitle 
              ? (data.chapterName ? `${data.seriesTitle} - ${data.chapterName}` : data.seriesTitle)
              : (data.chapterName || item.title);
            return {
              ...item,
              title: updatedTitle,
              category: item.category || category,
              status: 'completed',
              progress: 100,
              imageCount: images.length,
              images,
              chapters: [singleChapter],
              downloadSpeed: `${speedMb} MB/s`,
              totalChapters: 1,
              completedChapters: 1,
              mediaType: detectedMediaType,
              videoUrl: data.videoUrl,
              videoEmbedUrl: data.videoEmbedUrl,
              author: data.author || item.author,
              authorUrl: data.authorUrl || item.authorUrl
            };
          }
          return item;
        }));
      } catch (err) {
        console.error('Single media scraping failed:', err);
        setTrackers(prev => prev.map(item => item.id === trackerId ? { ...item, status: 'error', downloadSpeed: '0 MB/s' } : item));
      }
      return;
    }

    // 2. Sequential & Continuous: First discover all chapters / tracks
    let chapters: ChapterInfo[] = [];
    let seriesTitle = '';

    try {
      const chapterRes = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (chapterRes.ok) {
        const chData = await chapterRes.json();
        chapters = chData.chapters || [];
        seriesTitle = chData.seriesTitle || '';
      }
    } catch (chErr) {
      console.warn('Chapters discovery failed, will fallback to single URL:', chErr);
    }

    if (!chapters || chapters.length === 0) {
      chapters = [{ id: 1, name: 'Capítulo 1', url }];
    }

    const initialChapters: ChapterInfo[] = chapters.map((c, idx) => ({
      id: c.id || (idx + 1),
      name: c.name || `${t('chapter')} ${idx + 1}`,
      url: c.url,
      status: (c.images && c.images.length > 0) ? 'completed' : 'pending',
      images: c.images || [],
      imageCount: c.images?.length || 0,
      mediaType: c.mediaType || (category === 'video' ? 'video' : 'image'),
      videoUrl: c.videoUrl,
      videoEmbedUrl: c.videoEmbedUrl,
      author: c.author,
      authorUrl: c.authorUrl
    }));

    const initialImages: string[] = [];
    chapters.forEach(c => {
      if (c.images && c.images.length > 0) {
        initialImages.push(...c.images);
      }
    });

    const isAlreadyFullyDiscovered = initialChapters.length > 0 && initialChapters.every(c => c.status === 'completed' && ((c.images && c.images.length > 0) || c.videoUrl));
    if (isAlreadyFullyDiscovered) {
      setTrackers(prev => prev.map(item => {
        if (item.id === trackerId) {
          return {
            ...item,
            title: seriesTitle || item.title,
            category: item.category || category,
            mediaType: initialChapters[0]?.mediaType || (category === 'video' ? 'video' : 'image'),
            videoUrl: initialChapters[0]?.videoUrl || item.videoUrl,
            author: initialChapters[0]?.author || item.author,
            totalChapters: chapters.length,
            completedChapters: chapters.length,
            progress: 100,
            status: 'completed',
            imageCount: initialImages.length,
            images: initialImages,
            chapters: [...initialChapters],
            downloadSpeed: '0 MB/s',
            currentChapter: `${chapters.length} / ${chapters.length} ${t('chapters')}`
          };
        }
        return item;
      }));
      return;
    }

    const currentChaptersState: ChapterInfo[] = [...initialChapters];

    setTrackers(prev => prev.map(item => {
      if (item.id === trackerId) {
        return {
          ...item,
          title: seriesTitle || item.title,
          category: item.category || category,
          mediaType: initialChapters[0]?.mediaType || (category === 'video' ? 'video' : 'image'),
          videoUrl: initialChapters[0]?.videoUrl || item.videoUrl,
          author: initialChapters[0]?.author || item.author,
          totalChapters: chapters.length,
          completedChapters: 0,
          progress: 8,
          chapters: [...currentChaptersState],
          currentChapter: `0 / ${chapters.length} ${t('chapters')}`
        };
      }
      return item;
    }));

    const isSlowServer = memoryTrackers.find(t => t.id === trackerId)?.slowServerMode ?? true;

    // 2A. SEQUENTIAL MODE (Track one chapter after another in order)
    if (mode === 'sequential') {
      const allImages: string[] = [];
      let completedCount = 0;

      for (let i = 0; i < chapters.length; i++) {
        const canContinue = await checkPauseOrStop(trackerId);
        if (!canContinue) return;

        const chapter = currentChaptersState[i];
        currentChaptersState[i] = {
          ...currentChaptersState[i],
          status: 'downloading',
          errorMsg: undefined
        };

        setTrackers(prev => prev.map(item => {
          if (item.id === trackerId) {
            return {
              ...item,
              currentChapter: `${chapter.name} (${i + 1}/${chapters.length})`,
              chapters: [...currentChaptersState]
            };
          }
          return item;
        }));

        let chImages: string[] = [];
        let chVideoUrl = currentChaptersState[i].videoUrl;
        let chMediaType = currentChaptersState[i].mediaType;
        let chAuthor = currentChaptersState[i].author;

        try {
          const res = await downloadChapterWithAdaptiveRetry(chapter.url, isSlowServer, (attempt, max, text) => {
            currentChaptersState[i] = { ...currentChaptersState[i], errorMsg: text };
            setTrackers(prev => prev.map(item => item.id === trackerId ? { ...item, chapters: [...currentChaptersState] } : item));
          });

          if (res.success) {
            chImages = res.images || [];
            if (res.videoUrl) chVideoUrl = res.videoUrl;
            if (res.mediaType) chMediaType = res.mediaType;
            if (res.author) chAuthor = res.author;
            allImages.push(...chImages);
            completedCount++;
            totalBytesEstimated += chImages.length * 180 * 1024;
          }
        } catch (e) {
          console.warn(`Error on chapter ${chapter.name}:`, e);
        }

        currentChaptersState[i] = {
          ...currentChaptersState[i],
          status: (chImages.length > 0 || chVideoUrl) ? 'completed' : 'error',
          images: chImages,
          imageCount: chImages.length,
          videoUrl: chVideoUrl,
          mediaType: chMediaType,
          author: chAuthor,
          errorMsg: (chImages.length > 0 || chVideoUrl) ? undefined : 'Servidor tardó en responder'
        };

        const elapsedSec = Math.max((Date.now() - startTime) / 1000, 1);
        const speedMb = ((totalBytesEstimated / (1024 * 1024)) / elapsedSec).toFixed(1);
        const progressPct = Math.min(Math.round(((i + 1) / chapters.length) * 100), 99);

        setTrackers(prev => prev.map(item => {
          if (item.id === trackerId) {
            return {
              ...item,
              progress: progressPct,
              imageCount: allImages.length,
              images: [...allImages],
              chapters: [...currentChaptersState],
              completedChapters: completedCount,
              downloadSpeed: `${speedMb} MB/s`,
              videoUrl: chVideoUrl || item.videoUrl,
              mediaType: chMediaType || item.mediaType,
              author: chAuthor || item.author
            };
          }
          return item;
        }));

        if (isSlowServer) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      setTrackers(prev => prev.map(item => {
        if (item.id === trackerId) {
          return {
            ...item,
            status: 'completed',
            progress: 100,
            imageCount: allImages.length,
            images: allImages,
            chapters: [...currentChaptersState],
            completedChapters: completedCount,
            currentChapter: `${completedCount} / ${chapters.length} ${t('chapters')}`,
            downloadSpeed: '0 MB/s',
            videoUrl: currentChaptersState[0]?.videoUrl || item.videoUrl,
            mediaType: currentChaptersState[0]?.mediaType || item.mediaType,
            author: currentChaptersState[0]?.author || item.author
          };
        }
        return item;
      }));
      return;
    }

    // 2B. CONTINUOUS MODE (Simultaneous parallel streams with controlled rate)
    if (mode === 'continuous') {
      let completedCount = 0;
      const CONCURRENCY = isSlowServer ? 2 : 4;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < chapters.length) {
          const idx = currentIndex++;
          if (idx >= chapters.length) break;

          const canContinue = await checkPauseOrStop(trackerId);
          if (!canContinue) break;

          currentChaptersState[idx] = {
            ...currentChaptersState[idx],
            status: 'downloading',
            errorMsg: undefined
          };

          setTrackers(prev => prev.map(item => {
            if (item.id === trackerId) {
              return {
                ...item,
                chapters: [...currentChaptersState]
              };
            }
            return item;
          }));

          let chImages: string[] = [];
          let chVideoUrl = currentChaptersState[idx].videoUrl;
          let chMediaType = currentChaptersState[idx].mediaType;
          let chAuthor = currentChaptersState[idx].author;

          try {
            const res = await downloadChapterWithAdaptiveRetry(currentChaptersState[idx].url, isSlowServer, (attempt, max, text) => {
              currentChaptersState[idx] = { ...currentChaptersState[idx], errorMsg: text };
              setTrackers(prev => prev.map(item => item.id === trackerId ? { ...item, chapters: [...currentChaptersState] } : item));
            });

            if (res.success) {
              chImages = res.images || [];
              if (res.videoUrl) chVideoUrl = res.videoUrl;
              if (res.mediaType) chMediaType = res.mediaType;
              if (res.author) chAuthor = res.author;
              totalBytesEstimated += chImages.length * 180 * 1024;
            }
          } catch (e) {
            console.warn(`Parallel worker error on chapter ${idx}:`, e);
          }

          currentChaptersState[idx] = {
            ...currentChaptersState[idx],
            status: (chImages.length > 0 || chVideoUrl) ? 'completed' : 'error',
            images: chImages,
            imageCount: chImages.length,
            videoUrl: chVideoUrl,
            mediaType: chMediaType,
            author: chAuthor,
            errorMsg: (chImages.length > 0 || chVideoUrl) ? undefined : 'Servidor tardó en responder'
          };

          completedCount++;
          const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.8);
          const speedMb = ((totalBytesEstimated / (1024 * 1024)) / elapsedSec).toFixed(1);
          const progressPct = Math.min(Math.round((completedCount / chapters.length) * 100), 99);

          const currentOrderedImages: string[] = [];
          for (let k = 0; k < currentChaptersState.length; k++) {
            if (currentChaptersState[k].images && currentChaptersState[k].images!.length > 0) {
              currentOrderedImages.push(...currentChaptersState[k].images!);
            }
          }

          setTrackers(prev => prev.map(item => {
            if (item.id === trackerId) {
              return {
                ...item,
                progress: progressPct,
                completedChapters: completedCount,
                imageCount: currentOrderedImages.length,
                images: currentOrderedImages,
                chapters: [...currentChaptersState],
                downloadSpeed: `${speedMb} MB/s`,
                currentChapter: `${completedCount} / ${chapters.length} ${t('chapters')}`,
                videoUrl: chVideoUrl || item.videoUrl,
                mediaType: chMediaType || item.mediaType,
                author: chAuthor || item.author
              };
            }
            return item;
          }));

          if (isSlowServer) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
      };

      const workers = [];
      for (let w = 0; w < Math.min(CONCURRENCY, chapters.length); w++) {
        workers.push(worker());
      }

      await Promise.all(workers);

      const finalOrderedImages: string[] = [];
      for (let k = 0; k < currentChaptersState.length; k++) {
        if (currentChaptersState[k].images && currentChaptersState[k].images!.length > 0) {
          finalOrderedImages.push(...currentChaptersState[k].images!);
        }
      }

      setTrackers(prev => prev.map(item => {
        if (item.id === trackerId) {
          return {
            ...item,
            status: 'completed',
            progress: 100,
            imageCount: finalOrderedImages.length,
            images: finalOrderedImages,
            chapters: [...currentChaptersState],
            completedChapters: completedCount,
            currentChapter: `${completedCount} / ${chapters.length} ${t('chapters')}`,
            downloadSpeed: '0 MB/s',
            videoUrl: currentChaptersState[0]?.videoUrl || item.videoUrl,
            mediaType: currentChaptersState[0]?.mediaType || item.mediaType,
            author: currentChaptersState[0]?.author || item.author
          };
        }
        return item;
      }));
      return;
    }
  }, [t, setTrackers]);

  const addTracker = async () => {
    const cleanUrl = cleanInputUrl(newUrl);
    if (!cleanUrl) return;
    
    const fullUrl = `https://${cleanUrl}`;
    
    const newTracker: Tracker = {
      id: uuidv4(),
      url: fullUrl,
      category: newCategory,
      mode: newMode,
      slowServerMode: newSlowServerMode,
      status: 'running',
      progress: 5,
      downloadSpeed: t('calculating'),
      imageCount: 0,
      images: [],
      mediaType: newCategory === 'video' ? 'video' : 'image',
      dateAdded: new Date().toISOString()
    };
    
    setTrackers(prev => [newTracker, ...prev]);
    setShowNewModal(false);
    setNewUrl('');
    showToast(`${newCategory === 'video' ? 'Video' : newCategory === 'image' ? 'Imagen' : 'Manga'} añadido con éxito`);

    // Trigger execution
    executeTracker(newTracker.id, newTracker.url, newTracker.mode, newCategory);
  };

  const pauseTracker = (id: string) => {
    if (controlsRef.current[id]) {
      controlsRef.current[id].isPaused = true;
    }
    setTrackers(prev => prev.map(item => item.id === id ? { ...item, status: 'paused', downloadSpeed: '0 MB/s' } : item));
    showToast('Rastreo pausado');
  };

  const resumeTracker = (id: string) => {
    const ctrl = controlsRef.current[id];
    if (ctrl) {
      ctrl.isPaused = false;
      if (ctrl.resumeResolver) {
        ctrl.resumeResolver();
        ctrl.resumeResolver = undefined;
      }
    } else {
      const tr = trackers.find(item => item.id === id);
      if (tr) {
        executeTracker(tr.id, tr.url, tr.mode, tr.category || 'manga');
        return;
      }
    }
    setTrackers(prev => prev.map(item => item.id === id ? { ...item, status: 'running' } : item));
    showToast('Rastreo reanudado');
  };

  const stopTracker = (id: string) => {
    if (controlsRef.current[id]) {
      controlsRef.current[id].isStopped = true;
      if (controlsRef.current[id].resumeResolver) {
        controlsRef.current[id].resumeResolver!();
      }
    }
    setTrackers(prev => prev.map(item => item.id === id ? { ...item, status: 'stopped', downloadSpeed: '0 MB/s' } : item));
    showToast('Rastreo detenido');
  };

  const restartTracker = (id: string) => {
    const tr = trackers.find(item => item.id === id);
    if (!tr) return;
    stopTracker(id);
    setTrackers(prev => prev.map(item => item.id === id ? { 
      ...item, 
      status: 'running', 
      progress: 5, 
      imageCount: 0, 
      images: [], 
      completedChapters: 0 
    } : item));
    setTimeout(() => {
      executeTracker(id, tr.url, tr.mode, tr.category || 'manga');
    }, 150);
    showToast('Reiniciando rastreo');
  };

  const removeTracker = (id: string) => {
    stopTracker(id);
    delete controlsRef.current[id];
    setTrackers(current => current.filter(tItem => tItem.id !== id));
    showToast('Tarea eliminada');
  };

  const getModeIcon = (mode: TrackingMode) => {
    switch (mode) {
      case 'single': return <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />;
      case 'sequential': return <List className="w-3.5 h-3.5 text-blue-400" />;
      case 'continuous': return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    }
  };
  
  const getModeLabel = (mode: TrackingMode) => {
    switch (mode) {
      case 'single': return t('modeSingle');
      case 'sequential': return t('modeSequential');
      case 'continuous': return t('modeContinuous');
    }
  };

  const getStatusLabel = (status: Tracker['status']) => {
    switch (status) {
      case 'running': return t('running');
      case 'completed': return t('completed');
      case 'error': return t('error');
      case 'paused': return t('paused');
      case 'stopped': return t('stopped');
      default: return t('idle');
    }
  };

  return (
    <div className={cn(
      "min-h-screen p-4 sm:p-8 font-sans selection:bg-emerald-500/30 relative overflow-x-hidden transition-colors duration-300",
      isLight ? "text-neutral-900 selection:text-neutral-950" : "text-neutral-200 selection:text-white"
    )}>
      
      {/* StarOS Atmospheric Nature & Bokeh Ambient Background Layer */}
      <StarOSAtmosphereBackground />

      {/* Global In-App Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={starosBouncySpring}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full staros-glass-pill border border-emerald-400/50 text-emerald-300 text-xs font-semibold shadow-[0_0_30px_rgba(16,185,129,0.35)] backdrop-blur-2xl flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        
        {/* StarOS Frosted Header: Morphs into Inline Settings when Creating a Task */}
        <header className="relative w-full pb-6 border-b border-white/10">
          <AnimatePresence mode="wait">
            {!showNewModal ? (
              <motion.div
                key="default-header"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={starosSpring}
                className="flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-full flex justify-center">
                  <TerminalTitle />
                </div>

                <p className="text-xs sm:text-sm text-neutral-300/80 max-w-xl mx-auto px-4 -mt-1 leading-relaxed">
                  {t('tagline')}
                </p>
                
                <div className="pt-2">
                  <motion.button 
                    id="new-task-button"
                    onClick={openNewTaskModal}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.94 }}
                    transition={starosBouncySpring}
                    className="relative inline-flex items-center gap-2.5 px-7 py-3 rounded-full text-neutral-950 font-bold text-sm cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-400 bg-emerald-400 hover:bg-emerald-300 transition-all overflow-hidden select-none"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70" />
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{t('newTask')}</span>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="inline-settings-header"
                initial={{ opacity: 0, y: -15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={starosSpring}
                className="w-full staros-glass rounded-3xl p-5 sm:p-7 border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.25)] space-y-6 text-left"
              >
                {/* 1. Header Bar with Title & Close/Cancel Button */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)] shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          {t('newTask')}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono staros-glass-pill text-emerald-300 border border-emerald-400/40">
                          {newCategory.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300/80">
                        {t('createTaskSubtitle')}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={closeNewTaskSettings}
                    whileHover={{ scale: 1.08, rotate: 90 }}
                    whileTap={{ scale: 0.92 }}
                    transition={starosSpring}
                    className="p-2 rounded-full staros-glass-pill text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title={t('cancel')}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* 2. BARRA DE URL PRIMERAMENTE ARRIBA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-200 tracking-wide flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{newCategory === 'video' ? 'URL o Enlace del Video' : newCategory === 'image' ? 'URL de la Galería o Imagen' : t('mangaUrl')}</span>
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {newCategory === 'video' ? 'YouTube, Vimeo, MP4...' : newCategory === 'image' ? 'Reddit, Imgur, WebP...' : 'TMO, MangaDex, InManga...'}
                    </span>
                  </div>

                  <div className="relative flex items-center w-full rounded-2xl bg-white/[0.06] border border-white/15 focus-within:border-emerald-400/80 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all overflow-hidden group shadow-inner">
                    <div className="flex items-center pl-3.5 pr-2.5 py-3 text-emerald-400 font-mono text-sm font-semibold select-none shrink-0 bg-white/[0.04] border-r border-white/10">
                      <span className="opacity-70 text-neutral-400 mr-0.5">https://</span>
                    </div>

                    <input
                      ref={inputRef}
                      type="text"
                      value={newUrl}
                      onChange={handleUrlChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newUrl.trim()) {
                          addTracker();
                        }
                      }}
                      placeholder={newCategory === 'video' ? 'youtube.com/watch?v=... o url de video' : newCategory === 'image' ? 'reddit.com/gallery/... o url directa' : 'tumangaonline.com/manga/... o lector'}
                      className="w-full bg-transparent px-3.5 py-3 text-sm text-white placeholder-neutral-500 font-mono focus:outline-none"
                    />

                    {/* Quick Paste or Clear Buttons */}
                    <div className="flex items-center pr-2 shrink-0 gap-1.5">
                      <AnimatePresence mode="wait">
                        {!newUrl ? (
                          <motion.button
                            key="paste-btn"
                            type="button"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={starosSpring}
                            onClick={handlePasteUrl}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-400/40 text-xs font-medium cursor-pointer transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            title={t('paste')}
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                            <span>{t('paste')}</span>
                          </motion.button>
                        ) : (
                          <motion.button
                            key="clear-btn"
                            type="button"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={starosSpring}
                            onClick={handleClearUrl}
                            className="p-1.5 rounded-full bg-white/10 hover:bg-red-500/25 text-neutral-300 hover:text-red-300 border border-white/10 hover:border-red-500/40 text-xs transition-all cursor-pointer shadow-sm"
                            title={t('clear')}
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* 3. CATEGORÍAS EN FILA: PÍLDORAS HORIZONTALES DELGADAS */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-200 tracking-wide flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('searchCategory')}</span>
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {newCategory === 'manga' ? 'Manga / Cómic' : newCategory === 'video' ? 'Video / Audio' : 'Imagen / Galería'}
                    </span>
                  </div>

                  {/* Fila de píldoras horizontales delgadas para las categorías */}
                  <div className="flex items-center gap-2">
                    {/* Manga Pill */}
                    <motion.button
                      id="category-manga-pill"
                      type="button"
                      onClick={() => {
                        setNewCategory('manga');
                        showToast('Categoría: Manga');
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={starosSpring}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                        newCategory === 'manga'
                          ? (isLight 
                              ? "bg-emerald-500/20 border-emerald-600 text-emerald-900 shadow-sm ring-1 ring-emerald-500/30" 
                              : "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]")
                          : (isLight 
                              ? "bg-black/[0.04] border-black/10 text-neutral-600 hover:text-neutral-900 hover:border-black/20" 
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <BookOpen className={cn("w-3.5 h-3.5 shrink-0", newCategory === 'manga' ? (isLight ? "text-emerald-700" : "text-emerald-400") : "text-neutral-400")} />
                      <span className="truncate">Manga</span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 hidden sm:inline",
                        newCategory === 'manga'
                          ? (isLight ? "bg-emerald-500/30 border-emerald-600/40 text-emerald-950" : "bg-emerald-500/30 border-emerald-400/40 text-emerald-200")
                          : (isLight ? "bg-black/5 border-black/10 text-neutral-500" : "bg-white/5 border-white/10 text-neutral-500")
                      )}>
                        PDF
                      </span>
                    </motion.button>

                    {/* Video Pill */}
                    <motion.button
                      id="category-video-pill"
                      type="button"
                      onClick={() => {
                        setNewCategory('video');
                        showToast('Categoría: Video');
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={starosSpring}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                        newCategory === 'video'
                          ? (isLight 
                              ? "bg-red-500/20 border-red-600 text-red-900 shadow-sm ring-1 ring-red-500/30" 
                              : "bg-red-500/20 border-red-400 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]")
                          : (isLight 
                              ? "bg-black/[0.04] border-black/10 text-neutral-600 hover:text-neutral-900 hover:border-black/20" 
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <VideoIcon className={cn("w-3.5 h-3.5 shrink-0", newCategory === 'video' ? (isLight ? "text-red-700" : "text-red-400") : "text-neutral-400")} />
                      <span className="truncate">Video</span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 hidden sm:inline",
                        newCategory === 'video'
                          ? (isLight ? "bg-red-500/30 border-red-600/40 text-red-950" : "bg-red-500/30 border-red-400/40 text-red-200")
                          : (isLight ? "bg-black/5 border-black/10 text-neutral-500" : "bg-white/5 border-white/10 text-neutral-500")
                      )}>
                        MP4
                      </span>
                    </motion.button>

                    {/* Imagen Pill */}
                    <motion.button
                      id="category-image-pill"
                      type="button"
                      onClick={() => {
                        setNewCategory('image');
                        showToast('Categoría: Imagen');
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={starosSpring}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                        newCategory === 'image'
                          ? (isLight 
                              ? "bg-blue-500/20 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-500/30" 
                              : "bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]")
                          : (isLight 
                              ? "bg-black/[0.04] border-black/10 text-neutral-600 hover:text-neutral-900 hover:border-black/20" 
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <ImageIcon className={cn("w-3.5 h-3.5 shrink-0", newCategory === 'image' ? (isLight ? "text-blue-700" : "text-blue-400") : "text-neutral-400")} />
                      <span className="truncate">Imagen</span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 hidden sm:inline",
                        newCategory === 'image'
                          ? (isLight ? "bg-blue-500/30 border-blue-600/40 text-blue-950" : "bg-blue-500/30 border-blue-400/40 text-blue-200")
                          : (isLight ? "bg-black/5 border-black/10 text-neutral-500" : "bg-white/5 border-white/10 text-neutral-500")
                      )}>
                        ZIP
                      </span>
                    </motion.button>
                  </div>

                  {/* Detalle contextual compacto de la categoría */}
                  {newCategory === 'manga' && (
                    <div className="p-3 rounded-2xl staros-glass-card border border-emerald-500/25 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-2">
                            <span>{t('smartWaitMode')}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {t('antiCrash')}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 leading-tight">
                            {t('smartWaitModeDesc')}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNewSlowServerMode(prev => !prev)}
                        className={cn(
                          "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          newSlowServerMode ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-white/20"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                            newSlowServerMode ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  )}

                  {newCategory === 'video' && (
                    <div className="p-2.5 rounded-2xl staros-glass-card border border-red-500/25 flex items-center gap-2.5 text-xs text-neutral-300">
                      <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                        <VideoIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs">Video & Audio MP4/MP3</div>
                        <div className="text-[11px] text-neutral-400 leading-tight">Descarga video completo y pista MP3 para reproducir o sincronizar.</div>
                      </div>
                    </div>
                  )}

                  {newCategory === 'image' && (
                    <div className="p-2.5 rounded-2xl staros-glass-card border border-blue-500/25 flex items-center gap-2.5 text-xs text-neutral-300">
                      <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs">Galerías e Imágenes WebP/ZIP</div>
                        <div className="text-[11px] text-neutral-400 leading-tight">Extrae imágenes de alta resolución en empaquetado ZIP o formato WebP.</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MODO DE RASTREO EN DISPOSICIÓN VERTICAL: ÚNICA, SECUENCIAL Y CONTINUA */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-200 tracking-wide flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('trackingMode')}</span>
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {newMode === 'single' ? t('trackOnlyOneSpecified') : newMode === 'sequential' ? t('trackAllOneAfterAnother') : t('trackAllSimultaneously')}
                    </span>
                  </div>

                  {/* Lista vertical de cápsulas delgadas */}
                  <div className="flex flex-col gap-1.5">
                    {/* 1. Modo Única */}
                    <motion.button 
                      id="mode-single-pill"
                      type="button"
                      onClick={() => setNewMode('single')}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={starosSpring}
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none border",
                        newMode === 'single' 
                          ? (isLight
                              ? "bg-emerald-500/20 border-emerald-600 text-emerald-950 shadow-sm ring-1 ring-emerald-500/30"
                              : "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]")
                          : (isLight
                              ? "bg-black/[0.04] border-black/10 text-neutral-700 hover:text-neutral-950 hover:border-black/20"
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ArrowDownToLine className={cn("w-3.5 h-3.5 shrink-0", newMode === 'single' ? (isLight ? "text-emerald-700" : "text-emerald-400") : "text-neutral-400")} />
                        <span className="truncate">{t('modeSingle')}</span>
                        <span className={cn(
                          "text-[10px] font-normal opacity-75 hidden sm:inline truncate",
                          newMode === 'single' ? (isLight ? "text-emerald-900" : "text-emerald-300") : "text-neutral-500"
                        )}>
                          • {t('trackOnlyOneSpecified')}
                        </span>
                      </div>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0 ml-2",
                        newMode === 'single' 
                          ? (isLight ? "bg-emerald-600 ring-2 ring-emerald-500/30" : "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]") 
                          : (isLight ? "bg-neutral-300" : "bg-white/20")
                      )} />
                    </motion.button>

                    {/* 2. Modo Secuencial */}
                    <motion.button 
                      id="mode-sequential-pill"
                      type="button"
                      onClick={() => setNewMode('sequential')}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={starosSpring}
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none border",
                        newMode === 'sequential' 
                          ? (isLight
                              ? "bg-blue-500/20 border-blue-600 text-blue-950 shadow-sm ring-1 ring-blue-500/30"
                              : "bg-blue-500/20 border-blue-400 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]")
                          : (isLight
                              ? "bg-black/[0.04] border-black/10 text-neutral-700 hover:text-neutral-950 hover:border-black/20"
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <List className={cn("w-3.5 h-3.5 shrink-0", newMode === 'sequential' ? (isLight ? "text-blue-700" : "text-blue-400") : "text-neutral-400")} />
                        <span className="truncate">{t('modeSequential')}</span>
                        <span className={cn(
                          "text-[10px] font-normal opacity-75 hidden sm:inline truncate",
                          newMode === 'sequential' ? (isLight ? "text-blue-900" : "text-blue-300") : "text-neutral-500"
                        )}>
                          • {t('trackAllOneAfterAnother')}
                        </span>
                      </div>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0 ml-2",
                        newMode === 'sequential' 
                          ? (isLight ? "bg-blue-600 ring-2 ring-blue-500/30" : "bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)]") 
                          : (isLight ? "bg-neutral-300" : "bg-white/20")
                      )} />
                    </motion.button>

                    {/* 3. Modo Continua */}
                    <motion.button 
                      id="mode-continuous-pill"
                      type="button"
                      onClick={() => setNewMode('continuous')}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={starosSpring}
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none border",
                        newMode === 'continuous' 
                          ? (isLight
                              ? "bg-amber-500/20 border-amber-600 text-amber-950 shadow-sm ring-1 ring-amber-500/30"
                              : "bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]")
                          : (isLight
                              ? "bg-black/[0.04] border-black/10 text-neutral-700 hover:text-neutral-950 hover:border-black/20"
                              : "staros-glass-pill border-white/10 text-neutral-400 hover:text-white hover:border-white/20")
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Zap className={cn("w-3.5 h-3.5 shrink-0", newMode === 'continuous' ? (isLight ? "text-amber-700" : "text-amber-400") : "text-neutral-400")} />
                        <span className="truncate">{t('modeContinuous')}</span>
                        <span className={cn(
                          "text-[10px] font-normal opacity-75 hidden sm:inline truncate",
                          newMode === 'continuous' ? (isLight ? "text-amber-900" : "text-amber-300") : "text-neutral-500"
                        )}>
                          • {t('trackAllSimultaneously')}
                        </span>
                      </div>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0 ml-2",
                        newMode === 'continuous' 
                          ? (isLight ? "bg-amber-600 ring-2 ring-amber-500/30" : "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]") 
                          : (isLight ? "bg-neutral-300" : "bg-white/20")
                      )} />
                    </motion.button>
                  </div>
                </div>

                {/* 5. Bottom Action Controls */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <motion.button 
                    type="button"
                    onClick={closeNewTaskSettings}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    transition={starosSpring}
                    className="px-5 py-2.5 rounded-full staros-glass-pill text-neutral-300 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none"
                  >
                    {t('cancel')}
                  </motion.button>
                  <motion.button 
                    id="submit-new-task-btn"
                    type="button"
                    onClick={addTracker}
                    disabled={!newUrl.trim()}
                    whileHover={!newUrl.trim() ? {} : { scale: 1.04 }}
                    whileTap={!newUrl.trim() ? {} : { scale: 0.96 }}
                    transition={starosSpring}
                    className="px-6 py-2.5 rounded-full text-neutral-950 font-bold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_25px_rgba(16,185,129,0.5)] bg-emerald-400 hover:bg-emerald-300 border border-emerald-300 flex items-center gap-2 select-none"
                  >
                    <Sparkles className="w-4 h-4 text-neutral-950" />
                    <span>{t('addTask')}</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Tracker List */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {trackers.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={starosSpring}
                className="staros-glass-card rounded-3xl p-10 sm:p-14 text-center border-white/[0.18] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.25),0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
                  {t('noActiveTasks')}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300/80 max-w-md mx-auto leading-relaxed">
                  {t('emptyState')}
                </p>
              </motion.div>
            ) : (
              trackers.map((tracker) => (
                <motion.div
                  key={tracker.id}
                  id={`tracker-${tracker.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, height: 0 }}
                  transition={starosSpring}
                  className="staros-glass-card rounded-3xl flex flex-col relative overflow-hidden group shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.25),0_20px_50px_rgba(0,0,0,0.45)] border border-white/[0.18]"
                >
                  <div className="p-4 sm:p-6 flex flex-col gap-6 relative z-10">
                    {/* Dynamic progress bar underneath */}
                    <div 
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all duration-500 ease-out z-0 pointer-events-none opacity-20",
                        tracker.status === 'completed' ? "bg-emerald-500" :
                        tracker.status === 'error' ? "bg-red-500" :
                        tracker.status === 'paused' ? "bg-amber-500" :
                        "bg-emerald-400"
                      )}
                      style={{ width: `${tracker.progress}%` }}
                    />
                    
                    <div className="relative z-10 flex-1 flex flex-col justify-between">
                      {/* Top Bar: Mode, Title, URL and Status Badge */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold tracking-wider uppercase text-neutral-400">
                            {/* Dynamic Category Badge */}
                            {tracker.category === 'video' || tracker.mediaType === 'video' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border inline-flex items-center gap-1 bg-red-500/15 text-red-300 border-red-500/30">
                                <VideoIcon className="w-3 h-3 text-red-400" />
                                <span>{t('categoryVideo')}</span>
                              </span>
                            ) : tracker.category === 'image' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border inline-flex items-center gap-1 bg-blue-500/15 text-blue-300 border-blue-500/30">
                                <ImageIcon className="w-3 h-3 text-blue-400" />
                                <span>{t('categoryImage')}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                                <BookOpen className="w-3 h-3 text-emerald-400" />
                                <span>{t('categoryManga')}</span>
                              </span>
                            )}

                            <span className="flex items-center gap-1.5">
                              {getModeIcon(tracker.mode)}
                              <span>{getModeLabel(tracker.mode)}</span>
                            </span>
                            {tracker.totalChapters && tracker.totalChapters > 1 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-neutral-300 font-mono text-[10px]">
                                {tracker.category === 'video' ? (
                                  <VideoIcon className="w-3 h-3 text-red-400" />
                                ) : tracker.category === 'image' ? (
                                  <ImageIcon className="w-3 h-3 text-blue-400" />
                                ) : (
                                  <BookOpen className="w-3 h-3 text-emerald-400" />
                                )}
                                {tracker.completedChapters || 0} / {tracker.totalChapters}
                              </span>
                            )}
                          </div>
                          
                          {tracker.title && (
                            <div className="text-sm font-semibold text-emerald-400 truncate">
                              {tracker.title}
                            </div>
                          )}

                          {/* Safe Copyable Author without external app redirection */}
                          {tracker.author && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                              <span className="text-neutral-500">{t('authorBy')}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(tracker.author || '', 'Autor')}
                                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors cursor-pointer"
                                title="Copiar nombre del autor"
                              >
                                <span>{tracker.author}</span>
                                <Copy className="w-2.5 h-2.5 opacity-70" />
                              </button>
                            </div>
                          )}

                          {/* URL with clean copy action without opening external app */}
                          <div className="flex items-center gap-2 max-w-full">
                            <h3 
                              className="text-sm sm:text-base font-medium text-white/90 truncate font-mono select-all" 
                              title={tracker.url}
                            >
                              {tracker.url}
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleCopyText(tracker.url, 'Enlace')}
                              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                              title="Copiar URL"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>

                          {tracker.currentChapter && (
                            <div className="text-xs text-neutral-400 font-mono">
                              {tracker.currentChapter}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold tracking-wide border backdrop-blur-md",
                            tracker.status === 'running' ? "bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse" :
                            tracker.status === 'completed' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]" :
                            tracker.status === 'error' ? "bg-red-500/20 text-red-300 border-red-500/30" :
                            tracker.status === 'paused' ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                            "bg-white/10 text-neutral-300 border-white/10"
                          )}>
                            {getStatusLabel(tracker.status)}
                          </span>
                        </div>
                      </div>

                      {/* Stats & Interactive Controls Grid */}
                      <div className="mt-6 flex flex-wrap items-end gap-6 justify-between border-t border-white/5 pt-4">
                        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium">{t('progress')}</div>
                            <div className="text-xl sm:text-2xl font-light text-white font-mono">{Math.round(tracker.progress)}%</div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium">
                              {t('imagesFound')}
                            </div>
                            <div className="text-xl sm:text-2xl font-light text-white font-mono">{getTrackerImageCount(tracker)}</div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium">{t('speed')}</div>
                            <div className="text-xl sm:text-2xl font-light text-white font-mono">{tracker.downloadSpeed}</div>
                          </div>
                          <div className="space-y-0.5 hidden sm:block">
                            <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium">{t('date')}</div>
                            <div className="text-xs font-mono text-neutral-400 mt-1">
                              {new Date(tracker.dateAdded).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}
                            </div>
                          </div>
                        </div>

                        {/* Category-Specific Exporters & View Controls */}
                        {(() => {
                          const isManga = !tracker.category || tracker.category === 'manga';
                          const isVideo = tracker.category === 'video' || tracker.mediaType === 'video' || tracker.mediaType === 'image_with_audio' || (tracker.chapters && tracker.chapters.some(c => c.mediaType === 'image_with_audio' || c.mediaType === 'video'));
                          const isImage = tracker.category === 'image' && !isVideo;
                          const trackerImgs = getTrackerImages(tracker);
                          const totalImgsCount = getTrackerImageCount(tracker);
                          const hasImages = trackerImgs.length > 0 || totalImgsCount > 0;
                          const failedChaptersCount = (tracker.chapters || []).filter(c => c.status === 'error' || ((!c.images || c.images.length === 0) && c.status !== 'downloading' && c.status !== 'pending' && tracker.status === 'completed')).length;

                          return (
                            <div className="flex flex-wrap items-center gap-3 ml-auto">
                              {/* RECOVERY BUTTON FOR FAILED CHAPTERS */}
                              {isManga && failedChaptersCount > 0 && (
                                <motion.button
                                  type="button"
                                  onClick={() => handleRetryFailedChapters(tracker)}
                                  disabled={isBatchDownloading[tracker.id]}
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={starosSpring}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all cursor-pointer animate-pulse"
                                  title="Reintentar capítulos que no respondieron a tiempo usando el Modo Espera"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                  <span>Reintentar {failedChaptersCount} Rotos (Modo Espera)</span>
                                </motion.button>
                              )}

                              {/* SLOW SERVER MODE TOGGLE BUTTON */}
                              {isManga && (
                                <motion.button
                                  type="button"
                                  onClick={() => toggleSlowServerMode(tracker.id)}
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={starosSpring}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer staros-glass-pill",
                                    tracker.slowServerMode ?? true
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                                      : "bg-white/5 text-neutral-400 border-white/10 hover:text-white"
                                  )}
                                  title="El Modo Espera previene errores reintentando con pausas cuando el servidor del manga está lento"
                                >
                                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="hidden sm:inline">Modo Espera:</span>
                                  <span className={cn("font-bold font-mono text-[11px]", (tracker.slowServerMode ?? true) ? "text-emerald-400" : "text-neutral-400")}>
                                    {(tracker.slowServerMode ?? true) ? 'ACTIVO' : 'OFF'}
                                  </span>
                                </motion.button>
                              )}

                              {/* 1. MANGA EXPORTERS (PDF pdf-lib, PDF img2pdf, ZIP, CBZ) */}
                              {isManga && (hasImages || tracker.status === 'completed') && (
                                <div className="relative inline-flex items-center rounded-full staros-glass-pill p-1 border border-emerald-400/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_20px_rgba(0,0,0,0.35)]">
                                  {/* Modo 1: pdf-lib */}
                                  <motion.button
                                    id={`export-pdflib-${tracker.id}`}
                                    onClick={() => handleExportPdf(tracker, 'pdflib')}
                                    disabled={generatingPdf?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingPdf?.id === tracker.id && generatingPdf.engine === 'pdflib'
                                        ? "bg-emerald-400 text-neutral-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                                        : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                    )}
                                    title={t('pdfLibDescription')}
                                  >
                                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>
                                      {generatingPdf?.id === tracker.id && generatingPdf.engine === 'pdflib' 
                                        ? t('generatingPdfLib') 
                                        : t('exportPdfPdfLib')}
                                    </span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  {/* Modo 2: img2pdf */}
                                  <motion.button
                                    id={`export-img2pdf-${tracker.id}`}
                                    onClick={() => handleExportPdf(tracker, 'img2pdf')}
                                    disabled={generatingPdf?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingPdf?.id === tracker.id && generatingPdf.engine === 'img2pdf'
                                        ? "bg-emerald-400 text-neutral-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                                        : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                    )}
                                    title={t('img2PdfDescription')}
                                  >
                                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>
                                      {generatingPdf?.id === tracker.id && generatingPdf.engine === 'img2pdf' 
                                        ? t('generatingImg2Pdf') 
                                        : t('exportPdfImg2Pdf')}
                                    </span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  {/* ZIP */}
                                  <motion.button
                                    id={`export-zip-${tracker.id}`}
                                    onClick={() => handleExportImagePackage(tracker, 'original', 'zip')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingExport?.id === tracker.id && generatingExport.type === 'zip_original'
                                        ? "bg-emerald-400 text-neutral-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                                        : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                    )}
                                    title={t('exportImageZip')}
                                  >
                                    <Archive className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>ZIP</span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  {/* CBZ */}
                                  <motion.button
                                    id={`export-cbz-${tracker.id}`}
                                    onClick={() => handleExportImagePackage(tracker, 'original', 'cbz')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingExport?.id === tracker.id && generatingExport.type === 'cbz_original'
                                        ? "bg-emerald-400 text-neutral-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                                        : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                    )}
                                    title={t('exportImageCbz')}
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>CBZ</span>
                                  </motion.button>
                                </div>
                              )}

                              {/* 2. VIDEO EXPORTERS (MP4, MP3, VINCULAR AUDIO) */}
                              {(isVideo || tracker.url?.includes('instagram.com') || tracker.url?.includes('instagr.am') || tracker.audioUrl) && (
                                <div className="relative inline-flex items-center rounded-full staros-glass-pill p-1 border border-red-400/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_20px_rgba(0,0,0,0.35)]">
                                  <motion.button
                                    id={`export-video-mp4-${tracker.id}`}
                                    onClick={() => handleExportVideo(tracker, 'mp4')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingExport?.id === tracker.id && generatingExport.type === 'mp4'
                                        ? "bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"
                                        : "text-red-300 hover:bg-red-500/20 hover:text-white"
                                    )}
                                    title={t('exportVideoMp4')}
                                  >
                                    <VideoIcon className="w-3.5 h-3.5 text-red-400" />
                                    <span>MP4 Video</span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  <motion.button
                                    id={`export-audio-mp3-${tracker.id}`}
                                    onClick={() => handleExportVideo(tracker, 'mp3')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingExport?.id === tracker.id && generatingExport.type === 'mp3'
                                        ? "bg-red-400 text-neutral-950 font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"
                                        : "text-red-300 hover:bg-red-500/20 hover:text-white"
                                    )}
                                    title={t('exportAudioMp3')}
                                  >
                                    <Music className="w-3.5 h-3.5 text-red-400" />
                                    <span>MP3 Audio</span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  <motion.button
                                    id={`link-audio-${tracker.id}`}
                                    onClick={() => setAudioModalData({ isOpen: true, tracker, chapter: null })}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      tracker.audioUrl
                                        ? "bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                        : "text-amber-300 hover:bg-amber-500/20 hover:text-white"
                                    )}
                                    title="Vincular o buscar pista de audio (MP3 o banda sonora)"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{tracker.audioUrl ? 'Audio OK' : 'Vincular Audio'}</span>
                                  </motion.button>
                                </div>
                              )}

                              {/* 3. IMAGE EXPORTERS (ZIP, WebP, PNG, JPG) */}
                              {isImage && (hasImages || tracker.status === 'completed') && (
                                <div className="relative inline-flex items-center rounded-full staros-glass-pill p-1 border border-blue-400/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_20px_rgba(0,0,0,0.35)]">
                                  <motion.button
                                    id={`export-img-zip-${tracker.id}`}
                                    onClick={() => handleExportImagePackage(tracker, 'original', 'zip')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none",
                                      generatingExport?.id === tracker.id && generatingExport.type === 'zip_original'
                                        ? "bg-blue-500 text-white font-bold shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"
                                        : "text-blue-300 hover:bg-blue-500/20 hover:text-white"
                                    )}
                                    title={t('exportImageZip')}
                                  >
                                    <Archive className="w-3.5 h-3.5 text-blue-400" />
                                    <span>ZIP HD</span>
                                  </motion.button>

                                  <div className="w-px h-4 bg-white/15 mx-0.5" />

                                  <motion.button
                                    id={`export-img-webp-${tracker.id}`}
                                    onClick={() => handleExportImagePackage(tracker, 'webp', 'zip')}
                                    disabled={generatingExport?.id === tracker.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-blue-300 hover:bg-blue-500/20 hover:text-white transition-all cursor-pointer select-none"
                                    title="WebP Package"
                                  >
                                    <span>WebP</span>
                                  </motion.button>
                                </div>
                              )}

                              {/* View Toggle Buttons */}
                              {(hasImages || (tracker.chapters && tracker.chapters.length > 0)) && (
                                <div className="flex staros-glass-pill rounded-full p-1 border border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_6px_20px_rgba(0,0,0,0.35)]">
                                  <motion.button
                                    id={`preview-view-${tracker.id}`}
                                    onClick={() => toggleView(tracker.id, 'preview')}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none",
                                      expandedViews[tracker.id] === 'preview' 
                                        ? "bg-white/25 text-white shadow-inner font-semibold border border-white/30" 
                                        : "text-neutral-300 hover:text-white hover:bg-white/10"
                                    )}
                                  >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    {t('previewView')}
                                  </motion.button>
                                  <motion.button
                                    id={`full-view-${tracker.id}`}
                                    onClick={() => toggleView(tracker.id, 'full')}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none",
                                      expandedViews[tracker.id] === 'full' 
                                        ? "bg-white/25 text-white shadow-inner font-semibold border border-white/30" 
                                        : "text-neutral-300 hover:text-white hover:bg-white/10"
                                    )}
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    {t('fullView')}
                                  </motion.button>
                                </div>
                              )}

                              {/* Standard Controls: Custom Batch Panel (Manga only) / Play / Pause / Restart / Stop / Delete */}
                              <div className="flex items-center gap-1.5 staros-glass-pill p-1 rounded-full border border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_6px_20px_rgba(0,0,0,0.35)]">
                                {/* Custom Download & Selection Sub-Panel Toggle Button ONLY for Manga */}
                                {isManga && (
                                  <motion.button 
                                    onClick={() => toggleCustomPanel(tracker.id)} 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.88 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "p-1.5 rounded-full transition-all cursor-pointer relative select-none",
                                      openCustomPanels[tracker.id]
                                        ? "bg-emerald-400 text-neutral-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                                        : Object.values(selectedChapters[tracker.id] || {}).some(Boolean)
                                        ? "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/50 hover:bg-emerald-500/35 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        : "hover:bg-white/15 text-neutral-300 hover:text-white"
                                    )}
                                    title={t('manageSelectionAndDownload')}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    {Object.values(selectedChapters[tracker.id] || {}).filter(Boolean).length > 0 && (
                                      <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-bold flex items-center justify-center font-mono shadow">
                                        {Object.values(selectedChapters[tracker.id] || {}).filter(Boolean).length}
                                      </span>
                                    )}
                                  </motion.button>
                                )}

                                {tracker.status === 'completed' && (
                                  <motion.button 
                                    onClick={() => restartTracker(tracker.id)} 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.88 }}
                                    transition={starosSpring}
                                    className="p-1.5 rounded-full hover:bg-white/15 text-neutral-300 hover:text-white transition-colors cursor-pointer select-none" 
                                    title={t('restart')}
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </motion.button>
                                )}
                                {tracker.status !== 'running' && tracker.status !== 'completed' && (
                                  <motion.button 
                                    onClick={() => resumeTracker(tracker.id)} 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.88 }}
                                    transition={starosSpring}
                                    className="p-1.5 rounded-full hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer select-none"
                                    title={t('resume')}
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </motion.button>
                                )}
                                {tracker.status === 'running' && (
                                  <motion.button 
                                    onClick={() => pauseTracker(tracker.id)} 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.88 }}
                                    transition={starosSpring}
                                    className="p-1.5 rounded-full hover:bg-amber-500/20 text-amber-400 transition-colors cursor-pointer select-none"
                                    title={t('pause')}
                                  >
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                  </motion.button>
                                )}
                                {(tracker.status === 'running' || tracker.status === 'paused') && (
                                  <motion.button 
                                    onClick={() => stopTracker(tracker.id)} 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.88 }}
                                    transition={starosSpring}
                                    className="p-1.5 rounded-full hover:bg-white/15 text-neutral-300 hover:text-white transition-colors cursor-pointer select-none"
                                    title={t('stop')}
                                  >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                  </motion.button>
                                )}
                                <motion.button 
                                  onClick={() => removeTracker(tracker.id)} 
                                  whileHover={{ scale: 1.15 }}
                                  whileTap={{ scale: 0.88 }}
                                  transition={starosSpring}
                                  className="p-1.5 rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer select-none"
                                  title={t('delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* SUB-PANEL INTERMEDIO: ADMINISTRADOR DE DESCARGA Y SELECCIÓN PARA MANGA SOLAMENTE */}
                  <AnimatePresence>
                    {(!tracker.category || tracker.category === 'manga') && openCustomPanels[tracker.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={starosSpring}
                        className="border-t border-white/10 staros-glass overflow-hidden shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.15)]"
                      >
                        <div className="p-4 sm:p-5 space-y-4">
                          {/* Sub-Panel Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                <SlidersHorizontal className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-white tracking-wide">
                                    {t('customDownload')} (Manga)
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono staros-glass-pill text-emerald-300 border border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                    {Object.values(selectedChapters[tracker.id] || {}).filter(Boolean).length} / {tracker.chapters?.length || 1} {t('selectedCount')}
                                  </span>
                                </div>
                                <p className="text-[11px] text-neutral-400">
                                  {t('batchDownloadDescription')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Bulk selection shortcuts */}
                              <div className="flex items-center gap-1.5 staros-glass-pill p-1 rounded-full border border-white/15">
                                <motion.button
                                  type="button"
                                  onClick={() => selectAllInTracker(tracker)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={starosSpring}
                                  className="px-3 py-1 rounded-full text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer select-none"
                                >
                                  {t('selectAll')}
                                </motion.button>
                                <motion.button
                                  type="button"
                                  onClick={() => deselectAllInTracker(tracker)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={starosSpring}
                                  className="px-3 py-1 rounded-full text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer select-none"
                                >
                                  {t('deselectAll')}
                                </motion.button>
                                <motion.button
                                  type="button"
                                  onClick={() => invertSelectionInTracker(tracker)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={starosSpring}
                                  className="px-3 py-1 rounded-full text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer select-none"
                                >
                                  {t('invertSelection')}
                                </motion.button>
                              </div>

                              <motion.button
                                type="button"
                                onClick={() => toggleCustomPanel(tracker.id)}
                                whileHover={{ scale: 1.12 }}
                                whileTap={{ scale: 0.9 }}
                                transition={starosSpring}
                                className="p-1.5 rounded-full staros-glass-pill text-neutral-400 hover:text-white hover:bg-white/15 transition-colors cursor-pointer ml-1 select-none"
                                title={t('closeSelectionPanel')}
                              >
                                <X className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </div>

                          {/* Presets Grid for Manga Chapters */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Primeros a la vez */}
                            <div className="p-3.5 rounded-2xl staros-glass-card space-y-2">
                              <div className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                <span>{t('firstN')} {t('atOnce')}:</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {[10, 20, 30, 40, 50].map((qty) => (
                                  <motion.button
                                    key={`first-${qty}`}
                                    type="button"
                                    onClick={() => selectFirstNChapters(tracker, qty)}
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                    transition={starosSpring}
                                    className="px-2.5 py-1 rounded-full text-xs font-mono staros-glass-pill text-neutral-300 hover:text-emerald-300 hover:border-emerald-400/50 transition-all cursor-pointer select-none"
                                  >
                                    {qty}
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            {/* Últimos a la vez */}
                            <div className="p-3.5 rounded-2xl staros-glass-card space-y-2">
                              <div className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                                <span>{t('lastN')} {t('atOnce')}:</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {[10, 20, 30, 40, 50].map((qty) => (
                                  <motion.button
                                    key={`last-${qty}`}
                                    type="button"
                                    onClick={() => selectLastNChapters(tracker, qty)}
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                    transition={starosSpring}
                                    className="px-2.5 py-1 rounded-full text-xs font-mono staros-glass-pill text-neutral-300 hover:text-blue-300 hover:border-blue-400/50 transition-all cursor-pointer select-none"
                                  >
                                    {qty}
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            {/* Cantidad Personalizada */}
                            <div className="p-3.5 rounded-2xl staros-glass-card space-y-2">
                              <div className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                                <span>{t('enterQuantity')}:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={tracker.chapters?.length || 100}
                                  value={customQty[tracker.id] ?? '15'}
                                  onChange={(e) => setCustomQty(prev => ({ ...prev, [tracker.id]: e.target.value }))}
                                  placeholder="15"
                                  className="w-16 bg-white/10 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-emerald-400 shadow-inner"
                                />
                                <div className="flex rounded-full overflow-hidden border border-white/15 staros-glass-pill p-0.5">
                                  <motion.button
                                    type="button"
                                    onClick={() => setCustomDir(prev => ({ ...prev, [tracker.id]: 'first' }))}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none",
                                      (customDir[tracker.id] ?? 'first') === 'first'
                                        ? "bg-emerald-500/30 text-emerald-300 font-bold shadow-sm"
                                        : "text-neutral-400 hover:text-white"
                                    )}
                                  >
                                    {t('firstN')}
                                  </motion.button>
                                  <motion.button
                                    type="button"
                                    onClick={() => setCustomDir(prev => ({ ...prev, [tracker.id]: 'last' }))}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={starosSpring}
                                    className={cn(
                                      "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none",
                                      customDir[tracker.id] === 'last'
                                        ? "bg-blue-500/30 text-blue-300 font-bold shadow-sm"
                                        : "text-neutral-400 hover:text-white"
                                    )}
                                  >
                                    {t('lastN')}
                                  </motion.button>
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={() => {
                                    const qty = parseInt(customQty[tracker.id] ?? '15', 10) || 10;
                                    if ((customDir[tracker.id] ?? 'first') === 'first') {
                                      selectFirstNChapters(tracker, qty);
                                    } else {
                                      selectLastNChapters(tracker, qty);
                                    }
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  transition={starosSpring}
                                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all cursor-pointer ml-auto select-none"
                                >
                                  {t('apply')}
                                </motion.button>
                              </div>
                            </div>
                          </div>

                          {/* Action Executions for Selected Manga Chapters */}
                          <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-white/10">
                            {/* 1. Download Selected Chapters */}
                            <motion.button
                              type="button"
                              onClick={() => handleDownloadSelectedChapters(tracker)}
                              disabled={isBatchDownloading[tracker.id] || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={!Object.values(selectedChapters[tracker.id] || {}).some(Boolean) ? {} : { scale: 1.04 }}
                              whileTap={!Object.values(selectedChapters[tracker.id] || {}).some(Boolean) ? {} : { scale: 0.95 }}
                              transition={starosSpring}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-lg select-none",
                                !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)
                                  ? "bg-white/5 text-neutral-500 border-white/5 cursor-not-allowed"
                                  : isBatchDownloading[tracker.id]
                                  ? "bg-emerald-400 text-neutral-950 border-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.5)] animate-pulse"
                                  : "bg-emerald-400 text-neutral-950 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:brightness-110"
                              )}
                            >
                              <DownloadCloud className={cn("w-4 h-4", isBatchDownloading[tracker.id] && "animate-bounce")} />
                              <span>
                                {isBatchDownloading[tracker.id]
                                  ? t('downloading')
                                  : `${t('downloadSelected')} (${Object.values(selectedChapters[tracker.id] || {}).filter(Boolean).length})`}
                              </span>
                            </motion.button>

                            {/* 2. Combined Volume PDF (pdf-lib) */}
                            <motion.button
                              type="button"
                              onClick={() => handleExportSelectedCombined(tracker, 'pdflib')}
                              disabled={generatingPdf?.id === tracker.id || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              transition={starosSpring}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold staros-glass-pill text-white border border-white/15 hover:border-emerald-400/40 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            >
                              <FileText className="w-4 h-4 text-emerald-400" />
                              <span>{t('exportSelectedPdfLib')}</span>
                            </motion.button>

                            {/* 3. Combined Volume PDF (img2pdf) */}
                            <motion.button
                              type="button"
                              onClick={() => handleExportSelectedCombined(tracker, 'img2pdf')}
                              disabled={generatingPdf?.id === tracker.id || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              transition={starosSpring}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold staros-glass-pill text-white border border-white/15 hover:border-emerald-400/40 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            >
                              <Layers className="w-4 h-4 text-emerald-400" />
                              <span>{t('exportSelectedImg2Pdf')}</span>
                            </motion.button>

                            {/* 4. Export Selected as ZIP Bundle */}
                            <motion.button
                              type="button"
                              onClick={async () => {
                                const trackerSel = selectedChapters[tracker.id] || {};
                                const selectedChapterList = (tracker.chapters || []).filter(ch => trackerSel[ch.id]);
                                const combinedImages: string[] = [];
                                selectedChapterList.forEach(ch => {
                                  if (ch.images) combinedImages.push(...ch.images);
                                });
                                if (combinedImages.length === 0) {
                                  showToast('No hay páginas descargadas en los capítulos seleccionados');
                                  return;
                                }
                                await handleExportImagePackage(tracker, 'original', 'zip', combinedImages, `${tracker.title || 'manga'}_seleccion_zip`);
                              }}
                              disabled={generatingExport?.id === tracker.id || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              transition={starosSpring}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold staros-glass-pill text-white border border-white/15 hover:border-emerald-400/40 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            >
                              <Archive className="w-4 h-4 text-emerald-400" />
                              <span>ZIP Selección</span>
                            </motion.button>

                            {/* 5. Export Selected as CBZ Comic Bundle */}
                            <motion.button
                              type="button"
                              onClick={async () => {
                                const trackerSel = selectedChapters[tracker.id] || {};
                                const selectedChapterList = (tracker.chapters || []).filter(ch => trackerSel[ch.id]);
                                const combinedImages: string[] = [];
                                selectedChapterList.forEach(ch => {
                                  if (ch.images) combinedImages.push(...ch.images);
                                });
                                if (combinedImages.length === 0) {
                                  showToast('No hay páginas descargadas en los capítulos seleccionados');
                                  return;
                                }
                                await handleExportImagePackage(tracker, 'original', 'cbz', combinedImages, `${tracker.title || 'manga'}_seleccion_cbz`);
                              }}
                              disabled={generatingExport?.id === tracker.id || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              transition={starosSpring}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold staros-glass-pill text-white border border-white/15 hover:border-emerald-400/40 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            >
                              <BookOpen className="w-4 h-4 text-emerald-400" />
                              <span>CBZ Selección</span>
                            </motion.button>

                            {/* 6. Individual Separate Chapter PDFs */}
                            <motion.button
                              type="button"
                              onClick={() => handleExportSelectedIndividual(tracker, 'img2pdf')}
                              disabled={generatingPdf?.id === tracker.id || !Object.values(selectedChapters[tracker.id] || {}).some(Boolean)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              transition={starosSpring}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold staros-glass-pill text-emerald-300 border border-emerald-400/40 hover:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                              title={t('exportIndividualPdfs')}
                            >
                              <FolderDown className="w-4 h-4 text-emerald-400" />
                              <span>{t('exportIndividualPdfs')}</span>
                            </motion.button>

                            {/* 7. Reintentar Rotos en Sub-panel */}
                            {((tracker.chapters || []).some(c => c.status === 'error' || ((!c.images || c.images.length === 0) && c.status !== 'downloading' && c.status !== 'pending' && tracker.status === 'completed'))) && (
                              <motion.button
                                type="button"
                                onClick={() => handleRetryFailedChapters(tracker)}
                                disabled={isBatchDownloading[tracker.id]}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.95 }}
                                transition={starosSpring}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.25)] sm:ml-auto select-none"
                              >
                                <RotateCw className="w-4 h-4" />
                                <span>Reintentar Capítulos Rotos (Modo Espera)</span>
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded Gallery / Full-View Drawer: CHAPTER ORDERED VERTICAL SCROLL */}
                  <AnimatePresence>
                    {expandedViews[tracker.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="border-t border-white/10 staros-glass"
                      >
                        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                          {(() => {
                            const displayChapters: ChapterInfo[] = (tracker.chapters && tracker.chapters.length > 0)
                              ? tracker.chapters
                              : [{
                                  id: 1,
                                  name: t('chapter') + ' 1',
                                  url: tracker.url,
                                  images: tracker.images,
                                  imageCount: tracker.images?.length || 0,
                                  status: tracker.status === 'completed' ? 'completed' : 'downloading'
                                }];

                            return (
                              <div className="space-y-6">
                                {/* Quick Jump Navigator */}
                                {displayChapters.length > 1 && (
                                  <div className="sticky top-0 z-30 pb-3 mb-2 staros-glass-card staros-glass-specular border-b border-white/10 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 space-y-3 shadow-lg">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 max-w-full">
                                        <div className="flex items-center gap-1.5 shrink-0 text-xs text-neutral-300 font-semibold uppercase tracking-wider mr-1">
                                          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>{t('chapters')}:</span>
                                        </div>
                                        {displayChapters.map((ch) => (
                                          <motion.button
                                            key={ch.id}
                                            type="button"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            transition={starosSpring}
                                            onClick={() => {
                                              setCollapsedChapters(prev => ({ ...prev, [`${tracker.id}_${ch.id}`]: false }));
                                              const el = document.getElementById(`chapter-card-${tracker.id}-${ch.id}`);
                                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }}
                                            className={cn(
                                              "px-3 py-1 rounded-full text-xs font-mono shrink-0 transition-all border cursor-pointer select-none staros-glass-pill",
                                              ch.status === 'completed'
                                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                                : ch.status === 'downloading'
                                                ? "bg-blue-500/20 text-blue-300 border-blue-400/40 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                                                : "text-neutral-300 border-white/10 hover:text-white hover:bg-white/10"
                                            )}
                                          >
                                            {ch.name} {ch.images && ch.images.length > 0 ? `(${ch.images.length})` : ''}
                                          </motion.button>
                                        ))}
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                                        <motion.button
                                          type="button"
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          transition={starosSpring}
                                          onClick={() => toggleCustomPanel(tracker.id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 rounded-full staros-glass-pill border border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all cursor-pointer select-none"
                                        >
                                          <SlidersHorizontal className="w-3.5 h-3.5" />
                                          <span>{t('customDownload')}</span>
                                        </motion.button>
                                        <motion.button
                                          type="button"
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          transition={starosSpring}
                                          onClick={() => toggleCollapseAll(tracker, true)}
                                          className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white rounded-full staros-glass-pill transition-colors cursor-pointer border border-white/10 select-none"
                                        >
                                          {t('collapseAll')}
                                        </motion.button>
                                        <motion.button
                                          type="button"
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          transition={starosSpring}
                                          onClick={() => toggleCollapseAll(tracker, false)}
                                          className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white rounded-full staros-glass-pill transition-colors cursor-pointer border border-white/10 select-none"
                                        >
                                          {t('expandAll')}
                                        </motion.button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* VERTICAL CHAPTER SCROLL */}
                                 <div className="space-y-6">
                                  {displayChapters.map((chapter) => {
                                    const isCollapsed = collapsedChapters[`${tracker.id}_${chapter.id}`] ?? true;
                                    const isSelected = !!selectedChapters[tracker.id]?.[chapter.id];
                                    const chapterImages = chapter.images || [];

                                    const isChapterVideo = tracker.category === 'video' || tracker.mediaType === 'video' || chapter.mediaType === 'video' || chapter.mediaType === 'image_with_audio' || tracker.mediaType === 'image_with_audio' || !!chapter.videoUrl || !!tracker.videoUrl;
                                    const isChapterImage = (tracker.category === 'image' || chapter.mediaType === 'image') && !isChapterVideo;
                                    const isChapterManga = !isChapterVideo && !isChapterImage && (!tracker.category || tracker.category === 'manga');

                                    return (
                                      <div 
                                        key={chapter.id} 
                                        id={`chapter-card-${tracker.id}-${chapter.id}`}
                                        className={cn(
                                          "rounded-3xl border transition-all shadow-xl overflow-hidden staros-glass-card",
                                          isSelected
                                            ? "border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                            : "border-white/15"
                                        )}
                                      >
                                        {/* Chapter Header Card */}
                                        <div className="p-3.5 sm:p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 staros-glass-specular">
                                          <div className="flex items-center gap-3 min-w-0">
                                            {/* CHECKBOX SELECTION BUTTON */}
                                            <motion.button
                                              type="button"
                                              whileHover={{ scale: 1.1 }}
                                              whileTap={{ scale: 0.9 }}
                                              transition={starosSpring}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleChapterSelect(tracker.id, chapter.id);
                                              }}
                                              className={cn(
                                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border shrink-0 select-none",
                                                isSelected
                                                  ? "bg-emerald-400 border-emerald-300 text-neutral-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                                                  : "staros-glass-pill border-white/25 text-transparent hover:border-white/50"
                                              )}
                                              title={isSelected ? t('deselectAll') : t('apply')}
                                            >
                                              <Check className={cn("w-3.5 h-3.5 stroke-[3]", isSelected ? "text-neutral-950" : "text-transparent")} />
                                            </motion.button>

                                            <div className={cn(
                                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                                              isChapterVideo
                                                ? "bg-red-500/15 border-red-400/30 text-red-400"
                                                : isChapterImage
                                                ? "bg-blue-500/15 border-blue-400/30 text-blue-400"
                                                : "bg-emerald-500/15 border-emerald-400/30 text-emerald-400"
                                            )}>
                                              {isChapterVideo ? (
                                                <VideoIcon className="w-4 h-4" />
                                              ) : isChapterImage ? (
                                                <ImageIcon className="w-4 h-4" />
                                              ) : (
                                                <BookOpen className="w-4 h-4" />
                                              )}
                                            </div>
                                             <div className="min-w-0">
                                              <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                                                <span className="truncate">{chapter.name}</span>
                                                {chapter.status === 'downloading' && (
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse font-mono">
                                                    {chapter.errorMsg || t('downloading')}
                                                  </span>
                                                )}
                                                {chapter.status === 'completed' && (
                                                  <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-mono border",
                                                    isChapterVideo 
                                                      ? "bg-red-500/20 text-red-300 border-red-500/30" 
                                                      : isChapterImage 
                                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30" 
                                                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                                  )}>
                                                    {isChapterVideo 
                                                      ? 'Video HD' 
                                                      : isChapterImage 
                                                      ? `${chapterImages.length} ${chapterImages.length === 1 ? 'imagen' : 'imágenes'}` 
                                                      : `${chapterImages.length} ${t('pages')}`}
                                                  </span>
                                                )}
                                                {chapter.status === 'pending' && (
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-neutral-400 border border-white/10 font-mono">
                                                    {t('pending')}
                                                  </span>
                                                )}
                                                {chapter.status === 'error' && (
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 font-mono flex items-center gap-1">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                    <span>Servidor lento / Reintentar</span>
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[11px] text-neutral-400 font-mono truncate max-w-xs sm:max-w-md mt-0.5">
                                                {chapter.url}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Chapter Specific Actions / Capsules */}
                                          <div className="flex items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
                                            {/* A. CATEGORÍA MANGA: Opciones pdf-lib, img2pdf, zip, cbz + icono desplegar/minimizar integrado */}
                                            {isChapterManga && (
                                              <>
                                                {chapterImages.length > 0 ? (
                                                  <div className="inline-flex items-center rounded-full bg-emerald-950/40 p-0.5 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleExportPdf(
                                                        tracker, 
                                                        'pdflib', 
                                                        chapterImages, 
                                                        `${tracker.title || 'manga'}_${chapter.name}`,
                                                        chapter.id
                                                      )}
                                                      disabled={generatingPdf?.id === tracker.id && generatingPdf?.chapterId === chapter.id}
                                                      className={cn(
                                                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer",
                                                        generatingPdf?.id === tracker.id && generatingPdf?.chapterId === chapter.id && generatingPdf.engine === 'pdflib'
                                                          ? "bg-emerald-500 text-black font-bold animate-pulse"
                                                          : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                                      )}
                                                      title="PDF Vector Stream"
                                                    >
                                                      <FileText className="w-3 h-3 text-emerald-400" />
                                                      <span>pdf-lib</span>
                                                    </button>
                                                    <div className="w-px h-3 bg-emerald-500/20" />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleExportPdf(
                                                        tracker, 
                                                        'img2pdf', 
                                                        chapterImages, 
                                                        `${tracker.title || 'manga'}_${chapter.name}`,
                                                        chapter.id
                                                      )}
                                                      disabled={generatingPdf?.id === tracker.id && generatingPdf?.chapterId === chapter.id}
                                                      className={cn(
                                                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer",
                                                        generatingPdf?.id === tracker.id && generatingPdf?.chapterId === chapter.id && generatingPdf.engine === 'img2pdf'
                                                          ? "bg-emerald-400 text-black font-bold animate-pulse"
                                                          : "text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                                                      )}
                                                      title="PDF 1:1 Image Package"
                                                    >
                                                      <Layers className="w-3 h-3 text-emerald-400" />
                                                      <span>img2pdf</span>
                                                    </button>
                                                    <div className="w-px h-3 bg-emerald-500/20" />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleExportImagePackage(
                                                        tracker,
                                                        'original',
                                                        'zip',
                                                        chapterImages,
                                                        `${tracker.title || 'manga'}_${chapter.name}`,
                                                        chapter.id
                                                      )}
                                                      disabled={generatingExport?.id === tracker.id && generatingExport?.chapterId === chapter.id}
                                                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-all cursor-pointer"
                                                      title="ZIP HD Original"
                                                    >
                                                      <Archive className="w-3 h-3 text-emerald-400" />
                                                      <span>ZIP</span>
                                                    </button>
                                                    <div className="w-px h-3 bg-emerald-500/20" />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleExportImagePackage(
                                                        tracker,
                                                        'original',
                                                        'cbz',
                                                        chapterImages,
                                                        `${tracker.title || 'manga'}_${chapter.name}`,
                                                        chapter.id
                                                      )}
                                                      disabled={generatingExport?.id === tracker.id && generatingExport?.chapterId === chapter.id}
                                                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-all cursor-pointer"
                                                      title="CBZ Lector de Comic"
                                                    >
                                                      <BookOpen className="w-3 h-3 text-emerald-400" />
                                                      <span>CBZ</span>
                                                    </button>
                                                    <div className="w-px h-3 bg-emerald-500/20" />
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleChapterCollapse(tracker.id, chapter.id)}
                                                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-all cursor-pointer"
                                                      title={isCollapsed ? t('expand') : t('collapse')}
                                                    >
                                                      <span className="hidden sm:inline">{isCollapsed ? 'Desplegar' : 'Minimizar'}</span>
                                                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <motion.button
                                                    type="button"
                                                    onClick={() => toggleChapterCollapse(tracker.id, chapter.id)}
                                                    whileHover={{ scale: 1.01 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    transition={starosSpring}
                                                    className={cn(
                                                      "w-full sm:w-auto sm:min-w-[240px] flex items-center justify-between gap-3 py-1.5 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                                                      isCollapsed
                                                        ? "staros-glass-pill border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                                                        : "bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                    )}
                                                  >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                      <span className="truncate">{isCollapsed ? 'Desplegar Capítulo' : 'Minimizar Capítulo'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 text-xs font-medium pl-2 border-l border-emerald-500/20">
                                                      <span className="text-[11px] hidden sm:inline">{isCollapsed ? 'Desplegar' : 'Minimizar'}</span>
                                                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronUp className="w-4 h-4 text-emerald-400" />}
                                                    </div>
                                                  </motion.button>
                                                )}
                                              </>
                                            )}

                                            {/* B. CATEGORÍA VIDEO: CÁPSULA ÚNICA LARGA Y DELGADA CON ICONO DE DESPLEGAR Y MINIMIZAR */}
                                            {isChapterVideo && (
                                              <motion.button
                                                type="button"
                                                onClick={() => toggleChapterCollapse(tracker.id, chapter.id)}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={starosSpring}
                                                className={cn(
                                                  "w-full sm:w-auto sm:min-w-[280px] flex items-center justify-between gap-3 py-1.5 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                                                  isCollapsed
                                                    ? (isLight
                                                        ? "bg-red-500/10 border-red-600/25 text-red-900 hover:bg-red-500/20 shadow-sm"
                                                        : "staros-glass-pill border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]")
                                                    : (isLight
                                                        ? "bg-red-500/20 border-red-600/40 text-red-950 shadow-inner"
                                                        : "bg-red-500/25 border-red-400/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]")
                                                )}
                                                title={isCollapsed ? 'Desplegar reproductor de video' : 'Minimizar reproductor de video'}
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <VideoIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                                  <span className="truncate">
                                                    {isCollapsed ? 'Desplegar Video y Reproductor' : 'Minimizar Reproductor de Video'}
                                                  </span>
                                                  {chapter.videoUrl && (
                                                    <span className="text-[10px] font-mono opacity-80 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 hidden sm:inline shrink-0">
                                                      MP4 HD
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium opacity-90 pl-2 border-l border-red-500/20">
                                                  <span className="text-[11px] hidden sm:inline">{isCollapsed ? 'Desplegar' : 'Minimizar'}</span>
                                                  {isCollapsed ? (
                                                    <ChevronDown className="w-4 h-4 text-red-400" />
                                                  ) : (
                                                    <ChevronUp className="w-4 h-4 text-red-400" />
                                                  )}
                                                </div>
                                              </motion.button>
                                            )}

                                            {/* C. CATEGORÍA IMAGEN: CÁPSULA ÚNICA LARGA Y DELGADA CON ICONO DE DESPLEGAR Y MINIMIZAR */}
                                            {isChapterImage && (
                                              <motion.button
                                                type="button"
                                                onClick={() => toggleChapterCollapse(tracker.id, chapter.id)}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={starosSpring}
                                                className={cn(
                                                  "w-full sm:w-auto sm:min-w-[280px] flex items-center justify-between gap-3 py-1.5 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border",
                                                  isCollapsed
                                                    ? (isLight
                                                        ? "bg-blue-500/10 border-blue-600/25 text-blue-900 hover:bg-blue-500/20 shadow-sm"
                                                        : "staros-glass-pill border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.2)]")
                                                    : (isLight
                                                        ? "bg-blue-500/20 border-blue-600/40 text-blue-950 shadow-inner"
                                                        : "bg-blue-500/25 border-blue-400/50 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]")
                                                )}
                                                title={isCollapsed ? 'Desplegar galería de imágenes' : 'Minimizar galería de imágenes'}
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                  <span className="truncate">
                                                    {isCollapsed ? 'Desplegar Galería de Imágenes' : 'Minimizar Galería de Imágenes'}
                                                  </span>
                                                  {chapterImages.length > 0 && (
                                                    <span className="text-[10px] font-mono opacity-80 px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 hidden sm:inline shrink-0">
                                                      {chapterImages.length} {chapterImages.length === 1 ? 'imagen' : 'imágenes'}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium opacity-90 pl-2 border-l border-blue-500/20">
                                                  <span className="text-[11px] hidden sm:inline">{isCollapsed ? 'Desplegar' : 'Minimizar'}</span>
                                                  {isCollapsed ? (
                                                    <ChevronDown className="w-4 h-4 text-blue-400" />
                                                  ) : (
                                                    <ChevronUp className="w-4 h-4 text-blue-400" />
                                                  )}
                                                </div>
                                              </motion.button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Chapter Content / Gallery with direct page download buttons */}
                                        {!isCollapsed && (
                                          <div className="p-4 sm:p-5">
                                            {chapter.status === 'downloading' && chapterImages.length === 0 && !chapter.videoUrl ? (
                                              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                                                <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                                                <p className="text-xs text-neutral-400 font-mono">{t('downloading')}</p>
                                              </div>
                                            ) : chapter.status === 'pending' && chapterImages.length === 0 && !chapter.videoUrl ? (
                                              <div className="py-6 text-center text-xs text-neutral-500 font-mono">
                                                {t('pending')}...
                                              </div>
                                            ) : (chapter.mediaType === 'image_with_audio' || tracker.mediaType === 'image_with_audio' || (chapterImages.length > 0 && (chapter.audioUrl || tracker.chapters?.[0]?.audioUrl))) ? (
                                              <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto py-2">
                                                <div className="w-full relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex flex-col items-center">
                                                  {chapterImages[0] && (
                                                    <div className="relative w-full aspect-square max-h-[420px] bg-neutral-950">
                                                      <Image 
                                                        src={getProxiedImageUrl(chapterImages[0])} 
                                                        alt={chapter.name} 
                                                        fill 
                                                        className="object-contain" 
                                                        referrerPolicy="no-referrer"
                                                        unoptimized
                                                      />
                                                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-lg">
                                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span>{t('imageWithAudio')}</span>
                                                      </div>
                                                    </div>
                                                  )}
                                                  {(chapter.audioUrl || chapter.videoUrl) && (
                                                    <div className="w-full p-3 bg-neutral-900/90 border-t border-white/10 flex items-center gap-3">
                                                      <audio 
                                                        controls 
                                                        src={chapter.audioUrl || chapter.videoUrl} 
                                                        className="w-full h-10"
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleExportVideo(tracker, 'mp4', undefined, `${tracker.title || 'video'}_${chapter.name}`, chapter.id)}
                                                    disabled={generatingExport?.id === tracker.id && generatingExport?.chapterId === chapter.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-lg transition-all cursor-pointer"
                                                  >
                                                    <VideoIcon className="w-3.5 h-3.5" />
                                                    <span>{t('exportImageAudioVideo')}</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleExportVideo(tracker, 'mp3', undefined, `${tracker.title || 'audio'}_${chapter.name}`, chapter.id)}
                                                    disabled={generatingExport?.id === tracker.id && generatingExport?.chapterId === chapter.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-neutral-200 text-xs font-bold shadow-lg transition-all cursor-pointer"
                                                  >
                                                    <Music className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>{t('exportAudioTrack')}</span>
                                                  </button>
                                                  {chapterImages[0] && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDownloadSinglePage(chapterImages[0], 1, `${tracker.title || 'imagen'}_${chapter.name}`)}
                                                      className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-neutral-300 text-xs font-semibold shadow-lg transition-all cursor-pointer"
                                                    >
                                                      <Download className="w-3.5 h-3.5" />
                                                      <span>{t('exportImageOnly')}</span>
                                                    </button>
                                                  )}
                                                  <button
                                                    type="button"
                                                    onClick={() => setAudioModalData({ isOpen: true, tracker, chapter })}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-amber-300 text-xs font-semibold shadow-lg transition-all cursor-pointer"
                                                    title="Vincular o buscar pista de audio"
                                                  >
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                    <span>{chapter.audioUrl ? 'Cambiar Audio' : 'Vincular Audio'}</span>
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (chapter.mediaType === 'video' || tracker.mediaType === 'video' || tracker.category === 'video' || chapter.videoUrl) && (chapter.videoUrl || tracker.videoUrl) ? (
                                              <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto py-2">
                                                <div className="w-full relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                                                  <video 
                                                    controls 
                                                    playsInline
                                                    preload="metadata"
                                                    poster={chapterImages[0] || tracker.images?.[0]}
                                                    src={chapter.videoUrl || tracker.videoUrl}
                                                    className="w-full max-h-[480px] object-contain bg-black"
                                                  />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleExportVideo(tracker, 'mp4', chapter.videoUrl || tracker.videoUrl, `${tracker.title || 'video'}_${chapter.name}`)}
                                                    disabled={generatingExport?.id === tracker.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
                                                  >
                                                    <VideoIcon className="w-3.5 h-3.5" />
                                                    <span>{generatingExport?.id === tracker.id ? 'Descargando...' : 'Descargar MP4 HD'}</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleExportVideo(tracker, 'mp3', chapter.videoUrl || tracker.videoUrl, `${tracker.title || 'audio'}_${chapter.name}`)}
                                                    disabled={generatingExport?.id === tracker.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-neutral-200 text-xs font-bold shadow-lg transition-all cursor-pointer"
                                                  >
                                                    <Music className="w-3.5 h-3.5 text-red-400" />
                                                    <span>Extraer MP3</span>
                                                  </button>
                                                </div>
                                              </div>
                                            ) : chapterImages.length > 0 ? (
                                              expandedViews[tracker.id] === 'preview' ? (
                                                /* PREVIEW MODE: Chapter Thumbnail Grid with Single Image Download */
                                                <div className="space-y-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-900/60 border border-white/5">
                                                    <div className="text-xs text-neutral-400">
                                                      {chapterImages.length} {chapterImages.length === 1 ? 'imagen' : 'páginas / imágenes'}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={() => setAudioModalData({ isOpen: true, tracker, chapter })}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow transition-all cursor-pointer"
                                                      title="Vincular o buscar pista de audio para generar video con audio o MP3"
                                                    >
                                                      <Music className="w-3.5 h-3.5 text-amber-400" />
                                                      <span>{chapter.audioUrl || tracker.audioUrl ? 'Audio Vinculado (Cambiar)' : '🎵 Vincular / Buscar Audio'}</span>
                                                    </button>
                                                  </div>
                                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                  {chapterImages.map((img, pageIdx) => {
                                                    const dlKey = `${img}_${pageIdx + 1}`;
                                                    const isDownloadingThis = downloadingSinglePage === dlKey;

                                                    const proxiedSrc = getProxiedImageUrl(img);
                                                    const isProxied = proxiedSrc !== img;

                                                    return (
                                                      <div 
                                                        key={pageIdx} 
                                                        className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900 border border-white/10 group shadow-md hover:border-emerald-500/40 transition-all"
                                                      >
                                                        <Image 
                                                          src={proxiedSrc} 
                                                          alt={`${chapter.name} - ${t('pageNumber')} ${pageIdx + 1}`} 
                                                          fill
                                                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                          referrerPolicy="no-referrer"
                                                          sizes="(max-width: 768px) 50vw, 20vw"
                                                          loading="lazy"
                                                          unoptimized={isProxied}
                                                        />
                                                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white/90 border border-white/10">
                                                          {pageIdx + 1}
                                                        </div>

                                                        {/* Direct Page Download Button */}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                                          <button
                                                            type="button"
                                                            onClick={() => handleDownloadSinglePage(img, pageIdx + 1, `${tracker.title || 'manga'}_${chapter.name}`)}
                                                            disabled={isDownloadingThis}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 text-black text-xs font-bold shadow-xl hover:bg-emerald-400 transition-all cursor-pointer"
                                                            title="Descargar esta página a tu dispositivo"
                                                          >
                                                            <Download className="w-3.5 h-3.5" />
                                                            <span>{isDownloadingThis ? '...' : 'Descargar'}</span>
                                                          </button>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                  </div>
                                                </div>
                                              ) : (
                                                /* FULL VIEW MODE: Continuous high-res vertical webtoon scroll */
                                                <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto py-2">
                                                  {chapterImages.map((img, pageIdx) => {
                                                    const dlKey = `${img}_${pageIdx + 1}`;
                                                    const isDownloadingThis = downloadingSinglePage === dlKey;

                                                    const proxiedSrc = getProxiedImageUrl(img);
                                                    const isProxied = proxiedSrc !== img;

                                                    return (
                                                      <div 
                                                        key={pageIdx} 
                                                        className="w-full relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl group"
                                                      >
                                                        <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-medium text-white/90 border border-white/15">
                                                          {chapter.name} • {t('pageNumber')} {pageIdx + 1} / {chapterImages.length}
                                                        </div>

                                                        {/* Direct Download Button in Full View */}
                                                        <div className="absolute top-3 right-3 z-10">
                                                          <button
                                                            type="button"
                                                            onClick={() => handleDownloadSinglePage(img, pageIdx + 1, `${tracker.title || 'manga'}_${chapter.name}`)}
                                                            disabled={isDownloadingThis}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-emerald-500 hover:text-black text-emerald-300 text-xs font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
                                                            title="Descargar esta página"
                                                          >
                                                            <Download className="w-3.5 h-3.5" />
                                                            <span>{isDownloadingThis ? 'Descargando...' : 'Descargar Página'}</span>
                                                          </button>
                                                        </div>

                                                        <Image 
                                                          src={proxiedSrc} 
                                                          alt={`${chapter.name} - ${t('pageNumber')} ${pageIdx + 1}`} 
                                                          width={800}
                                                          height={1200}
                                                          className="w-full h-auto object-contain"
                                                          referrerPolicy="no-referrer"
                                                          loading="lazy"
                                                          unoptimized={isProxied}
                                                        />
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )
                                            ) : (
                                              <div className="py-8 px-4 flex flex-col items-center justify-center gap-3 text-center rounded-xl bg-white/[0.02] border border-white/5">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                                  <AlertTriangle className="w-5 h-5" />
                                                </div>
                                                <div className="space-y-1 max-w-md">
                                                  <p className="text-xs font-medium text-white">
                                                    {chapter.errorMsg || t('serverSlowResponse')}
                                                  </p>
                                                  <p className="text-[11px] text-neutral-400">
                                                    {t('retryWithWaitModeHint')}
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRetrySingleChapter(tracker, chapter.id)}
                                                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg transition-all cursor-pointer"
                                                >
                                                  <RotateCw className="w-3.5 h-3.5" />
                                                  <span>{t('retryChapterWaitMode')}</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Subtle bottom padding */}
        <div className="h-8" aria-hidden="true" />
      </div>

      {/* Fixed Floating Lateral Language & Theme Capsule */}
      <LanguageCapsule />

      {/* Inline task settings are integrated directly into the header layout */}

      {/* Audio Link & Search Modal for static images/Instagram tracks */}
      <AudioLinkModal
        isOpen={audioModalData.isOpen}
        onClose={() => setAudioModalData(prev => ({ ...prev, isOpen: false }))}
        tracker={audioModalData.tracker}
        chapter={audioModalData.chapter}
        onAudioAttached={handleUpdateAudio}
      />
    </div>
  );
}
