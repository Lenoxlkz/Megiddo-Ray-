'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Music, Upload, Search, Link as LinkIcon, Check, X, Play, Pause, Trash2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Tracker, ChapterInfo } from '@/types';

interface AudioLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker | null;
  chapter?: ChapterInfo | null;
  onAudioAttached: (trackerId: string, chapterId: string | number | undefined, audioUrl: string, audioTitle?: string) => void;
}

export function AudioLinkModal({
  isOpen,
  onClose,
  tracker,
  chapter,
  onAudioAttached,
}: AudioLinkModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    title: string;
    url: string;
    timestamp: string;
    author: string;
    thumbnail: string;
  }>>([]);
  const [searchError, setSearchError] = useState('');

  const [customUrl, setCustomUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentAudioUrl = chapter?.audioUrl || tracker?.audioUrl;

  const executeSearch = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/search-audio?q=${encodeURIComponent(queryText.trim())}`);
      const data = await res.json();
      if (res.ok && data.results) {
        setSearchResults(data.results);
      } else {
        setSearchError(data.error || 'No se encontraron pistas de audio');
      }
    } catch {
      setSearchError('Error al buscar pistas de audio');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Pre-fill search query from tracker or chapter title
  useEffect(() => {
    if (isOpen && tracker) {
      // Extract possible title/theme from tracker
      let candidate = tracker.title || '';
      if (candidate.toLowerCase().includes('love next door')) {
        candidate = 'Love Next Door OST';
      } else if (candidate.length > 40) {
        candidate = candidate.slice(0, 35) + ' OST';
      } else if (!candidate.toLowerCase().includes('ost') && !candidate.toLowerCase().includes('song')) {
        candidate = `${candidate} OST`.trim();
      }

      const timeoutId = setTimeout(() => {
        setSearchQuery(candidate);
        if (candidate) {
          executeSearch(candidate);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, tracker, executeSearch]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav') && !file.name.endsWith('.m4a')) {
      alert('Por favor selecciona un archivo de audio (MP3, WAV, M4A, AAC)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setUploadedFile({ name: file.name, dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const applyAudio = (audioUrl: string, title?: string) => {
    if (!tracker) return;
    onAudioAttached(tracker.id, chapter?.id, audioUrl, title);
    onClose();
  };

  const removeAudio = () => {
    if (!tracker) return;
    onAudioAttached(tracker.id, chapter?.id, '');
    setUploadedFile(null);
  };

  if (!isOpen || !tracker) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <motion.div 
        id="audio-attachment-modal"
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="w-full max-w-xl staros-glass-card rounded-3xl border border-white/[0.22] shadow-[inset_0_1px_1.5px_0_rgba(255,255,255,0.3),0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] my-auto"
      >
        {/* StarOS Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-4.5 border-b border-white/10 bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">Vincular Pista de Audio</h2>
              <p className="text-[11px] text-neutral-300/80">Sintetiza video MP4 con sonido o extrae MP3 en alta fidelidad</p>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="p-2 rounded-2xl text-neutral-400 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Content Body with Custom Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Technical Info Notice */}
          <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 flex items-start gap-3 text-xs text-neutral-200 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-amber-300">Nota técnica sobre fotos de Instagram: </span>
              Meta reproduce las canciones en fotos fijas mediante catálogo privado protegido y no aloja archivos de audio en servidores públicos. Vincula aquí la canción o banda sonora para generar tu video o descargar el MP3 con 100% de efectividad.
            </div>
          </div>

          {/* Current Audio Status if any */}
          {currentAudioUrl && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/25 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-emerald-300">Audio actualmente vinculado</p>
                  <p className="text-[11px] text-emerald-200/70 truncate">Listo para exportar MP3 o video MP4 con música</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={removeAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-full transition-colors shrink-0 cursor-pointer font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desvincular</span>
              </motion.button>
            </div>
          )}

          {/* StarOS Tab Selector Navigation */}
          <div className="relative flex rounded-2xl bg-white/[0.06] p-1 border border-white/15 text-xs font-medium backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all z-10 cursor-pointer ${
                activeTab === 'search' ? 'text-white font-semibold' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {activeTab === 'search' && (
                <motion.div
                  layoutId="active-audio-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-white/[0.18] border border-white/30 shadow-[0_2px_10px_rgba(0,0,0,0.2)] -z-10"
                />
              )}
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Buscador Inteligente</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all z-10 cursor-pointer ${
                activeTab === 'upload' ? 'text-white font-semibold' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {activeTab === 'upload' && (
                <motion.div
                  layoutId="active-audio-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-white/[0.18] border border-white/30 shadow-[0_2px_10px_rgba(0,0,0,0.2)] -z-10"
                />
              )}
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subir MP3</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all z-10 cursor-pointer ${
                activeTab === 'url' ? 'text-white font-semibold' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {activeTab === 'url' && (
                <motion.div
                  layoutId="active-audio-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-white/[0.18] border border-white/30 shadow-[0_2px_10px_rgba(0,0,0,0.2)] -z-10"
                />
              )}
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pegar Enlace</span>
            </button>
          </div>

          {/* TAB 1: Search */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchQuery)}
                    placeholder="Ej: Love Next Door OST, título o artista..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder:text-neutral-400 text-xs focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 backdrop-blur-md"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => executeSearch(searchQuery)}
                  disabled={isSearching}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.3)] cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'Buscando...' : 'Buscar'}</span>
                </motion.button>
              </div>

              {searchError && (
                <p className="text-xs text-rose-400">{searchError}</p>
              )}

              {/* Search Results */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {searchResults.map((item, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 hover:border-white/20 transition-all gap-3 backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.thumbnail ? (
                        <div className="relative w-12 h-9 rounded-xl overflow-hidden shrink-0 bg-neutral-800 border border-white/10">
                          <Image
                            src={item.thumbnail}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-9 rounded-xl bg-white/10 flex items-center justify-center text-neutral-400 shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className="truncate">
                        <p className="text-xs font-medium text-white truncate">{item.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {item.author} • {item.timestamp}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => applyAudio(item.url, item.title)}
                      className="px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-neutral-950 text-xs font-semibold transition-all flex items-center gap-1 shrink-0 border border-amber-500/30 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Vincular</span>
                    </motion.button>
                  </motion.div>
                ))}
                {searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-6 text-neutral-400 text-xs">
                    Escribe el nombre de la canción o banda sonora y presiona Buscar.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Upload MP3 */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac"
                className="hidden"
                onChange={handleFileUpload}
              />
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-emerald-400/60 rounded-3xl p-6 text-center cursor-pointer transition-all bg-white/[0.04] hover:bg-white/[0.08] group backdrop-blur-md"
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.08] group-hover:bg-emerald-500/20 text-neutral-300 group-hover:text-emerald-300 border border-white/10 flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-white mb-1">
                  Haz clic o arrastra tu archivo de audio aquí
                </p>
                <p className="text-[11px] text-neutral-400">
                  Compatible con MP3, WAV, M4A, AAC (hasta 50 MB)
                </p>
              </motion.div>

              {uploadedFile && (
                <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-white truncate">{uploadedFile.name}</span>
                    </div>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="text-neutral-400 hover:text-rose-400 text-xs cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <audio
                    ref={audioPreviewRef}
                    src={uploadedFile.dataUrl}
                    controls
                    className="w-full h-8"
                  />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => applyAudio(uploadedFile.dataUrl, uploadedFile.name)}
                    className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Usar esta pista de audio</span>
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-300 font-medium">URL de Audio o Video (YouTube, SoundCloud, MP3 directo):</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... o enlace .mp3"
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder:text-neutral-400 text-xs focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 backdrop-blur-md"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      if (customUrl.trim()) {
                        applyAudio(customUrl.trim(), 'Audio Vinculado');
                      }
                    }}
                    disabled={!customUrl.trim()}
                    className="px-4 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition-all shrink-0 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  >
                    Vincular
                  </motion.button>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Al vincular un enlace de YouTube o archivo de audio directo, nuestro motor FFmpeg extraerá la pista a 320kbps MP3 y la combinará con tu imagen al generar el video MP4.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-white/10 bg-white/[0.03] flex items-center justify-end">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-white/10"
          >
            Cerrar
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
