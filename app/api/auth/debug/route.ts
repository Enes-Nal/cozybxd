import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Only allow in development or with a secret key for security
  const isDev = process.env.NODE_ENV === 'development';
  const debugKey = process.env.AUTH_DEBUG_KEY;
  const searchParams = request.nextUrl.searchParams;
  const providedKey = searchParams.get('key');

  if (!isDev && (!debugKey || providedKey !== debugKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Normalize URL (remove trailing slashes)
  const normalizedUrl = process.env.NEXTAUTH_URL?.replace(/\/+$/, '') || null;
  const redirectUri = normalizedUrl
    ? `${normalizedUrl}/api/auth/callback/discord`
    : 'NOT SET';

  return NextResponse.json({
    NEXTAUTH_URL_raw: process.env.NEXTAUTH_URL || 'NOT SET',
    NEXTAUTH_URL_normalized: normalizedUrl || 'NOT SET',
    expectedRedirectUri: redirectUri,
    hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
    hasDiscordClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    instructions: {
      step1: 'Set NEXTAUTH_URL in Vercel environment variables to: https://cozybxd.vercel.app',
      step2: `Add this exact redirect URI to Discord OAuth settings: ${redirectUri}`,
      step3: 'Redeploy on Vercel after setting environment variables',
    },
  });
}

