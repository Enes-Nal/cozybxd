import { NextResponse } from 'next/server';
import { getIMDbRating } from '@/lib/api/imdbapi';

/**
 * Test endpoint to verify IMDb API works
 * GET /api/media/test-imdb?imdbId=tt0111161
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get('imdbId') || 'tt0111161'; // The Shawshank Redemption
  
  try {
    const rating = await getIMDbRating(imdbId);
    return NextResponse.json({ 
      imdbId, 
      rating,
      success: rating !== null 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      imdbId 
    }, { status: 500 });
  }
}

