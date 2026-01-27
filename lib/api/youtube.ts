const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '';

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number; // in seconds
  channelTitle: string;
  publishedAt?: string; // ISO 8601 date string
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export async function getYouTubeVideoData(videoId: string): Promise<YouTubeVideo | null> {
  // Try YouTube Data API v3 first if API key is available
  if (YOUTUBE_API_KEY) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const duration = parseDuration(item.contentDetails.duration);
        
        return {
          id: videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || '',
          duration,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
        };
      }
    } catch (error) {
      console.error('YouTube API error:', error);
      // Fall through to oEmbed fallback
    }
  }

  // Fallback: Use oEmbed API (no API key required, but limited info)
  try {
    const oEmbedResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    
    if (oEmbedResponse.ok) {
      const oEmbedData = await oEmbedResponse.json();
      return {
        id: videoId,
        title: oEmbedData.title || 'YouTube Video',
        thumbnail: oEmbedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: 0, // oEmbed doesn't provide duration
        channelTitle: oEmbedData.author_name || 'Unknown',
      };
    }
  } catch (error) {
    console.error('YouTube oEmbed error:', error);
  }

  // Final fallback if both methods fail
  return {
    id: videoId,
    title: 'YouTube Video',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: 0,
    channelTitle: 'Unknown',
  };
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration (e.g., PT1H2M10S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

