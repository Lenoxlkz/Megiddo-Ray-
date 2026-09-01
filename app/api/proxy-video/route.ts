import { NextRequest, NextResponse } from 'next/server';
import { extractYouTubeMedia, extractFacebookMedia, extractInstagramMedia, extractTikTokMedia } from '@/lib/mediaExtractor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const type = searchParams.get('type') || 'auto';

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let result;
    if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      result = await extractYouTubeMedia(url);
    } else if (type === 'facebook' || url.includes('facebook.com') || url.includes('fb.watch')) {
      result = await extractFacebookMedia(url);
    } else if (type === 'instagram' || url.includes('instagram.com')) {
      result = await extractInstagramMedia(url);
    } else if (type === 'tiktok' || url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      result = await extractTikTokMedia(url);
    } else {
      // Try auto-detect
      if (url.includes('youtube') || url.includes('youtu.be')) {
        result = await extractYouTubeMedia(url);
      } else if (url.includes('facebook') || url.includes('fb.watch')) {
        result = await extractFacebookMedia(url);
      } else if (url.includes('instagram')) {
        result = await extractInstagramMedia(url);
      } else if (url.includes('tiktok')) {
        result = await extractTikTokMedia(url);
      } else {
        return NextResponse.json({ error: 'Unsupported URL type' }, { status: 400 });
      }
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy fetch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
