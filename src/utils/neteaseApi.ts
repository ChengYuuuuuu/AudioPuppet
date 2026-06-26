const METING_API = 'https://api.qijieya.cn/meting/';

export interface NCMResponse {
  success: boolean;
  data?: {
    title: string;
    artist: string;
    coverUrl: string;
    audioUrl: string;
    lyrics: string;
  };
  error?: string;
}

export async function parseNeteaseSong(url: string): Promise<NCMResponse> {
  const songId = extractSongId(url);
  if (!songId) {
    return { success: false, error: '无法解析歌曲ID，请检查链接格式' };
  }

  try {
    const metaRes = await fetch(`${METING_API}?server=netease&type=song&id=${songId}`);
    const meta = (await metaRes.json())[0];

    if (!meta.url) {
      return { success: false, error: '该歌曲无法获取播放地址' };
    }

    let audioUrl = meta.url;
    if (!audioUrl.endsWith('.mp3')) {
      const urlRes = await fetch(audioUrl);
      audioUrl = urlRes.url;
    }

    const lrcRes = await fetch(meta.lrc);
    const lyrics = await lrcRes.text();

    return {
      success: true,
      data: {
        title: meta.name || '',
        artist: meta.artist || '',
        coverUrl: meta.pic || '',
        audioUrl,
        lyrics,
      },
    };
  } catch (err) {
    return { success: false, error: 'API 请求失败，请检查网络连接' };
  }
}

export function extractSongId(url: string): string | null {
  const patterns = [
    /[?&]id=(\d+)/,
    /\/song\/(\d+)/,
    /music\.163\.com.*?(\d{5,12})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
