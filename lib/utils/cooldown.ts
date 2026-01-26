import { createServerClient } from '@/lib/supabase';

/**
 * Action types that can have cooldowns
 */
export type ActionType =
  | 'create_team'
  | 'send_friend_request'
  | 'join_team'
  | 'create_review'
  | 'create_review_reply'
  | 'invite_user';

/**
 * Cooldown durations in seconds for each action type
 */
const COOLDOWN_DURATIONS: Record<ActionType, number> = {
  create_team: 60, // 1 minute between creating teams
  send_friend_request: 30, // 30 seconds between friend requests
  join_team: 10, // 10 seconds between joining teams
  create_review: 10, // 10 seconds between creating reviews
  create_review_reply: 5, // 5 seconds between review replies
  invite_user: 15, // 15 seconds between inviting users
};

/**
 * Checks if a user can perform an action based on cooldown rules
 * @param userId The user ID
 * @param actionType The type of action being performed
 * @returns Object with `allowed` boolean and `remainingSeconds` if not allowed
 */
export async function checkCooldown(
  userId: string,
  actionType: ActionType
): Promise<{ allowed: boolean; remainingSeconds?: number }> {
  const supabase = createServerClient();
  const cooldownDuration = COOLDOWN_DURATIONS[actionType];

  // Get the last action time for this user and action type
  const { data: cooldown, error } = await supabase
    .from('user_action_cooldowns')
    .select('last_action_at')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is fine
    console.error('Error checking cooldown:', error);
    // On error, allow the action (fail open)
    return { allowed: true };
  }

  if (!cooldown) {
    // No previous action, allow it
    return { allowed: true };
  }

  const lastActionTime = new Date(cooldown.last_action_at);
  const now = new Date();
  const timeSinceLastAction = (now.getTime() - lastActionTime.getTime()) / 1000; // seconds
  const remainingSeconds = cooldownDuration - timeSinceLastAction;

  if (remainingSeconds > 0) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil(remainingSeconds),
    };
  }

  // Cooldown has passed, allow the action
  return { allowed: true };
}

/**
 * Records that a user has performed an action (updates or creates cooldown record)
 * @param userId The user ID
 * @param actionType The type of action being performed
 */
export async function recordAction(
  userId: string,
  actionType: ActionType
): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  // Upsert the cooldown record
  const { error } = await supabase
    .from('user_action_cooldowns')
    .upsert(
      {
        user_id: userId,
        action_type: actionType,
        last_action_at: now,
        updated_at: now,
      },
      {
        onConflict: 'user_id,action_type',
      }
    );

  if (error) {
    console.error('Error recording action:', error);
    // Don't throw - this is not critical enough to fail the request
  }
}

/**
 * Gets a user-friendly error message for cooldown violations
 * @param actionType The type of action
 * @param remainingSeconds The remaining seconds in the cooldown
 * @returns Error message string
 */
export function getCooldownErrorMessage(
  actionType: ActionType,
  remainingSeconds: number
): string {
  const actionNames: Record<ActionType, string> = {
    create_team: 'create a group',
    send_friend_request: 'send a friend request',
    join_team: 'join a group',
    create_review: 'create a review',
    create_review_reply: 'reply to a review',
    invite_user: 'invite a user',
  };

  const actionName = actionNames[actionType];
  const timeText =
    remainingSeconds < 60
      ? `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
      : `${Math.ceil(remainingSeconds / 60)} minute${Math.ceil(remainingSeconds / 60) !== 1 ? 's' : ''}`;

  return `Please wait ${timeText} before you can ${actionName} again.`;
}

