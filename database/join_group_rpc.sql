-- RPC function to join a group by invite code
-- Needed because RLS on groups table prevents non-members from seeing groups
-- This runs as SECURITY DEFINER (bypasses RLS) to look up the invite code

CREATE OR REPLACE FUNCTION join_group_by_code(code TEXT, joining_user_id UUID)
RETURNS UUID AS $$
DECLARE
  found_group_id UUID;
  existing_member RECORD;
BEGIN
  -- Find the group by invite code
  SELECT id INTO found_group_id
  FROM groups
  WHERE invite_code = code;

  IF found_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if user is already a member
  SELECT * INTO existing_member
  FROM group_members
  WHERE group_id = found_group_id
  AND user_id = joining_user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_active THEN
      RAISE EXCEPTION 'You are already in this group';
    ELSE
      -- Reactivate membership
      UPDATE group_members
      SET is_active = true
      WHERE group_id = found_group_id
      AND user_id = joining_user_id;
    END IF;
  ELSE
    -- Insert new membership
    INSERT INTO group_members (group_id, user_id)
    VALUES (found_group_id, joining_user_id);
  END IF;

  RETURN found_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
