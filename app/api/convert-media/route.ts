import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { extractInstagramMedia, extractTikTokMedia, extractTwitterMedia, extractYouTubeMedia, extractFacebookMedia } from '@/lib/mediaExtractor';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

async function downloadFileToTemp(fileUrl: string, prefix: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}_${uuidv4()}.tmp`);
  
  if (fileUrl.startsWith('data:')) {
    const commaIdx = fileUrl.indexOf(',');
    const base64Data = commaIdx !== -1 ? fileUrl.slice(commaIdx + 1) : fileUrl;
    await fs.promises.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
    return tempPath;
  }

  const headers = { ...BROWSER_HEADERS };
  if (fileUrl.includes('instagram.com') || fileUrl.includes('cdninstagram.com')) {
    headers['Referer'] = 'https://www.instagram.com/';
  } else if (fileUrl.includes('tiktok.com') || fileUrl.includes('tiktokcdn.com')) {
    headers['Referer'] = 'https://www.tiktok.com/';
  }

  const res = await fetch(fileUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch media from ${fileUrl}: ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  await fs.promises.writeFile(tempPath, Buffer.from(arrayBuf));
  return tempPath;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'mp3';
  let targetUrl = searchParams.get('url') || '';
  let imageUrl = searchParams.get('imageUrl') || '';
  let audioUrl = searchParams.get('audioUrl') || '';
  const filename = searchParams.get('filename') || (type === 'mp3' ? 'audio.mp3' : 'video.mp4');

  return handleMediaConversion({ type, targetUrl, imageUrl, audioUrl, filename });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type || 'mp3';
    const targetUrl = body.url || body.targetUrl || '';
    const imageUrl = body.imageUrl || '';
    const audioUrl = body.audioUrl || '';
    const filename = body.filename || (type === 'mp3' ? 'audio.mp3' : 'video.mp4');

    return handleMediaConversion({ type, targetUrl, imageUrl, audioUrl, filename });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function handleMediaConversion(params: {
  type: string;
  targetUrl: string;
  imageUrl: string;
  audioUrl: string;
  filename: string;
}) {
  const { type, filename } = params;
  let { targetUrl, imageUrl, audioUrl } = params;
  const tempFilesToClean: string[] = [];

  const cleanup = async () => {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) await fs.promises.unlink(f);
      } catch {
        // Ignore unlink error
      }
    }
  };

  try {
    // A. EXPORT AS MP3 (Audio Extraction / Transcoding)
    if (type === 'mp3' || type === 'audio') {
      let mediaStreamUrl = audioUrl || targetUrl || imageUrl;
      if (!mediaStreamUrl) {
        return NextResponse.json({ error: 'No se proporcionó URL de medio para extraer audio' }, { status: 400 });
      }

      // If social URL, extract direct audio/video stream
      if (mediaStreamUrl.includes('instagram.com') || mediaStreamUrl.includes('instagr.am')) {
        const igData = await extractInstagramMedia(mediaStreamUrl);
        if (igData.audioUrl) {
          mediaStreamUrl = igData.audioUrl;
        } else if (igData.videoUrl) {
          mediaStreamUrl = igData.videoUrl;
        } else {
          // It's a static image post without an accessible audio stream
          return NextResponse.json({ 
            error: 'No se detectó pista de audio o flujo de video en esta publicación de Instagram para exportar como MP3.' 
          }, { status: 400 });
        }
      } else if (mediaStreamUrl.includes('tiktok.com')) {
        const tkData = await extractTikTokMedia(mediaStreamUrl);
        if (tkData.audioUrl) {
          mediaStreamUrl = tkData.audioUrl;
        } else if (tkData.videoUrl) {
          mediaStreamUrl = tkData.videoUrl;
        }
      } else if (mediaStreamUrl.includes('youtube.com') || mediaStreamUrl.includes('youtu.be')) {
        const ytData = await extractYouTubeMedia(mediaStreamUrl);
        if (ytData.audioUrl) {
          mediaStreamUrl = ytData.audioUrl;
        } else if (ytData.videoUrl) {
          mediaStreamUrl = ytData.videoUrl;
        }
      } else if (mediaStreamUrl.includes('facebook.com') || mediaStreamUrl.includes('fb.watch')) {
        const fbData = await extractFacebookMedia(mediaStreamUrl);
        if (fbData.videoUrl) {
          mediaStreamUrl = fbData.videoUrl;
        }
      } else if (mediaStreamUrl.includes('x.com') || mediaStreamUrl.includes('twitter.com')) {
        const twData = await extractTwitterMedia(mediaStreamUrl);
        if (twData.audioUrl) {
          mediaStreamUrl = twData.audioUrl;
        } else if (twData.videoUrl) {
          mediaStreamUrl = twData.videoUrl;
        }
      }

      // Prevent attempting to extract MP3 from pure image files if no audio stream exists
      if (mediaStreamUrl.endsWith('.jpg') || mediaStreamUrl.endsWith('.jpeg') || mediaStreamUrl.endsWith('.png') || mediaStreamUrl.endsWith('.webp')) {
        return NextResponse.json({ 
          error: 'El recurso seleccionado es una imagen fija y no contiene una pista de audio para exportar como MP3.' 
        }, { status: 400 });
      }

      // Download audio / video source into temporary file for reliable FFmpeg transcoding
      const inputTempPath = await downloadFileToTemp(mediaStreamUrl, 'audio_src');
      tempFilesToClean.push(inputTempPath);

      // Transcode to pure MP3 (libmp3lame, 320kbps, 44100Hz)
      const ffmpeg = spawn('ffmpeg', [
        '-threads', '2',
        '-i', inputTempPath,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        '-ar', '44100',
        '-f', 'mp3',
        'pipe:1'
      ]);

      const nodeStream = Readable.from(ffmpeg.stdout);
      ffmpeg.on('close', cleanup);
      ffmpeg.on('error', cleanup);

      // Web standard readable stream
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        }
      });

      return new Response(webStream, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename.endsWith('.mp3') ? filename : `${filename}.mp3`)}"`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    // B. IMAGE + AUDIO TO MP4 VIDEO CONVERSION (Ultra-fast synthesis)
    if (type === 'video_from_image' || type === 'image_with_audio' || type === 'video') {
      let finalImgUrl = imageUrl || targetUrl;
      let finalAudUrl = audioUrl;

      // If Instagram URL provided
      if (finalImgUrl.includes('instagram.com') || finalImgUrl.includes('instagr.am')) {
        const igData = await extractInstagramMedia(finalImgUrl);
        if (igData.images.length > 0) {
          finalImgUrl = igData.images[0];
        }
        if (igData.audioUrl && !finalAudUrl) {
          finalAudUrl = igData.audioUrl;
        } else if (igData.videoUrl && !finalAudUrl) {
          finalAudUrl = igData.videoUrl;
        }
      }

      // If YouTube URL provided as audio source, extract stream
      if (finalAudUrl && (finalAudUrl.includes('youtube.com') || finalAudUrl.includes('youtu.be'))) {
        try {
          const ytData = await extractYouTubeMedia(finalAudUrl);
          if (ytData.audioUrl) {
            finalAudUrl = ytData.audioUrl;
          } else if (ytData.videoUrl) {
            finalAudUrl = ytData.videoUrl;
          }
        } catch {
          // ignore
        }
      }

      if (!finalImgUrl) {
        return NextResponse.json({ error: 'No se encontró URL de imagen para la síntesis de video' }, { status: 400 });
      }

      if (!finalAudUrl) {
        return NextResponse.json({ 
          error: 'No se detectó audio accesible en esta publicación de imagen. Instagram restringe la descarga directa de música en fotos fijas. Por favor adjunta un archivo MP3 o vincula un enlace de audio/video para generar el video con sonido.' 
        }, { status: 400 });
      }

      // Download image
      const imgTempPath = await downloadFileToTemp(finalImgUrl, 'img');
      tempFilesToClean.push(imgTempPath);

      let ffmpegArgs: string[] = [];

      if (finalAudUrl && (finalAudUrl.startsWith('http') || finalAudUrl.startsWith('data:'))) {
        // Download audio
        try {
          const audTempPath = await downloadFileToTemp(finalAudUrl, 'aud');
          tempFilesToClean.push(audTempPath);

          // Ultra-fast 2fps still image MP4 synthesis with full audio track
          ffmpegArgs = [
            '-threads', '2',
            '-framerate', '2',
            '-loop', '1',
            '-i', imgTempPath,
            '-i', audTempPath,
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'stillimage',
            '-r', '2',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1'
          ];
        } catch (audErr: any) {
          return NextResponse.json({ 
            error: `Error al procesar el archivo de audio adjunto: ${audErr?.message || 'archivo no soportado'}` 
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({ 
          error: 'La URL o archivo de audio proporcionado no es válido.' 
        }, { status: 400 });
      }

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      const nodeStream = Readable.from(ffmpeg.stdout);
      ffmpeg.on('close', cleanup);
      ffmpeg.on('error', cleanup);

      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        }
      });

      return new Response(webStream, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename.endsWith('.mp4') ? filename : `${filename}.mp4`)}"`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    await cleanup();
    return NextResponse.json({ error: `Tipo de conversión no soportado: ${type}` }, { status: 400 });
  } catch (err: unknown) {
    await cleanup();
    const msg = err instanceof Error ? err.message : 'Media conversion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
