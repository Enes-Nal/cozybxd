import { NextResponse } from 'next/server';
import { getPopularMovies } from '@/lib/api/tmdb';

export async function GET() {
  try {
    const movies = await getPopularMovies(1);
    return NextResponse.json({
      type: 'movie',
      results: movies,
    });
  } catch (error) {
    console.error('Popular movies error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch popular movies';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

