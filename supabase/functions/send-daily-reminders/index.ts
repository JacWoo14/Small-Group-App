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
  if (cronSecret) {
    const authHeader = _req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
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

      const [prefHour, prefMinute] = user.preferred_notification_time.split(':').map(Number);

      const localTotal = localHour * 60 + localMinute;
      const prefTotal = prefHour * 60 + prefMinute;
      return Math.abs(localTotal - prefTotal) < CRON_WINDOW_MINUTES;
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
  // 5. Build a notification message for each user
  // -------------------------------------------------------------------
  const messages: { to: string; title: string; body: string; data: object }[] = [];
  const invalidTokens: string[] = [];

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

    const lines: string[] = [];
    for (const [groupId, { name, passages }] of groupsSeen) {
      const completedCount = completionsByGroup.get(groupId) ?? 0;
      const memberCount = membersByGroup.get(groupId) ?? 0;

      const safeName = sanitize(name, MAX_GROUP_NAME_LEN);
      const safePassage = sanitize(passages[0], MAX_PASSAGE_LEN);
      const passageText = safePassage + (passages.length > 1 ? ` +${passages.length - 1}` : '');

      let line = `${safeName}: ${passageText}`;
      if (memberCount > 1) {
        line += ` · Yesterday: ${completedCount}/${memberCount}`;
      }
      lines.push(line);
    }

    if (lines.length === 0) continue;

    messages.push({
      to: user.push_token,
      title: '📖 Today\'s Reading',
      body: lines.join('\n'),
      data: { type: 'daily_reminder', date: localDateStr },
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // -------------------------------------------------------------------
  // 6. Send to Expo Push API in batches of 100
  // -------------------------------------------------------------------
  let totalSent = 0;
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    const result = await response.json();
    totalSent += batch.length;

    // Clean up stale tokens so we don't keep trying them
    if (Array.isArray(result.data)) {
      for (let j = 0; j < result.data.length; j++) {
        const ticket = result.data[j];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(batch[j].to);
        }
      }
    }
  }

  if (invalidTokens.length > 0) {
    await supabase
      .from('users')
      .update({ push_token: null })
      .in('push_token', invalidTokens);
  }

  return new Response(
    JSON.stringify({ sent: totalSent, invalidTokensCleared: invalidTokens.length }),
    { status: 200 }
  );
});
