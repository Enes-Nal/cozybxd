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
  votes: number;
  seenBy: string[];
  availability: string[]; // e.g., ['Netflix', 'Max']
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'Online' | 'Ready' | 'Offline';
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

