'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const getErrorMessage = () => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'AccessDenied':
        return 'You do not have permission to sign in.';
      case 'Verification':
        return 'The verification token has expired or has already been used.';
      default:
        return 'An error occurred during sign in. Please try again.';
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
            <div className="flex justify-center mb-2">
              <i className="fa-solid fa-circle-exclamation text-4xl text-red-500"></i>
            </div>
            <h1 className="text-2xl font-black mb-2 text-main">Access Denied</h1>
            <p className="text-sm text-gray-500">{getErrorMessage()}</p>
          </div>

          <div className="space-y-3">
            <Link
              href="/api/auth/signin"
              className="w-full px-4 py-3 rounded-xl font-bold bg-accent text-white hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-arrow-right"></i>
              <span>Try Again</span>
            </Link>
            <Link
              href="/"
              className="w-full px-4 py-3 rounded-xl font-medium glass border-main text-main hover:bg-black/[0.05] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-home"></i>
              <span>Go Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-main">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 space-y-6 border-main">
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <Logo size="md" />
              </div>
              <h1 className="text-2xl font-black mb-2 text-main">Loading...</h1>
            </div>
          </div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}

