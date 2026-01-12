export interface Movie {
  id: string;
  title: string;
  poster: string;
  year: number;
  runtime: string;
  genre: string[];
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Watchlist' | 'Ongoing' | 'Seen';
  votes: number; // upvotes - downvotes (net votes)
  upvotes?: number;
  downvotes?: number;
  userVote?: 'upvote' | 'downvote' | null;
  seenBy: string[];
  availability: string[]; // e.g., ['Netflix', 'Max']
  imdbRating?: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Idle' | 'Do Not Disturb' | 'Offline';
  role: 'Admin' | 'Editor' | 'Viewer';
}

export interface Group {
  id: string;
  name: string;
  members: User[];
  budgetHours: number;
  usedHours: number;
  pictureUrl?: string;
  inviteCode?: string;
  description?: string;
}

