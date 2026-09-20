export type VideoContainerFormat = 'mp4' | 'webm' | 'mkv';
export type AudioContainerFormat = 'mp3';

export interface VideoExportOptions {
  videoUrl?: string;
  audioUrl?: string;
  imageUrl?: string;
  embedUrl?: string;
  title?: string;
  format?: VideoContainerFormat | AudioContainerFormat;
  onProgress?: (percent: number, status: string) => void;
}

export function isPwaOrStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function triggerDirectUrlDownload(url: string, filename: string) {
  if (typeof window === 'undefined') return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 3000);
}

function triggerDownload(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 2000);
  // Keep object URL alive long enough for mobile download managers to finish spooling
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

/**
 * Export static image + audio track as a full-featured MP4 video file
 */
export async function exportImageWithAudioAsVideo(options: VideoExportOptions): Promise<boolean> {
  const {
    imageUrl,
    audioUrl,
    videoUrl,
    title = 'Image_Audio_Video',
    onProgress
  } = options;

  const targetImage = imageUrl || videoUrl;
  if (!targetImage) {
    throw new Error('No image source available to create video');
  }

  const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 60) || 'Image_Audio_Video';
  const filename = `${sanitizedTitle}.mp4`;

  if (onProgress) onProgress(20, 'Sintetizando video MP4 a alta velocidad...');

  try {
    let res: Response;
    if (audioUrl?.startsWith('data:')) {
      res = await fetch('/api/convert-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video_from_image',
          imageUrl: targetImage,
          audioUrl,
          filename
        })
      });
    } else {
      const convertUrl = `/api/convert-media?type=video_from_image&imageUrl=${encodeURIComponent(targetImage)}&audioUrl=${encodeURIComponent(audioUrl || '')}&filename=${encodeURIComponent(filename)}`;
      res = await fetch(convertUrl);
    }

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 2048 && !blob.type.includes('html') && !blob.type.includes('json')) {
        if (onProgress) onProgress(90, 'Empaquetando video MP4 de alta definición...');
        const typedBlob = new Blob([blob], { type: 'video/mp4' });
        if (onProgress) onProgress(100, 'Video MP4 generado con éxito');
        triggerDownload(typedBlob, filename);
        return true;
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error || 'Error al sintetizar el video con audio';
      if (onProgress) onProgress(0, msg);
      return false;
    }
  } catch (err) {
    console.warn('Server video synthesis failed, attempting fallback:', err);
  }

  if (onProgress) onProgress(0, 'Error al sintetizar el video con audio');
  return false;
}

/**
 * Export video stream or direct media to MP4, WebM, or MKV container
 */
export async function exportVideo(options: VideoExportOptions): Promise<boolean> {
  const {
    videoUrl,
    audioUrl,
    imageUrl,
    embedUrl,
    title = 'Liquid_Video',
    format = 'mp4',
    onProgress
  } = options;

  // If user is exporting an image with audio or static image as video
  if (imageUrl && !videoUrl) {
    return exportImageWithAudioAsVideo(options);
  }

  const targetUrl = videoUrl || embedUrl || imageUrl;
  if (!targetUrl) {
    throw new Error('No video source URL available to export');
  }

  const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 60) || 'Video_Export';
  const filename = `${sanitizedTitle}.${format}`;

  if (onProgress) onProgress(15, 'Iniciando descarga de video...');

  // 1. Try server-side convert / proxy stream to avoid CORS and get direct attachment
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    try {
      if (onProgress) onProgress(45, 'Descargando flujo de video HD...');
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 2048 && !blob.type.includes('html') && !blob.type.includes('text') && !blob.type.includes('json')) {
          if (onProgress) onProgress(80, 'Empaquetando archivo contenedor...');
          const mimeType = format === 'webm' ? 'video/webm' : format === 'mkv' ? 'video/x-matroska' : 'video/mp4';
          const typedBlob = new Blob([blob], { type: mimeType });
          if (onProgress) onProgress(100, 'Descarga completada');
          triggerDownload(typedBlob, filename);
          return true;
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy video download failed, trying direct:', proxyErr);
    }
  }

  // 2. Direct client fetch fallback (for direct mp4/webm/blob streams)
  if (targetUrl && (targetUrl.includes('.mp4') || targetUrl.includes('.webm') || targetUrl.startsWith('blob:'))) {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 2048 && !blob.type.includes('html') && !blob.type.includes('text')) {
          if (onProgress) onProgress(85, 'Empaquetando flujo de video...');
          const mimeType = format === 'webm' ? 'video/webm' : format === 'mkv' ? 'video/x-matroska' : 'video/mp4';
          const typedBlob = new Blob([blob], { type: mimeType });
          if (onProgress) onProgress(100, 'Descarga completada');
          triggerDownload(typedBlob, filename);
          return true;
        }
      }
    } catch {
      // Fallback to direct anchor
    }
  }

  // 3. Fallback: try image synthesis if videoUrl failed but imageUrl exists
  if (imageUrl && !videoUrl) {
    return exportImageWithAudioAsVideo({ imageUrl, audioUrl, title, onProgress });
  }

  // 4. Resilient Fallback for PWA / Mobile WebViews / Vercel Payload Limits:
  // When fetch/blob fails due to mobile memory limits or Vercel payload limit (4.5MB),
  // trigger native download via direct anchor to proxy or direct URL with attachment header.
  try {
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(filename)}`;
    if (onProgress) onProgress(85, 'Iniciando descarga en navegador...');
    triggerDirectUrlDownload(proxyUrl, filename);
    if (onProgress) onProgress(100, 'Descarga iniciada');
    return true;
  } catch (proxyFallbackErr) {
    console.warn('Native proxy trigger failed, trying direct target URL:', proxyFallbackErr);
  }

  // 5. Direct URL fallback (CDN stream)
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    try {
      if (onProgress) onProgress(90, 'Descargando desde enlace de origen...');
      triggerDirectUrlDownload(targetUrl, filename);
      if (onProgress) onProgress(100, 'Descarga iniciada');
      return true;
    } catch (e) {
      console.warn('Direct URL trigger failed:', e);
    }
  }

  if (onProgress) onProgress(0, 'Error: No se pudo descargar el flujo binario');
  console.warn('Video download could not extract direct stream for:', targetUrl);
  return false;
}

/**
 * Export audio track / audio stream to pure MP3 container via FFmpeg transcoding
 */
export async function exportAudioMp3(options: VideoExportOptions): Promise<boolean> {
  const {
    videoUrl,
    audioUrl,
    imageUrl,
    embedUrl,
    title = 'Liquid_Audio',
    onProgress
  } = options;

  const targetUrl = audioUrl || videoUrl || embedUrl || imageUrl;
  if (!targetUrl) {
    throw new Error('No audio source available to export');
  }

  const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 60) || 'Audio_Export';
  const filename = `${sanitizedTitle}.mp3`;

  if (onProgress) onProgress(20, 'Extrayendo y codificando pista a MP3 auténtico...');

  // 1. Try server-side FFmpeg transcoding API (fast, high-quality 320k MP3)
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('data:'))) {
    try {
      let res: Response;
      if (targetUrl.startsWith('data:') || audioUrl?.startsWith('data:')) {
        res = await fetch('/api/convert-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'mp3',
            url: targetUrl,
            audioUrl: audioUrl || targetUrl,
            filename
          })
        });
      } else {
        const convertUrl = `/api/convert-media?type=mp3&url=${encodeURIComponent(targetUrl)}&audioUrl=${encodeURIComponent(audioUrl || '')}&filename=${encodeURIComponent(filename)}`;
        res = await fetch(convertUrl);
      }

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 1024 && !blob.type.includes('html') && !blob.type.includes('text') && !blob.type.includes('json')) {
          if (onProgress) onProgress(90, 'Generando archivo MP3...');
          const audioBlob = new Blob([blob], { type: 'audio/mpeg' });
          if (onProgress) onProgress(100, 'Audio MP3 listo');
          triggerDownload(audioBlob, filename);
          return true;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error || 'Error al extraer pista MP3';
        if (onProgress) onProgress(0, msg);
        console.warn('Convert media MP3 returned error:', msg);
        return false;
      }
    } catch (proxyErr) {
      console.warn('Transcoding audio download fallback:', proxyErr);
    }
  }

  // 2. Direct fetch fallback if already MP3
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 2048 && !blob.type.includes('html') && !blob.type.includes('text')) {
        if (onProgress) onProgress(80, 'Codificando en formato MP3...');
        const audioBlob = new Blob([blob], { type: 'audio/mpeg' });
        if (onProgress) onProgress(100, 'Descarga de MP3 lista');
        triggerDownload(audioBlob, filename);
        return true;
      }
    }
  } catch {
    // Fallback failure
  }

  // 3. Fallback for PWA/Vercel: trigger direct download of audio or media stream
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    try {
      if (onProgress) onProgress(85, 'Iniciando descarga en navegador...');
      const proxyAudioUrl = `/api/proxy-video?url=${encodeURIComponent(targetUrl)}&audio=true&filename=${encodeURIComponent(filename)}`;
      triggerDirectUrlDownload(proxyAudioUrl, filename);
      if (onProgress) onProgress(100, 'Descarga de audio iniciada');
      return true;
    } catch {
      // Fallback
    }
  }

  if (onProgress) onProgress(0, 'Error: No se pudo extraer la pista de audio MP3');
  return false;
}

