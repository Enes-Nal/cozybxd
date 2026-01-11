'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';

function SignInContent() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const error = searchParams?.get('error');
  const callbackUrl = searchParams?.get('callbackUrl') || '/';

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setIsLoadingProviders(true);
        setProviderError(null);
        const res = await getProviders();
        console.log('Providers fetched:', res);
        setProviders(res);
      } catch (err) {
        console.error('Error fetching providers:', err);
        setProviderError('Failed to load sign-in options');
      } finally {
        setIsLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  const handleSignIn = async (providerId: string) => {
    setIsLoading(providerId);
    try {
      await signIn(providerId, { callbackUrl });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-main">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 space-y-6 border-main">
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <Logo size="md" />
            </div>
            <h1 className="text-2xl font-black mb-2 text-main">Sign in</h1>
            <p className="text-sm text-gray-500">Continue to cozybxd</p>
          </div>

          {error && (
            <div className="glass border-red-500/50 bg-red-500/10 rounded-xl p-3">
              <p className="text-sm text-red-500">
                An error occurred during sign in. Please try again.
              </p>
            </div>
          )}

          {providerError && (
            <div className="glass border-red-500/50 bg-red-500/10 rounded-xl p-3">
              <p className="text-sm text-red-500">{providerError}</p>
            </div>
          )}

          <div className="space-y-3">
            {isLoadingProviders ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Loading sign-in options...</p>
              </div>
            ) : providers && Object.keys(providers).length > 0 ? (
              Object.values(providers).map((provider: any) => {
                const isProviderLoading = isLoading === provider.id;
                return (
                  <button
                    key={provider.name}
                    onClick={() => handleSignIn(provider.id)}
                    disabled={isProviderLoading}
                    className="w-full px-4 py-3 rounded-xl font-bold bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isProviderLoading ? 'Signing in...' : `Sign in with ${provider.name}`}
                  </button>
                );
              })
            ) : (
              // Fallback: Show Discord button directly if providers fail to load
              <button
                onClick={() => handleSignIn('discord')}
                disabled={!!isLoading}
                className="w-full px-4 py-3 rounded-xl font-bold bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isLoading === 'discord' ? 'Signing in...' : 'Sign in with Discord'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-main">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 space-y-6 border-main">
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <Logo size="md" />
              </div>
              <h1 className="text-2xl font-black mb-2 text-main">Sign in</h1>
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
