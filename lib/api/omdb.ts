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

/**
 * Extract IMDB ID from an IMDB URL
 * Supports formats like:
 * - https://www.imdb.com/title/tt1234567/
 * - https://imdb.com/title/tt1234567
 * - http://www.imdb.com/title/tt1234567/?ref_=fn_al_tt_1
 */
export function extractImdbId(url: string): string | null {
  // Match patterns like /title/tt1234567/ or /title/tt1234567
  const patterns = [
    /(?:imdb\.com\/title\/)(tt\d+)/i,
    /(?:www\.imdb\.com\/title\/)(tt\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // Also check if it's already just an IMDB ID (tt1234567)
  if (/^tt\d+$/i.test(url.trim())) {
    return url.trim();
  }
  
  return null;
}

