-- Add user-selectable accent theme preference, synced through Supabase like
-- every other per-user preference (push_token, preferred_notification_time),
-- rather than device-local AsyncStorage.
ALTER TABLE users
  ADD COLUMN theme_id text
  CHECK (theme_id IN ('sage', 'navy', 'burgundy', 'slate'));
