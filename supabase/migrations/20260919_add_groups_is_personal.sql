-- Distinguishes a personal (individual-use) group from a real multi-person
-- group at creation time. Not derived from member count, so a personal plan
-- nobody has joined yet is distinguishable from a group whose only other
-- member left. UI should compute "show group chrome" as
-- `NOT is_personal OR member_count > 1`, so inviting someone to a personal
-- plan naturally upgrades its presentation without touching this flag.
ALTER TABLE groups
  ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false;
