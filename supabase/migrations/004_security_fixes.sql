-- =====================================================
-- FEEDIM - Guvenlik Yamalari
-- Tarih: 2026-02-20
-- =====================================================

-- Atomic coupon increment to prevent race condition double-spend
CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id_param INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE id = coupon_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note views table (if not already created via 003)
CREATE TABLE IF NOT EXISTS note_views (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, viewer_id)
);

-- View count column
ALTER TABLE community_notes ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Note view count trigger
CREATE OR REPLACE FUNCTION update_note_view_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_notes SET view_count = view_count + 1 WHERE id = NEW.note_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_note_view_count ON note_views;
CREATE TRIGGER trigger_note_view_count
  AFTER INSERT ON note_views
  FOR EACH ROW EXECUTE FUNCTION update_note_view_count();

-- RLS for note_views
ALTER TABLE note_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "note_views_select" ON note_views FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "note_views_insert" ON note_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
