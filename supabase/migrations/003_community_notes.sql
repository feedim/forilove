-- =====================================================
-- FEEDIM - Topluluk Notlari (Community Notes)
-- Twitter-benzeri kisa mesaj sistemi
-- Tarih: 2026-02-20
-- =====================================================


-- =====================================================
-- 1. TOPLULUK NOTLARI
-- =====================================================
CREATE TABLE public.community_notes (
  id BIGSERIAL PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
  images JSONB DEFAULT '[]'::jsonb,

  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'moderation', 'removed')),

  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  spam_score REAL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_notes_author ON community_notes(author_id);
CREATE INDEX idx_community_notes_status ON community_notes(status) WHERE status = 'published';
CREATE INDEX idx_community_notes_created ON community_notes(created_at DESC) WHERE status = 'published';


-- =====================================================
-- 2. NOT ETIKETLERI (mevcut tags tablosu FK)
-- =====================================================
CREATE TABLE public.note_tags (
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);


-- =====================================================
-- 3. NOT BEGENILERI
-- =====================================================
CREATE TABLE public.note_likes (
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, note_id)
);

CREATE INDEX idx_note_likes_note ON note_likes(note_id);


-- =====================================================
-- 4. NOT KAYDEDILENLER
-- =====================================================
CREATE TABLE public.note_bookmarks (
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, note_id)
);

CREATE INDEX idx_note_bookmarks_user ON note_bookmarks(user_id);


-- =====================================================
-- 5. NOT YANITLARI
-- =====================================================
CREATE TABLE public.note_replies (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  content TEXT NOT NULL CHECK (char_length(content) <= 500),

  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'removed')),
  like_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_note_replies_note ON note_replies(note_id);
CREATE INDEX idx_note_replies_author ON note_replies(author_id);


-- =====================================================
-- 6. NOT GORUNTULEMELERI
-- =====================================================
CREATE TABLE public.note_views (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES community_notes(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, viewer_id)
);

CREATE INDEX idx_note_views_note ON note_views(note_id);


-- =====================================================
-- COUNTER TRIGGERS
-- =====================================================

-- Not begeni sayaci
CREATE OR REPLACE FUNCTION update_note_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_notes SET like_count = like_count + 1 WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_notes SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.note_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_like_count
  AFTER INSERT OR DELETE ON note_likes
  FOR EACH ROW EXECUTE FUNCTION update_note_like_count();

-- Not kaydetme sayaci
CREATE OR REPLACE FUNCTION update_note_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_notes SET save_count = save_count + 1 WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_notes SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.note_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_save_count
  AFTER INSERT OR DELETE ON note_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_note_save_count();

-- Not yanit sayaci
CREATE OR REPLACE FUNCTION update_note_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE community_notes SET reply_count = reply_count + 1 WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE community_notes SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.note_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_reply_count
  AFTER INSERT OR DELETE ON note_replies
  FOR EACH ROW EXECUTE FUNCTION update_note_reply_count();

-- Not goruntulenme sayaci
CREATE OR REPLACE FUNCTION update_note_view_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_notes SET view_count = view_count + 1 WHERE id = NEW.note_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_view_count
  AFTER INSERT ON note_views
  FOR EACH ROW EXECUTE FUNCTION update_note_view_count();


-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE community_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_views ENABLE ROW LEVEL SECURITY;

-- Community Notes
CREATE POLICY "community_notes_select" ON community_notes FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "community_notes_insert" ON community_notes FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "community_notes_delete" ON community_notes FOR DELETE
  USING (auth.uid() = author_id);

-- Note Tags
CREATE POLICY "note_tags_select" ON note_tags FOR SELECT USING (true);
CREATE POLICY "note_tags_insert" ON note_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM community_notes WHERE id = note_id AND author_id = auth.uid()));
CREATE POLICY "note_tags_delete" ON note_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM community_notes WHERE id = note_id AND author_id = auth.uid()));

-- Note Likes
CREATE POLICY "note_likes_select" ON note_likes FOR SELECT USING (true);
CREATE POLICY "note_likes_insert" ON note_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_likes_delete" ON note_likes FOR DELETE USING (auth.uid() = user_id);

-- Note Bookmarks
CREATE POLICY "note_bookmarks_select" ON note_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "note_bookmarks_insert" ON note_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_bookmarks_delete" ON note_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Note Replies
CREATE POLICY "note_replies_select" ON note_replies FOR SELECT
  USING (status = 'approved' OR auth.uid() = author_id);
CREATE POLICY "note_replies_insert" ON note_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "note_replies_delete" ON note_replies FOR DELETE USING (auth.uid() = author_id);

-- Note Views
CREATE POLICY "note_views_select" ON note_views FOR SELECT USING (true);
CREATE POLICY "note_views_insert" ON note_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);


-- =====================================================
-- NOTIFICATION TYPE GUNCELLEME
-- Mevcut constraint'e note_like ve note_reply ekle
-- =====================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'like', 'comment', 'reply', 'mention', 'follow',
  'follow_request', 'follow_accepted',
  'first_post', 'comeback_post', 'milestone',
  'coin_earned', 'gift_received', 'premium_expired',
  'premium_activated', 'premium_cancelled',
  'system',
  'note_like', 'note_reply'
));
