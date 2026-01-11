import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { createServerClient } from '@/lib/supabase';

// Normalize NEXTAUTH_URL to remove trailing slashes BEFORE NextAuth reads it
// This ensures NextAuth uses the correct base URL even if there's a trailing slash in Vercel
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/+$/, '');
}

const nextAuthUrl = process.env.NEXTAUTH_URL;

// Log configuration on startup (only in server environment)
if (typeof window === 'undefined') {
  console.log('[AUTH CONFIG] NEXTAUTH_URL:', nextAuthUrl || 'NOT SET');
  console.log('[AUTH CONFIG] Expected redirect URI:', 
    nextAuthUrl 
      ? `${nextAuthUrl}/api/auth/callback/discord`
      : 'NOT SET - NEXTAUTH_URL is missing'
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'production', // Enable debug in production to see redirect URI
  pages: {
    signIn: '/api/auth/signin',
    error: '/api/auth/error',
  },
  providers: [
    // Discord provider - mandatory
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('[AUTH] Sign in attempt:', { 
          email: user.email, 
          provider: account?.provider,
          hasAccount: !!account 
        });

        // Enforce Discord-only authentication
        if (account?.provider !== 'discord') {
          console.error('[AUTH] Sign in failed: Only Discord authentication is allowed');
          return false;
        }

        if (!user.email) {
          console.error('[AUTH] Sign in failed: No email provided');
          return false;
        }

        console.log('[AUTH] Creating Supabase client...');
        const supabase = createServerClient();
        
        // Check if user exists, if not create them
        console.log('[AUTH] Checking for existing user...');
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();

        // If there's an error other than "not found", fail the sign-in
        if (userCheckError) {
          console.error('[AUTH] Error checking for existing user:', JSON.stringify(userCheckError, null, 2));
          return false;
        }

        console.log('[AUTH] User check result:', { exists: !!existingUser, userId: existingUser?.id });

        // LOGIN: If user exists, allow sign-in immediately (don't block on account update)
        if (existingUser) {
          console.log('[AUTH] LOGIN: Existing user found, allowing sign-in immediately');
          
          // Update account asynchronously (fire and forget) - don't wait for it
          if (account) {
            // Don't await - let it run in background
            supabase
              .from('accounts')
              .upsert({
                user_id: existingUser.id,
                type: account.type,
                provider: account.provider,
                provider_account_id: account.providerAccountId,
                access_token: account.access_token || null,
                refresh_token: account.refresh_token || null,
                expires_at: account.expires_at || null,
                token_type: account.token_type || null,
                scope: account.scope || null,
                id_token: account.id_token || null,
              }, {
                onConflict: 'provider,provider_account_id',
              })
              .then(({ error }) => {
                if (error) {
                  console.error('[AUTH] Background account update error:', JSON.stringify(error, null, 2));
                } else {
                  console.log('[AUTH] Background account update successful');
                }
              })
              .catch((err) => {
                console.error('[AUTH] Background account update exception:', err);
              });
          }
          
          console.log('[AUTH] LOGIN: Sign in successful for existing user!');
          return true;
        }

        // SIGN-UP: Create new user if they don't exist
        else {
          console.log('[AUTH] SIGN-UP: Creating new user...');
          const { data: newUser, error: createUserError } = await supabase
            .from('users')
            .insert({
              email: user.email,
              name: user.name,
              image: user.image,
            })
            .select()
            .single();

          if (createUserError) {
            console.error('[AUTH] Error creating user:', JSON.stringify(createUserError, null, 2));
            return false;
          }

          if (!newUser) {
            console.error('[AUTH] User creation returned no data');
            return false;
          }

          console.log('[AUTH] User created successfully:', { userId: newUser.id });

          // Store account info
          if (account) {
            console.log('[AUTH] Creating account record...');
            const { error: accountError } = await supabase
              .from('accounts')
              .insert({
                user_id: newUser.id,
                type: account.type,
                provider: account.provider,
                provider_account_id: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              });

            if (accountError) {
              console.error('[AUTH] Error creating account:', JSON.stringify(accountError, null, 2));
              return false;
            }
            console.log('[AUTH] Account created successfully');
          }

          console.log('[AUTH] SIGN-UP: Sign in successful for new user!');
          return true;
        }
      } catch (error) {
        console.error('[AUTH] Unexpected error in signIn callback:', error);
        if (error instanceof Error) {
          console.error('[AUTH] Error stack:', error.stack);
        }
        return false;
      }
    },
    async session({ session, token }) {
      if (session?.user?.email) {
        try {
          const supabase = createServerClient();
          const { data: user, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .maybeSingle();

          if (error) {
            console.error('Error fetching user in session callback:', error);
          } else if (user && session.user) {
            (session.user as any).id = user.id;
          }
        } catch (error) {
          console.error('Unexpected error in session callback:', error);
        }
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

// Wrap handlers to ensure NEXTAUTH_URL is used for redirect URI construction
export async function GET(request: Request) {
  // Ensure NEXTAUTH_URL is set and normalized for this request
  if (nextAuthUrl) {
    // NextAuth will use this from process.env, which we've already normalized
    // But we also need to ensure the request context knows about it
    const url = new URL(request.url);
    // If NEXTAUTH_URL is set, ensure we're using it
    if (nextAuthUrl && !url.origin.includes(nextAuthUrl.replace(/^https?:\/\//, ''))) {
      // Log for debugging
      console.log('[AUTH REQUEST] Using NEXTAUTH_URL:', nextAuthUrl);
      console.log('[AUTH REQUEST] Request origin:', url.origin);
    }
  }
  return handler(request);
}

export async function POST(request: Request) {
  // Same as GET
  if (nextAuthUrl) {
    const url = new URL(request.url);
    if (nextAuthUrl && !url.origin.includes(nextAuthUrl.replace(/^https?:\/\//, ''))) {
      console.log('[AUTH REQUEST] Using NEXTAUTH_URL:', nextAuthUrl);
      console.log('[AUTH REQUEST] Request origin:', url.origin);
    }
  }
  return handler(request);
}
