const OMDB_API_KEY = process.env.NEXT_PUBLIC_OMDB_API_KEY || '';
const OMDB_BASE_URL = 'http://www.omdbapi.com';

export interface OMDbMovie {
  imdbID: string;
  Title: string;
  Year: string;
  imdbRating: string;
  Ratings: Array<{ Source: string; Value: string }>;
}

export async function getOMDbData(imdbId: string): Promise<OMDbMovie | null> {
  const response = await fetch(
    `${OMDB_BASE_URL}/?i=${imdbId}&apikey=${OMDB_API_KEY}`
  );
  if (!response.ok) return null;
  return response.json();
}

export function parseRottenTomatoesScore(ratings: Array<{ Source: string; Value: string }>): {
  tomatometer: number | null;
  audience: number | null;
} {
  let tomatometer: number | null = null;
  let audience: number | null = null;

  for (const rating of ratings) {
    if (rating.Source === 'Rotten Tomatoes') {
      const value = parseInt(rating.Value.replace('%', ''));
      tomatometer = value;
    } else if (rating.Source === 'Internet Movie Database') {
      // Already handled separately
    }
  }

  return { tomatometer, audience };
}

