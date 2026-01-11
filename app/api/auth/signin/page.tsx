'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const error = searchParams?.get('error');
  const callbackUrl = searchParams?.get('callbackUrl') || '/';

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border rounded-lg p-8 space-y-6 shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
            <p className="text-sm text-gray-600">Continue to CineSync</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">
                An error occurred during sign in. Please try again.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {providers &&
              Object.values(providers).map((provider: any) => {
                const isProviderLoading = isLoading === provider.id;
                return (
                  <button
                    key={provider.name}
                    onClick={() => handleSignIn(provider.id)}
                    disabled={isProviderLoading}
                    className="w-full px-4 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isProviderLoading ? 'Signing in...' : `Sign in with ${provider.name}`}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
