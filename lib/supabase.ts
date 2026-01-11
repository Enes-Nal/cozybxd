import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase client (using SSR for better Next.js 16 compatibility)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (for admin operations)
// Using service role bypasses RLS, which is appropriate for server-side admin operations
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Database helper functions
export const db = {
  // Teams
  async getTeamsByUserId(userId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        team_members!inner(
          *,
          users(*)
        )
      `)
      .eq('team_members.user_id', userId);
    
    if (error) throw error;
    return data;
  },

  async createTeam(teamData: { name: string; description?: string; inviteCode: string; userId: string }) {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamData.name,
        description: teamData.description,
        invite_code: teamData.inviteCode,
      })
      .select()
      .single();

    if (teamError) throw teamError;

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: teamData.userId,
        role: 'admin',
      });

    if (memberError) throw memberError;

    return team;
  },

  async getTeamById(teamId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        team_members(
          *,
          users(*)
        ),
        logs(
          *,
          media(*),
          log_attendees(
            *,
            users(*)
          ),
          reviews(
            *,
            users(*)
          )
        ),
        watchlist_items(
          *,
          media(*)
        )
      `)
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  },

  async createLog(logData: {
    teamId: string;
    mediaId: string;
    notes?: string;
    isRobloxNight?: boolean;
    watchedAt?: Date;
    attendees: string[];
  }) {
    const { data: log, error: logError } = await supabase
      .from('logs')
      .insert({
        team_id: logData.teamId,
        media_id: logData.mediaId,
        notes: logData.notes,
        is_roblox_night: logData.isRobloxNight || false,
        watched_at: logData.watchedAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;

    // Create attendees
    if (logData.attendees.length > 0) {
      const attendees = logData.attendees.map(userId => ({
        log_id: log.id,
        user_id: userId,
        slept: false,
      }));

      const { error: attendeesError } = await supabase
        .from('log_attendees')
        .insert(attendees);

      if (attendeesError) throw attendeesError;
    }

    // Create view count
    await supabase
      .from('view_counts')
      .insert({
        media_id: logData.mediaId,
      });

    return log;
  },
};
