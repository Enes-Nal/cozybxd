/**
 * IMDb API client using imdbapi.dev (free API)
 * Documentation: https://imdbapi.dev/
 */

// Try both possible base URLs - the API might be at a different domain
const IMDBAPI_BASE_URL = 'https://api.imdbapi.dev';
const IMDBAPI_ALT_URL = 'https://imdbapi.dev/api';

export interface IMDbAPIRating {
  aggregateRating?: number;
  voteCount?: number;
}

export interface IMDbAPITitle {
  id: string;
  title: string;
  rating?: IMDbAPIRating;
}

export interface IMDbAPIBatchResponse {
  titles: IMDbAPITitle[];
}

/**
 * Fetch IMDb rating for a single movie by IMDb ID
 * @param imdbId IMDb ID in format tt1234567
 */
export async function getIMDbRating(imdbId: string): Promise<number | null> {
  if (!imdbId || !imdbId.startsWith('tt')) {
    return null;
  }

  try {
    // Try primary URL first
    let url = `${IMDBAPI_BASE_URL}/titles/${imdbId}`;
    let response = await fetch(url);
    
    // If that fails, try alternative URL
    if (!response.ok && response.status === 404) {
      console.log(`Trying alternative URL for ${imdbId}`);
      url = `${IMDBAPI_ALT_URL}/titles/${imdbId}`;
      response = await fetch(url);
    }
    
    if (!response.ok) {
      console.error(`IMDb API error for ${imdbId}: ${response.status} ${response.statusText} from ${url}`);
      const errorText = await response.text().catch(() => '');
      console.error('Error response:', errorText.substring(0, 200));
      return null;
    }
    
    const data: any = await response.json();
    console.log(`IMDb API response for ${imdbId}:`, JSON.stringify(data).substring(0, 500));
    
    // Try different possible response formats - check the actual API documentation
    // The API might return: data.rating, data.ratingsSummary, data.imdbRating, etc.
    let rating = data.rating?.aggregateRating || 
                 data.rating?.value || 
                 data.ratingsSummary?.aggregateRating ||
                 data.ratingsSummary?.rating ||
                 data.imdbRating ||
                 data.ratings?.imdb?.rating ||
                 data.imdbRatingValue ||
                 data.imdbapiRating?.aggregateRating;
    
    // Also check if rating is nested deeper
    if (!rating && data.ratings) {
      rating = data.ratings.aggregateRating || data.ratings.value;
    }
    
    // Check if it's in a title object
    if (!rating && data.title) {
      rating = data.title.rating?.aggregateRating || data.title.ratingsSummary?.aggregateRating;
    }
    
    console.log(`Extracted rating for ${imdbId}:`, rating, typeof rating);
    
    if (rating && typeof rating === 'number') {
      return rating;
    }
    
    // If rating is a string, try to parse it
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    // Log the full data structure if rating not found
    if (!rating) {
      console.log(`No rating found in response for ${imdbId}. Full response:`, JSON.stringify(data, null, 2).substring(0, 1000));
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to fetch IMDb rating for ${imdbId}:`, error);
    return null;
  }
}

/**
 * Batch fetch IMDb ratings for multiple movies
 * @param imdbIds Array of IMDb IDs in format tt1234567
 * @returns Map of IMDb ID to rating
 */
export async function getIMDbRatingsBatch(imdbIds: string[]): Promise<Map<string, number>> {
  const ratingMap = new Map<string, number>();
  
  if (!imdbIds || imdbIds.length === 0) {
    return ratingMap;
  }

  // Filter valid IMDb IDs
  const validIds = imdbIds.filter(id => id && id.startsWith('tt'));
  if (validIds.length === 0) {
    console.log('No valid IMDb IDs to fetch');
    return ratingMap;
  }

  try {
    // Try individual requests first (more reliable)
    // Batch endpoint might not be available or have different format
    const result = await getIMDbRatingsIndividual(validIds);
    console.log('Fetched IMDb ratings:', Array.from(result.entries()));
    return result;
  } catch (error) {
    console.error('Failed to fetch IMDb ratings:', error);
    return ratingMap;
  }
}

/**
 * Fetch IMDb ratings individually (more reliable than batch)
 */
async function getIMDbRatingsIndividual(imdbIds: string[]): Promise<Map<string, number>> {
  const ratingMap = new Map<string, number>();
  
  // Limit to avoid rate limits - process in smaller batches
  const batchSize = 5;
  for (let i = 0; i < imdbIds.length && i < 20; i += batchSize) {
    const batch = imdbIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (imdbId) => {
      try {
        console.log(`Fetching rating for ${imdbId}...`);
        const rating = await getIMDbRating(imdbId);
        if (rating !== null) {
          console.log(`Got rating ${rating} for ${imdbId}`);
          ratingMap.set(imdbId, rating);
        } else {
          console.log(`No rating found for ${imdbId}`);
        }
      } catch (error) {
        console.error(`Failed to fetch rating for ${imdbId}:`, error);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < imdbIds.length && i + batchSize < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return ratingMap;
}

