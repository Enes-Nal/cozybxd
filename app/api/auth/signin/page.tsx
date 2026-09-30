'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import { getTrendingMovies, getPosterUrl, type TMDBMovie } from '@/lib/api/tmdb';

type Mode = 'signin' | 'signup';
type ProviderId = 'google' | 'discord';

const LAST_PROVIDER_KEY = 'lastSignInProvider';

const readLastProvider = (): ProviderId | null => {
  try {
    const saved = localStorage.getItem(LAST_PROVIDER_KEY);
    return saved === 'google' || saved === 'discord' ? saved : null;
  } catch {
    return null;
  }
};
const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const PROVIDERS: { id: ProviderId; name: string; icon: React.ReactNode; className: string }[] = [
  {
    id: 'google',
    name: 'Google',
    icon: <GoogleIcon />,
    className: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: <DiscordIcon />,
    className: 'bg-[#5865F2] text-white border border-[#5865F2] hover:bg-[#4752C4]',
  },
];

const FEATURES = [
  { icon: 'fa-users', title: 'Build your crew', text: 'Start a group and share one watchlist with friends.' },
  { icon: 'fa-check-to-slot', title: 'Vote on movie night', text: 'Upvote, swipe and settle what to watch next.' },
  { icon: 'fa-clock-rotate-left', title: 'Keep the history', text: 'Log what you watched together and review it.' },
];

// NextAuth error codes -> friendly copy
const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "We couldn't start sign-in with that provider. Please try again.",
  OAuthCallback: 'Something went wrong on the way back from the provider. Please try again.',
  OAuthCreateAccount: "We couldn't create your account. Please try again.",
  OAuthAccountNotLinked: 'That email is already linked to another sign-in method. Use the one you signed up with.',
  Callback: 'Sign-in was interrupted. Please try again.',
  AccessDenied: "Access was denied. If you're using Google, make sure your email is verified.",
  SessionRequired: 'Please sign in to continue.',
};

function PosterWall() {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);

  useEffect(() => {
    getTrendingMovies()
      .then((results) => setMovies(results.filter((m) => m.poster_path).slice(0, 18)))
      .catch(() => setMovies([]));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {movies.length > 0 && (
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 p-3 -rotate-6 scale-125 origin-center opacity-60">
          {[...movies, ...movies].slice(0, 24).map((movie, i) => (
            <img
              key={`${movie.id}-${i}`}
              src={getPosterUrl(movie.poster_path)}
              alt=""
              loading="lazy"
              className="w-full aspect-[2/3] object-cover rounded-md"
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/70 to-[var(--bg-color)]/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--bg-color)]" />
    </div>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams?.get('mode') === 'signup' ? 'signup' : 'signin');
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);
  const lastProvider = useSyncExternalStore(subscribeToStorage, readLastProvider, () => null);
  const error = searchParams?.get('error');
  const callbackUrl = searchParams?.get('callbackUrl') || '/';
  const isSignup = mode === 'signup';

  const switchMode = (next: Mode) => {
    setMode(next);
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('error');
    if (next === 'signup') params.set('mode', 'signup');
    else params.delete('mode');
    const query = params.toString();
    router.replace(`/api/auth/signin${query ? `?${query}` : ''}`, { scroll: false });
  };

  const handleSignIn = async (providerId: ProviderId) => {
    setLoadingProvider(providerId);
    try {
      localStorage.setItem(LAST_PROVIDER_KEY, providerId);
    } catch {
      // ignore
    }
    try {
      await signIn(providerId, { callbackUrl });
    } catch (err) {
      console.error('Sign in error:', err);
      setLoadingProvider(null);
    }
  };

  const errorMessage = error ? ERROR_MESSAGES[error] || 'An error occurred during sign in. Please try again.' : null;

  return (
    <div className="min-h-screen flex bg-main text-main">
      {/* Left: cinematic panel */}
      <aside className="hidden lg:flex relative w-1/2 flex-col justify-end p-12 overflow-hidden border-r border-main">
        <PosterWall />
        <div className="relative z-10 max-w-md space-y-6 page-transition">
          <h2 className="text-4xl font-black leading-tight">
            Movie night,
            <br />
            <span className="text-accent">decided together.</span>
          </h2>
          <ul className="space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-4 items-start">
                <span className="w-10 h-10 shrink-0 rounded-full glass flex items-center justify-center text-accent">
                  <i className={`fa-solid ${feature.icon}`} />
                </span>
                <div>
                  <p className="font-bold">{feature.title}</p>
                  <p className="text-sm text-gray-400">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: auth card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md page-transition" key={mode}>
          <div className="flex justify-center mb-8">
            <Logo size="md" />
          </div>

          <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
            {/* Mode switch */}
            <div className="grid grid-cols-2 p-1 rounded-full bg-black/20 border border-main" role="tablist">
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-full py-2 text-sm font-bold transition-all ${
                    mode === m ? 'bg-accent text-white shadow' : 'text-gray-400 hover:text-main'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black">{isSignup ? 'Join cozybxd' : 'Welcome back'}</h1>
              <p className="text-sm text-gray-400">
                {isSignup
                  ? 'Create a free account in one click. No new password needed.'
                  : 'Sign in to get back to your groups and watchlists.'}
              </p>
            </div>

            {errorMessage && (
              <div className="flex gap-3 items-start border border-red-500/40 bg-red-500/10 rounded-xl p-3" role="alert">
                <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5" />
                <p className="text-sm text-red-400">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const isLoading = loadingProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSignIn(provider.id)}
                    disabled={!!loadingProvider}
                    className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-bold text-sm sm:text-base whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${provider.className}`}
                  >
                    {isLoading ? <i className="fa-solid fa-spinner fa-spin w-5" /> : provider.icon}
                    <span>
                      {isLoading
                        ? 'Redirecting…'
                        : `${isSignup ? 'Sign up' : 'Continue'} with ${provider.name}`}
                    </span>
                    {lastProvider === provider.id && !isLoading && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-accent text-white">
                        Last used
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {isSignup ? (
              <div className="space-y-3 pt-2 border-t border-main">
                <p className="text-xs text-gray-400 flex gap-2 pt-4">
                  <i className="fa-solid fa-at text-accent mt-0.5" />
                  You&apos;ll pick your cozybxd username right after signing up.
                </p>
                <p className="text-xs text-gray-400 flex gap-2">
                  <i className="fa-solid fa-shield-halved text-accent mt-0.5" />
                  We only use your name, email and profile picture. We never post on your behalf.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center pt-2">
                Signed up with Google or Discord before? Use the same one to reach your account.
              </p>
            )}
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            {isSignup ? 'Already have an account? ' : 'New to cozybxd? '}
            <button
              onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
              className="text-accent font-bold hover:underline rounded-none"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-main">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-500" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
