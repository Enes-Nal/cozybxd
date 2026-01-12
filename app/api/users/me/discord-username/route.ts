import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Get Discord account for the user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('provider_account_id')
      .eq('user_id', session.user.id)
      .eq('provider', 'discord')
      .maybeSingle();

    if (accountError) {
      console.error('Error fetching Discord account:', accountError);
      // Fallback to session user name
      return NextResponse.json({ 
        username: session.user.name || null 
      });
    }

    // For Discord, the provider_account_id is the Discord user ID
    // We can't get the username from just the ID without calling Discord API
    // So we'll fallback to session.user.name which should be the Discord username
    return NextResponse.json({ 
      username: session.user.name || null 
    });
  } catch (error) {
    console.error('Error in discord-username endpoint:', error);
    // Fallback to session user name
    return NextResponse.json({ 
      username: session.user.name || null 
    });
  }
}

