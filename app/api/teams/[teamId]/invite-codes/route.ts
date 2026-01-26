import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

// GET - List all invite codes for a team
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  try {
    // Check if user is admin
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        *,
        team_members(
          *,
          users(*)
        )
      `)
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const membership = team.team_members.find((m: any) => m.user_id === session.user.id);
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can view invite codes' }, { status: 403 });
    }

    // Get all invite codes for this team
    const { data: inviteCodes, error: codesError } = await supabase
      .from('team_invite_codes')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (codesError) {
      return NextResponse.json({ error: codesError.message }, { status: 500 });
    }

    return NextResponse.json(inviteCodes || []);
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invite codes' },
      { status: 500 }
    );
  }
}

// POST - Generate a new invite code
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { expirationType, maxUses } = body;

    // Check if user is admin
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        *,
        team_members(
          *,
          users(*)
        )
      `)
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const membership = team.team_members.find((m: any) => m.user_id === session.user.id);
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can generate invite codes' }, { status: 403 });
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (expirationType !== 'unlimited') {
      const now = new Date();
      switch (expirationType) {
        case '2hours':
          expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
          break;
        case '2days':
          expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
          break;
        case '2weeks':
          expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Generate a random code (6 characters, uppercase)
    const generateCode = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Ensure code is unique
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('team_invite_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    // Create the invite code
    const { data: inviteCode, error: createError } = await supabase
      .from('team_invite_codes')
      .insert({
        team_id: teamId,
        code: code,
        created_by: session.user.id,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        max_uses: maxUses || null,
        current_uses: 0,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(inviteCode);
  } catch (error) {
    console.error('Error generating invite code:', error);
    return NextResponse.json(
      { error: 'Failed to generate invite code' },
      { status: 500 }
    );
  }
}



