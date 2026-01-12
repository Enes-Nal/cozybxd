import { Filter } from 'bad-words';

// Extended list of slurs and offensive terms
const additionalSlurs = [
  // Racial/ethnic slurs
  'nword', 'n-word', 'n1gg', 'n1gga', 'n1gger',
  'chink', 'gook', 'jap', 'wetback', 'spic', 'beaner',
  'kike', 'kyke', 'heeb', 'yid',
  'towelhead', 'sandnword', 'sandn-word',
  'paki', 'raghead',
  
  // LGBTQ+ slurs
  'fag', 'faggot', 'fagot', 'dyke', 'tranny', 'trap',
  'homo', 'queer', 'shemale',
  
  // Other offensive terms
  'retard', 'retarded', 'r3tard', 'r3tarded',
  'autist', 'autistic', 'sped', 'spaz',
  'cripple', 'gimp', 'midget', 'dwarf',
  
  // Common profanity variations
  'fuck', 'fuk', 'fuc', 'fck', 'f*ck', 'f**k',
  'shit', 'sh1t', 'sht', 's*it', 's**t',
  'bitch', 'b1tch', 'btch', 'b*tch', 'b**ch',
  'asshole', 'ashole', 'a$$hole',
  'damn', 'damm', 'd@mn',
  'hell', 'h3ll',
  
  // Sexual terms
  'porn', 'xxx', 'sex', 'dick', 'cock', 'penis', 'pussy', 'vagina',
  'cum', 'jizz', 'orgasm', 'masturbat',
  
  // Violence
  'kill', 'murder', 'suicide', 'rape', 'raped', 'raping',
  
  // Drug references
  'cocaine', 'heroin', 'meth', 'crack', 'drugs',
];

// Create filter instance
const filter = new Filter();

// Add custom words to the filter
filter.addWords(...additionalSlurs);

// Additional check for common evasions (leetspeak, spacing, etc.)
function normalizeForCheck(text: string): string {
  // Remove common leetspeak substitutions
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\*/g, '')
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^a-z0-9]/g, ''); // Remove special characters
}

/**
 * Checks if a username contains profanity or slurs
 * @param username - The username to check
 * @returns Object with isValid boolean and error message if invalid
 */
export function checkProfanity(username: string): { isValid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Username cannot be empty' };
  }

  // Check with bad-words filter
  if (filter.isProfane(trimmed)) {
    return { 
      isValid: false, 
      error: 'Username contains inappropriate language. Please choose a different username.' 
    };
  }

  // Check normalized version for evasions
  const normalized = normalizeForCheck(trimmed);
  if (filter.isProfane(normalized)) {
    return { 
      isValid: false, 
      error: 'Username contains inappropriate language. Please choose a different username.' 
    };
  }

  // Check if any slur appears in the username (case-insensitive, handles partial matches)
  const lowerUsername = trimmed.toLowerCase();
  for (const slur of additionalSlurs) {
    if (lowerUsername.includes(slur.toLowerCase())) {
      return { 
        isValid: false, 
        error: 'Username contains inappropriate language. Please choose a different username.' 
      };
    }
  }

  return { isValid: true };
}

