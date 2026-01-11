import { NextRequest, NextResponse } from 'next/server';
import { searchMovies } from '@/lib/api/tmdb';
import { extractYouTubeId, getYouTubeVideoData } from '@/lib/api/youtube';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all';

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    if (type === 'youtube' || query.includes('youtube.com') || query.includes('youtu.be')) {
      const videoId = extractYouTubeId(query);
      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
      }
      
      const videoData = await getYouTubeVideoData(videoId);
      if (!videoData) {
        return NextResponse.json({ error: 'Could not fetch YouTube video' }, { status: 404 });
      }
      
      return NextResponse.json({
        type: 'youtube',
        data: videoData,
      });
    }

    // Search TMDB for movies
    const movies = await searchMovies(query);
    
    return NextResponse.json({
      type: 'movie',
      results: movies,
    });
  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

