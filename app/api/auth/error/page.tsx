'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const { title, message } = (() => {
    switch (error) {
      case 'DatabaseUnavailable':
        return {
          title: "We're having trouble",
          message: "We couldn't reach our servers to sign you in. This is on our end, not yours. Please try again in a few minutes.",
        };
      case 'AccountCreationFailed':
        return {
          title: "Couldn't create your account",
          message: 'Something went wrong while setting up your new account. Please try again.',
        };
      case 'EmailNotVerified':
        return {
          title: 'Email not verified',
          message: 'Your Google account email needs to be verified before you can sign in with it.',
        };
      case 'NoEmail':
        return {
          title: 'No email address',
          message: "We didn't get an email address from that provider, which we need to set up your account.",
        };
      case 'OAuthCallback':
      case 'OAuthSignin':
      case 'Callback':
        return {
          title: 'Sign-in interrupted',
          message: 'The sign-in didn\'t finish. Please try again.',
        };
      case 'Configuration':
        return { title: 'Something went wrong', message: 'There is a problem with the server configuration.' };
      case 'AccessDenied':
        return { title: 'Access Denied', message: 'You do not have permission to sign in.' };
      case 'Verification':
        return { title: 'Link expired', message: 'The verification token has expired or has already been used.' };
      default:
        return { title: 'Something went wrong', message: 'An error occurred during sign in. Please try again.' };
    }
  })();

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
            <h1 className="text-2xl font-black mb-2 text-main">{title}</h1>
            <p className="text-sm text-gray-500">{message}</p>
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

