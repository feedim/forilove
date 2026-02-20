-- Shadow ban kolonları
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shadow_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shadow_banned_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shadow_banned_by UUID REFERENCES profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shadow_banned ON profiles(shadow_banned) WHERE shadow_banned = TRUE;

-- moderation_logs constraint güncelle (shadow_ban + eksik action'lar)
ALTER TABLE moderation_logs DROP CONSTRAINT IF EXISTS moderation_logs_action_check;
ALTER TABLE moderation_logs ADD CONSTRAINT moderation_logs_action_check CHECK (action IN (
  'approve_post','remove_post','archive_post',
  'approve_comment','remove_comment',
  'warn_user','mute_user','ban_user','unban_user',
  'verify_user','unverify_user',
  'grant_premium','revoke_premium',
  'change_role','dismiss_report','resolve_report',
  'shadow_ban','unshadow_ban',
  'freeze_user','unfreeze_user','delete_user','moderation_user',
  'approve_withdrawal','reject_withdrawal'
));

-- Rate limit hit sorgusu için index
CREATE INDEX IF NOT EXISTS idx_security_events_rate_limit
  ON security_events(user_id, created_at DESC)
  WHERE event_type = 'rate_limit_hit';
