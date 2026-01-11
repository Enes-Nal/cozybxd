import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { getMovieDetails, getPosterUrl, getBackdropUrl } from '@/lib/api/tmdb';
import { getGenres } from '@/lib/api/tmdb';

// Helper to get genre names from IDs
async function getGenreNames(genreIds: number[]): Promise<string[]> {
  try {
    const genres = await getGenres();
    const genreMap = new Map(genres.map(g => [g.id, g.name]));
    return genreIds.map(id => genreMap.get(id) || '').filter(Boolean);
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
  const { tmdbId, type = 'movie' } = body;

  if (!tmdbId) {
    return NextResponse.json({ error: 'TMDB ID required' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // Check if media already exists
    const { data: existing } = await supabase
      .from('media')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }

    // Fetch from TMDB
    const tmdbData = await getMovieDetails(tmdbId);
    if (!tmdbData) {
      return NextResponse.json({ error: 'Movie not found in TMDB' }, { status: 404 });
    }

    // Get genre names
    const genres = await getGenreNames(tmdbData.genre_ids || []);

    // Create media record
    const { data: media, error } = await supabase
      .from('media')
      .insert({
        tmdb_id: tmdbId,
        title: tmdbData.title,
        type: type,
        poster_url: getPosterUrl(tmdbData.poster_path),
        backdrop_url: getBackdropUrl(tmdbData.backdrop_path),
        overview: tmdbData.overview || null,
        release_date: tmdbData.release_date ? new Date(tmdbData.release_date) : null,
        runtime: tmdbData.runtime || null,
        genres: genres,
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

