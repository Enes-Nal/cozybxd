import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { createServerClient } from '@/lib/supabase';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // Explicitly set the base URL for OAuth callbacks
  url: process.env.NEXTAUTH_URL,
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

        if (!existingUser) {
          // Create new user
          console.log('[AUTH] Creating new user...');
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
        } else if (account) {
          // Update account info - upsert will use the unique constraint on provider,provider_account_id
          console.log('[AUTH] Updating account record...');
          const { error: accountError } = await supabase
            .from('accounts')
            .upsert({
              user_id: existingUser.id,
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
            console.error('[AUTH] Error updating account:', JSON.stringify(accountError, null, 2));
            return false;
          }
          console.log('[AUTH] Account updated successfully');
        }

        console.log('[AUTH] Sign in successful!');
        return true;
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

export { handler as GET, handler as POST };
