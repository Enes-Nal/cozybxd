import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { getPopularMovies, getTrendingMovies, discoverMovies, getMovieDetails, getPosterUrl, getBackdropUrl, TMDBMovie } from '@/lib/api/tmdb';
import { transformTMDBMovieToMovieSync } from '@/lib/utils/transformers';
import { getGenres } from '@/lib/api/tmdb';
import { getOMDbData } from '@/lib/api/omdb';

// Get movies for swiping (excluding already swiped ones)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const source = searchParams.get('source') || 'popular'; // popular, trending, discover

    const supabase = createServerClient();

    // Verify user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });
    }

    // Get user's swipes for this team
    const { data: swipes } = await supabase
      .from('movie_swipes')
      .select('tmdb_id, media_id')
      .eq('user_id', session.user.id)
      .eq('team_id', teamId);

    const swipedTmdbIds = new Set<number>();
    const swipedMediaIds = new Set<string>();

    swipes?.forEach(swipe => {
      if (swipe.tmdb_id) {
        swipedTmdbIds.add(swipe.tmdb_id);
      }
      if (swipe.media_id) {
        swipedMediaIds.add(swipe.media_id);
      }
    });

    // Fetch movies based on source
    let tmdbMovies;
    let totalPages = 1000; // Default high number, TMDB typically has many pages
    let currentPage = page;
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.TMDB_API_KEY;
    
    if (!apiKey) {
      throw new Error('TMDB API key is not configured');
    }
    
    if (source === 'trending') {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/trending/movie/day?api_key=${apiKey}&page=${page}`
        );
        if (response.ok) {
          const data = await response.json();
          tmdbMovies = data.results || [];
          totalPages = data.total_pages || 1000;
          currentPage = data.page || page;
        } else {
          tmdbMovies = await getTrendingMovies(page);
        }
      } catch {
        tmdbMovies = await getTrendingMovies(page);
      }
    } else if (source === 'discover') {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&page=${page}&sort_by=popularity.desc`
        );
        if (response.ok) {
          const data = await response.json();
          tmdbMovies = data.results || [];
          totalPages = data.total_pages || 1000;
          currentPage = data.page || page;
        } else {
          tmdbMovies = await discoverMovies({
            contentType: 'movie',
            page,
            sortBy: 'popularity.desc',
          });
        }
      } catch {
        tmdbMovies = await discoverMovies({
          contentType: 'movie',
          page,
          sortBy: 'popularity.desc',
        });
      }
    } else {
      // Default to popular
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=${page}`
        );
        if (response.ok) {
          const data = await response.json();
          tmdbMovies = data.results || [];
          totalPages = data.total_pages || 1000;
          currentPage = data.page || page;
        } else {
          tmdbMovies = await getPopularMovies(page);
        }
      } catch {
        tmdbMovies = await getPopularMovies(page);
      }
    }

    // Filter out already swiped movies
    const unswipedMovies = tmdbMovies.filter((movie: TMDBMovie) => !swipedTmdbIds.has(movie.id));

    // Get genre map for transformation
    const genres = await getGenres();
    const genreMap = new Map(genres.map(g => [g.id, g.name]));

    // Transform to Movie format
    const movies = unswipedMovies.map((tmdbMovie: TMDBMovie) => 
      transformTMDBMovieToMovieSync(tmdbMovie, genreMap)
    );

    return NextResponse.json({
      movies,
      hasMore: currentPage < totalPages, // Check if there are more pages available
      currentPage,
      totalPages,
    });
  } catch (error) {
    console.error('Swipe movies error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch movies for swiping';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Record a swipe (like or dislike)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await context.params;
    const body = await request.json();
    const { tmdbId, mediaId, swipeType } = body;

    if (!swipeType || !['like', 'dislike'].includes(swipeType)) {
      return NextResponse.json({ error: 'Invalid swipe type' }, { status: 400 });
    }

    if (!tmdbId && !mediaId) {
      return NextResponse.json({ error: 'tmdbId or mediaId required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });
    }

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

    // If it's a like and we have a tmdbId, sync the media first
    let finalMediaId = mediaId;
    if (swipeType === 'like' && tmdbId && !mediaId) {
      // Check if media already exists
      const { data: existingMedia } = await supabase
        .from('media')
        .select('id')
        .eq('tmdb_id', tmdbId)
        .single();

      if (existingMedia) {
        finalMediaId = existingMedia.id;
      } else {
        // Sync media from TMDB
        const tmdbData = await getMovieDetails(tmdbId);
        if (tmdbData) {
          const genres = await extractGenreNames(tmdbData);
          
          // Fetch IMDB rating if available
          let imdbRating: number | null = null;
          let imdbId: string | null = null;
          
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
              }
            }
          }

          const { data: syncedMedia, error: mediaError } = await supabase
            .from('media')
            .insert({
              tmdb_id: tmdbId,
              imdb_id: imdbId,
              title: tmdbData.title,
              type: 'movie',
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

          if (!mediaError && syncedMedia) {
            finalMediaId = syncedMedia.id;
          }
        }
      }
    }

    // Record or update the swipe
    // First check if swipe already exists
    let query = supabase
      .from('movie_swipes')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('team_id', teamId);

    if (finalMediaId) {
      query = query.eq('media_id', finalMediaId);
    } else if (tmdbId) {
      query = query.eq('tmdb_id', tmdbId).is('media_id', null);
    }

    const { data: existingSwipe } = await query.maybeSingle();

    const swipeData: any = {
      user_id: session.user.id,
      team_id: teamId,
      swipe_type: swipeType,
    };

    if (finalMediaId) {
      swipeData.media_id = finalMediaId;
    }
    if (tmdbId) {
      swipeData.tmdb_id = tmdbId;
    }

    let swipe;
    let swipeError;

    if (existingSwipe) {
      // Update existing swipe
      const { data, error } = await supabase
        .from('movie_swipes')
        .update({ swipe_type: swipeType })
        .eq('id', existingSwipe.id)
        .select()
        .single();
      swipe = data;
      swipeError = error;
    } else {
      // Insert new swipe
      const { data, error } = await supabase
        .from('movie_swipes')
        .insert(swipeData)
        .select()
        .single();
      swipe = data;
      swipeError = error;
    }

    if (swipeError) {
      console.error('Swipe error:', swipeError);
      return NextResponse.json({ error: swipeError.message }, { status: 500 });
    }

    // If it's a like, also add to watchlist and upvote (if not already there)
    if (swipeType === 'like' && finalMediaId) {
      // Check if already in watchlist
      const { data: existingWatchlist } = await supabase
        .from('watchlist_items')
        .select('id, upvotes, downvotes')
        .eq('team_id', teamId)
        .eq('media_id', finalMediaId)
        .is('user_id', null) // Team watchlist items have null user_id
        .maybeSingle();

      let watchlistItemId: string | null = null;

      if (!existingWatchlist) {
        // Add to watchlist
        const { data: newWatchlistItem, error: watchlistError } = await supabase
          .from('watchlist_items')
          .insert({
            media_id: finalMediaId,
            team_id: teamId,
            user_id: null,
            upvotes: 0,
            downvotes: 0,
          })
          .select('id')
          .single();

        if (!watchlistError && newWatchlistItem) {
          watchlistItemId = newWatchlistItem.id;
        }
      } else {
        watchlistItemId = existingWatchlist.id;
      }

      // Upvote if watchlist item exists and user hasn't voted yet
      if (watchlistItemId) {
        const { data: existingVote } = await supabase
          .from('watchlist_votes')
          .select('*')
          .eq('watchlist_item_id', watchlistItemId)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!existingVote) {
          // Add upvote
          const currentUpvotes = existingWatchlist?.upvotes || 0;
          await supabase
            .from('watchlist_votes')
            .insert({
              watchlist_item_id: watchlistItemId,
              user_id: session.user.id,
              vote_type: 'upvote',
            });

          // Update watchlist item counts
          await supabase
            .from('watchlist_items')
            .update({ upvotes: currentUpvotes + 1 })
            .eq('id', watchlistItemId);
        }
      }
    }

    return NextResponse.json({ success: true, swipe });
  } catch (error) {
    console.error('Record swipe error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to record swipe';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

