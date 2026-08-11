// Supabase Edge Function: send-daily-reminders
// Schedule: */15 * * * * (every 15 minutes via Supabase dashboard cron)
// Auth: set CRON_SECRET env var in Supabase dashboard; pass as Authorization: Bearer <secret>
// Deploy: supabase functions deploy send-daily-reminders

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CRON_WINDOW_MINUTES = 15;
const EXPO_BATCH_SIZE = 100;
const MAX_GROUP_NAME_LEN = 50;
const MAX_PASSAGE_LEN = 100;

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

function sanitize(str: string, maxLen: number): string {
  return str.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen);
}

Deno.serve(async (_req) => {
  // -------------------------------------------------------------------
  // 0. Auth — reject requests missing the shared cron secret
  // -------------------------------------------------------------------
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 500 });
  }
  const authHeader = _req.headers.get('Authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const now = new Date();

  // -------------------------------------------------------------------
  // 1. Fetch all users who have opted in (push_token is set)
  // -------------------------------------------------------------------
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, push_token, preferred_notification_time, timezone')
    .not('push_token', 'is', null);

  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500 });
  }

  // -------------------------------------------------------------------
  // 2. Filter to users whose notification window matches right now
  // -------------------------------------------------------------------
  const targetUsers = (users || []).filter((user) => {
    try {
      const tz = VALID_TIMEZONES.has(user.timezone) ? user.timezone : 'UTC';
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(now);
      const localHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
      const localMinute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);

      if (!user.preferred_notification_time) return false;
      const [prefHour, prefMinute] = user.preferred_notification_time.split(':').map(Number);

      const localTotal = localHour * 60 + localMinute;
      const prefTotal = prefHour * 60 + prefMinute;
      return Math.abs(localTotal - prefTotal) < CRON_WINDOW_MINUTES / 2;
    } catch {
      return false;
    }
  });

  if (targetUsers.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // -------------------------------------------------------------------
  // 3. Fetch today's readings for all target users concurrently
  // -------------------------------------------------------------------
  const readingsPerUser = await Promise.all(
    targetUsers.map(async (user) => {
      const { data } = await supabase.rpc('get_all_todays_readings', { user_uuid: user.id });
      return { user, readings: (data || []) as any[] };
    })
  );

  // -------------------------------------------------------------------
  // 4. Batch-fetch completion + member counts for all groups at once
  // -------------------------------------------------------------------
  const allGroupIds = [
    ...new Set(
      readingsPerUser.flatMap(({ readings }) => readings.map((r) => r.group_id as string))
    ),
  ];

  if (allGroupIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // UTC yesterday for completion counts (users near midnight may see ±1 day off — acceptable for a display count)
  const utcYesterday = new Date(now);
  utcYesterday.setUTCDate(utcYesterday.getUTCDate() - 1);
  const yesterdayStr = utcYesterday.toISOString().slice(0, 10);

  const [{ data: completionRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from('reading_completions')
      .select('group_id, user_id')
      .in('group_id', allGroupIds)
      .eq('reading_date', yesterdayStr),
    supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', allGroupIds)
      .eq('is_active', true),
  ]);

  const completionsByGroup = new Map<string, number>();
  for (const row of completionRows || []) {
    completionsByGroup.set(row.group_id, (completionsByGroup.get(row.group_id) ?? 0) + 1);
  }
  const membersByGroup = new Map<string, number>();
  for (const row of memberRows || []) {
    membersByGroup.set(row.group_id, (membersByGroup.get(row.group_id) ?? 0) + 1);
  }

  // -------------------------------------------------------------------
  // 5. Build one notification message per group per user
  // -------------------------------------------------------------------
  type PushMessage = { to: string; title: string; body: string; data: object };
  const messages: (PushMessage & { userId: string })[] = [];
  const invalidUserIds: string[] = [];

  for (const { user, readings } of readingsPerUser) {
    if (readings.length === 0) continue;

    const tz = VALID_TIMEZONES.has(user.timezone) ? user.timezone : 'UTC';
    const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

    // Deduplicate by group (RPC may return multiple rows per group)
    const groupsSeen = new Map<string, { name: string; passages: string[] }>();
    for (const row of readings) {
      if (!groupsSeen.has(row.group_id)) {
        const passages = Array.isArray(row.passages) ? row.passages : [];
        if (passages.length > 0) {
          groupsSeen.set(row.group_id, { name: row.group_name, passages });
        }
      }
    }

    if (groupsSeen.size === 0) continue;

    for (const [groupId, { name, passages }] of groupsSeen) {
      const completedCount = completionsByGroup.get(groupId) ?? 0;
      const memberCount = membersByGroup.get(groupId) ?? 0;

      const safeName = sanitize(name, MAX_GROUP_NAME_LEN);
      const safePassage = sanitize(passages[0], MAX_PASSAGE_LEN);
      const passageText = safePassage + (passages.length > 1 ? ` +${passages.length - 1}` : '');

      let body = passageText;
      if (memberCount > 1) {
        body += ` · Yesterday: ${completedCount}/${memberCount}`;
      }

      messages.push({
        to: user.push_token,
        userId: user.id,
        title: `📖 ${safeName}`,
        body,
        data: { type: 'daily_reminder', date: localDateStr, group_id: groupId },
      });
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // -------------------------------------------------------------------
  // 6. Send to Expo Push API in batches of 100
  // -------------------------------------------------------------------
  // NOTE: a ticket "ok" only means Expo *accepted* the message, not that it
  // was delivered — real delivery failures (bad FCM/APNs credentials, etc.)
  // surface later via the receipts API, which this function does not yet
  // poll (see TODOS.md). Ticket-level errors below are the failures Expo
  // can detect synchronously (bad token format, DeviceNotRegistered, and
  // some credential/config errors) — logging all of them, not just
  // DeviceNotRegistered, is what previously made this pipeline undiagnosable.
  let totalAccepted = 0;
  const ticketErrors: { userId: string; error: string; message?: string }[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    // Strip internal userId before sending to Expo
    const expoBatch: PushMessage[] = batch.map(({ userId: _userId, ...msg }) => msg);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(expoBatch),
    });

    const result = await response.json();

    if (Array.isArray(result.data)) {
      for (let j = 0; j < result.data.length; j++) {
        const ticket = result.data[j];
        if (ticket.status === 'error') {
          const errorCode = ticket.details?.error ?? 'Unknown';
          ticketErrors.push({ userId: batch[j].userId, error: errorCode, message: ticket.message });
          if (errorCode === 'DeviceNotRegistered') {
            invalidUserIds.push(batch[j].userId);
          }
        } else {
          totalAccepted += 1;
        }
      }
    } else {
      console.error('send-daily-reminders: unexpected Expo push response shape', result);
    }
  }

  if (ticketErrors.length > 0) {
    // Visible in Supabase Edge Function logs — this is the diagnostic
    // signal the pipeline previously had no way to produce.
    console.error('send-daily-reminders: push ticket errors', JSON.stringify(ticketErrors));
  }

  if (invalidUserIds.length > 0) {
    await supabase
      .from('users')
      .update({ push_token: null })
      .in('id', invalidUserIds);
  }

  return new Response(
    JSON.stringify({
      sent: totalAccepted,
      attempted: messages.length,
      invalidTokensCleared: invalidUserIds.length,
      errors: ticketErrors,
    }),
    { status: 200 }
  );
});
