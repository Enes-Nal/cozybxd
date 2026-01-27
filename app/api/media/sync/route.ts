import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { getMovieDetails, getPosterUrl, getBackdropUrl } from '@/lib/api/tmdb';
import { getGenres } from '@/lib/api/tmdb';
import { getOMDbData } from '@/lib/api/omdb';
import { extractYouTubeId, getYouTubeVideoData } from '@/lib/api/youtube';

// Helper to extract genre names from TMDB movie data
// Handles both genre_ids (from search results) and genres (from detail responses)
async function extractGenreNames(tmdbData: any): Promise<string[]> {
  try {
    // If genres array exists (from detail response), extract names directly
    if (Array.isArray(tmdbData.genres) && tmdbData.genres.length > 0) {
      return tmdbData.genres.map((g: any) => g.name).filter(Boolean);
    }
    
    // Otherwise, use genre_ids and map to names
    if (Array.isArray(tmdbData.genre_ids) && tmdbData.genre_ids.length > 0) {
      const genres = await getGenres();
      const genreMap = new Map(genres.map(g => [g.id, g.name]));
      return tmdbData.genre_ids.map((id: number) => genreMap.get(id) || '').filter(Boolean);
    }
    
    return [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tmdbId, type = 'movie', youtubeId, youtubeUrl } = body;

  const supabase = createServerClient();

  try {
    // Handle YouTube videos
    if (youtubeId || youtubeUrl) {
      const videoId = youtubeId || extractYouTubeId(youtubeUrl);
      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL or ID' }, { status: 400 });
      }

      // Fetch YouTube video data first to get latest title and channel
      const videoData = await getYouTubeVideoData(videoId);
      if (!videoData) {
        return NextResponse.json({ error: 'Could not fetch YouTube video' }, { status: 404 });
      }

      // Check if media already exists (by YouTube URL)
      const { data: existing } = await supabase
        .from('media')
        .select('*')
        .eq('youtube_url', `https://www.youtube.com/watch?v=${videoId}`)
        .single();

      if (existing) {
        // Always update existing record with latest title and channel info
        // This ensures videos with fallback "YouTube Video" title get updated
        const { data: updated, error: updateError } = await supabase
          .from('media')
          .update({
            title: videoData.title,
            thumbnail_url: videoData.thumbnail,
            duration: videoData.duration,
            overview: videoData.channelTitle ? `Channel: ${videoData.channelTitle}` : existing.overview,
            release_date: videoData.publishedAt ? new Date(videoData.publishedAt) : existing.release_date,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update YouTube video:', updateError);
          return NextResponse.json(existing);
        }

        return NextResponse.json(updated);
      }

      // Create media record for YouTube video
      const { data: media, error } = await supabase
        .from('media')
        .insert({
          title: videoData.title,
          type: 'youtube',
          youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail_url: videoData.thumbnail,
          duration: videoData.duration,
          overview: videoData.channelTitle ? `Channel: ${videoData.channelTitle}` : null,
          release_date: videoData.publishedAt ? new Date(videoData.publishedAt) : null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(media);
    }

    // Handle TMDB movies (existing logic)
    if (!tmdbId) {
      return NextResponse.json({ error: 'TMDB ID or YouTube ID/URL required' }, { status: 400 });
    }

    // Check if media already exists
    const { data: existing } = await supabase
      .from('media')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .single();

    // Fetch from TMDB
    const tmdbData = await getMovieDetails(tmdbId);
    if (!tmdbData) {
      return NextResponse.json({ error: 'Movie not found in TMDB' }, { status: 404 });
    }

    // Get genre names
    const genres = await extractGenreNames(tmdbData);

    // If media exists but is missing genres, update it
    if (existing) {
      const hasGenres = existing.genres && Array.isArray(existing.genres) && existing.genres.length > 0;
      if (!hasGenres && genres.length > 0) {
        // Update existing media with genres
        const { data: updated, error: updateError } = await supabase
          .from('media')
          .update({ genres })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('Failed to update genres:', updateError);
          return NextResponse.json(existing);
        }
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    // Fetch IMDB rating if IMDB ID is available
    let imdbRating: number | null = null;
    let imdbId: string | null = null;
    
    // TMDB movie details include external_ids with imdb_id
    const tmdbMovieDetails = tmdbData as any;
    if (tmdbMovieDetails.external_ids?.imdb_id) {
      imdbId = tmdbMovieDetails.external_ids.imdb_id;
      if (imdbId) {
        try {
          const omdbData = await getOMDbData(imdbId);
          if (omdbData?.imdbRating && omdbData.imdbRating !== 'N/A') {
            imdbRating = parseFloat(omdbData.imdbRating);
          }
        } catch (error) {
          console.error('Failed to fetch IMDB rating:', error);
          // Continue without IMDB rating
        }
      }
    }

    // Create media record
    const { data: media, error } = await supabase
      .from('media')
      .insert({
        tmdb_id: tmdbId,
        imdb_id: imdbId,
        title: tmdbData.title,
        type: type,
        poster_url: getPosterUrl(tmdbData.poster_path),
        backdrop_url: getBackdropUrl(tmdbData.backdrop_path),
        overview: tmdbData.overview || null,
        release_date: tmdbData.release_date ? new Date(tmdbData.release_date) : null,
        runtime: tmdbData.runtime || null,
        genres: genres,
        imdb_rating: imdbRating,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(media);
  } catch (error) {
    console.error('Media sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

