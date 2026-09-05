import { NextRequest, NextResponse } from 'next/server';
import { extractYouTubeMedia, extractFacebookMedia, extractInstagramMedia, extractTikTokMedia, extractTwitterMedia } from '@/lib/mediaExtractor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let targetUrl = searchParams.get('url');
  const filename = searchParams.get('filename') || 'video.mp4';
  const isAudioOnly = searchParams.get('audio') === 'true' || filename.endsWith('.mp3');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let cleanUrl = targetUrl
      .replace(/&amp;/g, '&')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/');

    // If targetUrl is a webpage URL (YouTube, FB, IG, TikTok, X/Twitter) rather than a direct binary stream, resolve it!
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      const ytData = await extractYouTubeMedia(cleanUrl);
      if (isAudioOnly && ytData.audioUrl && ytData.audioUrl.startsWith('http')) {
        cleanUrl = ytData.audioUrl;
      } else if (ytData.videoUrl && ytData.videoUrl.startsWith('http')) {
        cleanUrl = ytData.videoUrl;
      }
    } else if (
      (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) &&
      !cleanUrl.includes('fbcdn.net') &&
      !cleanUrl.includes('.mp4')
    ) {
      const fbData = await extractFacebookMedia(cleanUrl);
      if (fbData.videoUrl && fbData.videoUrl.startsWith('http')) {
        cleanUrl = fbData.videoUrl;
      }
    } else if (
      (cleanUrl.includes('instagram.com') || cleanUrl.includes('instagr.am')) &&
      !cleanUrl.includes('cdninstagram.com') &&
      !cleanUrl.includes('.mp4') &&
      !cleanUrl.includes('rapidcdn.app')
    ) {
      const igData = await extractInstagramMedia(cleanUrl);
      if (igData.videoUrl && igData.videoUrl.startsWith('http')) {
        cleanUrl = igData.videoUrl;
      }
    } else if (
      cleanUrl.includes('tiktok.com') &&
      !cleanUrl.includes('tiktokcdn.com') &&
      !cleanUrl.includes('.mp4')
    ) {
      const tkData = await extractTikTokMedia(cleanUrl);
      if (isAudioOnly && tkData.audioUrl && tkData.audioUrl.startsWith('http')) {
        cleanUrl = tkData.audioUrl;
      } else if (tkData.videoUrl && tkData.videoUrl.startsWith('http')) {
        cleanUrl = tkData.videoUrl;
      }
    } else if (
      (cleanUrl.includes('x.com') || cleanUrl.includes('twitter.com') || cleanUrl.includes('fxtwitter.com') || cleanUrl.includes('vxtwitter.com') || cleanUrl.includes('fixupx.com')) &&
      !cleanUrl.includes('twimg.com') &&
      !cleanUrl.includes('.mp4')
    ) {
      const twData = await extractTwitterMedia(cleanUrl);
      if (isAudioOnly && twData.audioUrl && twData.audioUrl.startsWith('http')) {
        cleanUrl = twData.audioUrl;
      } else if (twData.videoUrl && twData.videoUrl.startsWith('http')) {
        cleanUrl = twData.videoUrl;
      }
    }

    const parsedUrl = new URL(cleanUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'User-Agent': cleanUrl.includes('fbcdn.net') || cleanUrl.includes('facebook.com') || cleanUrl.includes('cdninstagram.com')
        ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };

    if (cleanUrl.includes('fbcdn.net') || cleanUrl.includes('facebook.com')) {
      headers['Referer'] = 'https://www.facebook.com/';
      headers['Origin'] = 'https://www.facebook.com';
    } else if (cleanUrl.includes('cdninstagram.com') || cleanUrl.includes('instagram.com')) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
    } else if (cleanUrl.includes('tiktokcdn.com') || cleanUrl.includes('tiktok.com')) {
      headers['Referer'] = 'https://www.tiktok.com/';
    } else if (cleanUrl.includes('googlevideo.com') || cleanUrl.includes('youtube.com')) {
      headers['Referer'] = 'https://www.youtube.com/';
    } else if (cleanUrl.includes('twimg.com') || cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
      headers['Referer'] = 'https://x.com/';
      headers['Origin'] = 'https://x.com';
    }

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    let res = await fetch(cleanUrl, {
      headers,
      redirect: 'follow'
    });

    if (!res.ok && (cleanUrl.includes('fbcdn.net') || cleanUrl.includes('cdninstagram.com'))) {
      res = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 294.0.0.27.110',
          'Accept': '*/*'
        },
        redirect: 'follow'
      });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Remote video server responded with status ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';

    // Validate that the remote response is not an error HTML webpage
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return NextResponse.json({
        error: 'The source URL returned a web page instead of a direct binary video stream.',
        contentType
      }, { status: 422 });
    }

    // If audio extraction is requested, delegate to FFmpeg transcoding endpoint
    if (isAudioOnly) {
      const convertUrl = new URL('/api/convert-media', req.url);
      convertUrl.searchParams.set('type', 'mp3');
      convertUrl.searchParams.set('url', cleanUrl);
      convertUrl.searchParams.set('filename', filename.endsWith('.mp3') ? filename : `${filename}.mp3`);
      return NextResponse.redirect(convertUrl);
    }

    const outContentType = contentType || 'video/mp4';
    const responseHeaders: Record<string, string> = {
      'Content-Type': outContentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': 'public, max-age=3600',
    };

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }
    const acceptRanges = res.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;
    const contentLength = res.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new Response(res.body, {
      status: res.status === 206 ? 206 : 200,
      headers: responseHeaders
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy fetch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
