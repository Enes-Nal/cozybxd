import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { createServerClient } from '@/lib/supabase';
import type { NextRequest } from 'next/server';

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
      authorization: {
        params: {
          scope: 'identify email',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('[AUTH] Sign in callback invoked:', { 
          email: user?.email, 
          provider: account?.provider,
          hasAccount: !!account,
          accountType: account?.type,
          userId: user?.id
        });

        // The signIn callback is only called after OAuth returns
        // Account should always be present after OAuth completes
        if (!account) {
          console.error('[AUTH] No account object after OAuth - this should not happen');
          return false;
        }

        // Enforce Discord-only authentication
        if (account.provider !== 'discord') {
          console.error('[AUTH] Sign in failed: Only Discord authentication is allowed', { provider: account.provider });
          return false;
        }

        if (!user?.email) {
          console.error('[AUTH] Sign in failed: No email provided', { user });
          return false;
        }

        console.log('[AUTH] Creating Supabase client...');
        let supabase;
        try {
          supabase = createServerClient();
        } catch (supabaseError) {
          console.error('[AUTH] Failed to create Supabase client:', supabaseError);
          if (supabaseError instanceof Error) {
            console.error('[AUTH] Supabase error message:', supabaseError.message);
          }
          // Don't fail sign-in if Supabase client creation fails - might be env var issue
          // But we can't proceed without it, so return false
          return false;
        }
        
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
          console.error('[AUTH] Error details:', {
            message: userCheckError.message,
            code: userCheckError.code,
            details: userCheckError.details,
            hint: userCheckError.hint
          });
          return false;
        }

        console.log('[AUTH] User check result:', { exists: !!existingUser, userId: existingUser?.id });

        // LOGIN: If user exists, allow sign-in immediately (don't block on account update)
        if (existingUser) {
          console.log('[AUTH] LOGIN: Existing user found, allowing sign-in immediately');
          
          // Update account and username asynchronously (fire and forget) - don't wait for it
          if (account) {
            // Use IIFE to run async operation in background
            (async () => {
              try {
                // Update account
                const { error: accountError } = await supabase
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
                  });

                if (accountError) {
                  console.error('[AUTH] Background account update error:', JSON.stringify(accountError, null, 2));
                } else {
                  console.log('[AUTH] Background account update successful');
                }

                // Update username from Discord if user doesn't have one
                const discordUsername = (profile as any)?.username;
                if (discordUsername) {
                  // Check if user already has a username
                  const { data: currentUser } = await supabase
                    .from('users')
                    .select('username')
                    .eq('id', existingUser.id)
                    .single();

                  // Only update if username is not set
                  if (!currentUser?.username) {
                    const { error: usernameError } = await supabase
                      .from('users')
                      .update({ username: discordUsername.toLowerCase() })
                      .eq('id', existingUser.id);

                    if (usernameError) {
                      console.error('[AUTH] Background username update error:', JSON.stringify(usernameError, null, 2));
                    } else {
                      console.log('[AUTH] Background username update successful:', discordUsername);
                    }
                  }
                }
              } catch (err) {
                console.error('[AUTH] Background account/username update exception:', err);
              }
            })();
          }
          
          console.log('[AUTH] LOGIN: Sign in successful for existing user!');
          return true;
        }

        // SIGN-UP: Create new user if they don't exist
        else {
          console.log('[AUTH] SIGN-UP: Creating new user...');
          
          // Extract Discord username from profile (but don't set it yet - user will be prompted)
          const discordUsername = (profile as any)?.username;
          
          console.log('[AUTH] Discord username from profile:', discordUsername);
          
          // Create user without username - they'll be prompted to set it
          const { data: newUser, error: createUserError } = await supabase
            .from('users')
            .insert({
              email: user.email,
              name: user.name,
              image: user.image,
              username: null, // Don't set username initially - user will be prompted
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

          console.log('[AUTH] User created successfully:', { userId: newUser.id, username: usernameToSet });

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

// NextAuth v4 App Router - pass params correctly
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params;
  // NextAuth v4 expects the route segments
  return handler(req, { params } as any);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params;
  return handler(req, { params } as any);
}
