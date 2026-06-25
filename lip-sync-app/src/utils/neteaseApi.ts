const API_BASE = '/ncm';

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
    const [songRes, lyricRes, urlRes] = await Promise.all([
      fetch(`${API_BASE}/song/detail?ids=[${songId}]`),
      fetch(`${API_BASE}/lyric?id=${songId}`),
      fetch(`${API_BASE}/song/url?id=${songId}&level=standard`),
    ]);

    if (!songRes.ok || !lyricRes.ok || !urlRes.ok) {
      return { success: false, error: 'NeteaseCloudMusicApi 请求失败，请确认服务已启动 (npx NeteaseCloudMusicApi@latest)' };
    }

    const songData = await songRes.json();
    const lyricData = await lyricRes.json();
    const urlData = await urlRes.json();

    const song = songData.songs?.[0];
    if (!song) {
      return { success: false, error: '未找到该歌曲' };
    }

    const title = song.name;
    const artist = (song.ar || []).map((a: { name: string }) => a.name).join(', ');
    const coverUrl = song.al?.picUrl || '';
    const audioUrl = urlData.data?.[0]?.url || '';
    const lyrics = lyricData.lrc?.lyric || lyricData.tlyric?.lyric || '';

    if (!audioUrl) {
      return { success: false, error: '无法获取音频地址（可能需要 VIP 或该歌曲受限制）' };
    }

    return {
      success: true,
      data: { title, artist, coverUrl, audioUrl, lyrics },
    };
  } catch (err) {
    return { success: false, error: '网络请求失败，请确认 NeteaseCloudMusicApi 已启动（端口 3000）' };
  }
}

export function extractSongId(url: string): string | null {
  const patterns = [
    /song\?id=(\d+)/,
    /song\/(\d+)/,
    /music\.163\.com.*id=(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
