
import { Movie, User, Group } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Marcus', avatar: 'https://picsum.photos/seed/marcus/100/100', status: 'Online', role: 'Admin' },
  { id: 'u2', name: 'Sarah', avatar: 'https://picsum.photos/seed/sarah/100/100', status: 'Ready', role: 'Editor' },
  { id: 'u3', name: 'Jason', avatar: 'https://picsum.photos/seed/jason/100/100', status: 'Offline', role: 'Viewer' },
];

export const MOCK_MOVIES: Movie[] = [
  {
    id: 'm1',
    title: 'Dune: Part Two',
    poster: 'https://picsum.photos/seed/dune/400/600',
    year: 2024,
    runtime: '2h 46m',
    genre: ['Sci-Fi', 'Adventure'],
    priority: 'High',
    status: 'Watchlist',
    votes: 8,
    seenBy: ['u1'],
    availability: ['Max', 'Apple TV']
  },
  {
    id: 'm2',
    title: 'Poor Things',
    poster: 'https://picsum.photos/seed/poor/400/600',
    year: 2023,
    runtime: '2h 21m',
    genre: ['Comedy', 'Drama'],
    priority: 'Medium',
    status: 'Ongoing',
    votes: 5,
    seenBy: ['u2'],
    availability: ['Hulu']
  },
  {
    id: 'm3',
    title: 'Past Lives',
    poster: 'https://picsum.photos/seed/past/400/600',
    year: 2023,
    runtime: '1h 45m',
    genre: ['Romance', 'Drama'],
    priority: 'Low',
    status: 'Watchlist',
    votes: 3,
    seenBy: [],
    availability: ['Netflix', 'Prime']
  }
];

export const MOCK_GROUP: Group = {
  id: 'g1',
  name: 'Saturday Night Cinephiles',
  members: MOCK_USERS,
  budgetHours: 40,
  usedHours: 31
};
