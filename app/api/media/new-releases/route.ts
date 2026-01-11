import { NextResponse } from 'next/server';
import { getNowPlayingMovies } from '@/lib/api/tmdb';

export async function GET() {
  try {
    const movies = await getNowPlayingMovies(1);
    return NextResponse.json({
      type: 'movie',
      results: movies,
    });
  } catch (error) {
    console.error('New releases error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch new releases';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

