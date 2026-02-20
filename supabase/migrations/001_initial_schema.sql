-- =====================================================
-- FEEDIM - Tam Veritabani Kurulum SQL'i (Birlestirilmis)
-- Tum migration'lar tek dosyada
-- Supabase SQL Editor'dan calistirilacak
-- Tarih: 2026-02-18
-- =====================================================


-- =====================================================
-- 0. MEVCUT TABLOLARI TEMIZLE (yeniden kurulum icin)
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_update_profile_score ON profiles;
DROP TRIGGER IF EXISTS trigger_follow_counts ON follows;
DROP TRIGGER IF EXISTS trigger_post_count ON posts;
DROP TRIGGER IF EXISTS trigger_like_count ON likes;
DROP TRIGGER IF EXISTS trigger_save_count ON bookmarks;
DROP TRIGGER IF EXISTS trigger_share_count ON shares;
DROP TRIGGER IF EXISTS trigger_comment_count ON comments;
DROP TRIGGER IF EXISTS trigger_comment_like_count ON comment_likes;
DROP TRIGGER IF EXISTS trigger_view_counts ON post_views;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_profile_score() CASCADE;
DROP FUNCTION IF EXISTS update_follow_counts() CASCADE;
DROP FUNCTION IF EXISTS update_post_count() CASCADE;
DROP FUNCTION IF EXISTS update_like_count() CASCADE;
DROP FUNCTION IF EXISTS update_save_count() CASCADE;
DROP FUNCTION IF EXISTS update_share_count() CASCADE;
DROP FUNCTION IF EXISTS update_comment_count() CASCADE;
DROP FUNCTION IF EXISTS update_comment_like_count() CASCADE;
DROP FUNCTION IF EXISTS update_view_counts() CASCADE;

DROP TABLE IF EXISTS moderation_logs CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS profile_visits CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS coupon_usages CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS gifts CASCADE;
DROP TABLE IF EXISTS premium_payments CASCADE;
DROP TABLE IF EXISTS premium_subscriptions CASCADE;
DROP TABLE IF EXISTS premium_plans CASCADE;
DROP TABLE IF EXISTS coin_payments CASCADE;
DROP TABLE IF EXISTS coin_packages CASCADE;
DROP TABLE IF EXISTS coin_transactions CASCADE;
DROP TABLE IF EXISTS post_views CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS post_categories CASCADE;
DROP TABLE IF EXISTS post_tags CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tag_follows CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS username_redirects CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS follow_requests CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;


-- =====================================================
-- 1. PROFILLER (auth.users genisletmesi)
-- =====================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  surname TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'premium', 'moderator', 'admin')),

  -- Avatar
  avatar_url TEXT,

  -- Profil bilgileri
  bio TEXT DEFAULT '' CHECK (char_length(bio) <= 150),
  website TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  phone_number TEXT,
  country_code TEXT DEFAULT '+90',

  -- Hesap durumu
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted', 'moderation', 'frozen', 'blocked')),
  status_updated_at TIMESTAMPTZ,
  frozen_at TIMESTAMPTZ,

  -- Dogrulama
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  google_connected BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Guvenlik
  mfa_enabled BOOLEAN DEFAULT FALSE,

  -- Premium (planlar: basic, pro, max, business)
  is_premium BOOLEAN DEFAULT FALSE,
  premium_plan TEXT CHECK (premium_plan IS NULL OR premium_plan IN ('basic', 'pro', 'max', 'business')),
  premium_until TIMESTAMPTZ,

  -- Hesap ayarlari
  account_private BOOLEAN DEFAULT FALSE,
  theme_mode TEXT DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'dim', 'system')),
  language TEXT DEFAULT 'tr',

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 1,

  -- Hesap turu (profesyonel hesap)
  account_type TEXT DEFAULT 'personal' CHECK (account_type IN ('personal', 'creator', 'business')),
  professional_category TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Kisitlamalar
  username_changed_at TIMESTAMPTZ,
  name_changed_at TIMESTAMPTZ,
  name_change_count INTEGER DEFAULT 0,

  -- Skor & Algoritma
  profile_score REAL DEFAULT 0,
  spam_score REAL DEFAULT 0,
  trust_level INTEGER DEFAULT 0,

  -- Coin
  coin_balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,

  -- Istatistik
  post_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  total_views_received BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_status_not_active ON profiles(status) WHERE status != 'active';
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_premium ON profiles(is_premium) WHERE is_premium = TRUE;
CREATE INDEX idx_profiles_score ON profiles(profile_score DESC);
CREATE INDEX idx_profiles_created ON profiles(created_at DESC);

-- Profil puan guncelleme trigger'i
CREATE OR REPLACE FUNCTION update_profile_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_score := 0
    + CASE WHEN NEW.avatar_url IS NOT NULL THEN 30 ELSE 0 END
    + CASE WHEN char_length(COALESCE(NEW.bio, '')) > 10 THEN 15 ELSE 0 END
    + CASE WHEN NEW.email_verified THEN 10 ELSE 0 END
    + CASE WHEN NEW.phone_verified THEN 5 ELSE 0 END
    + CASE WHEN NEW.is_verified THEN 20 ELSE 0 END
    + CASE WHEN NEW.is_premium THEN 10 ELSE 0 END
    + LEAST(log(GREATEST(NEW.follower_count, 1) + 1) * 8, 20)
    + LEAST(NEW.post_count * 3, 15)
    + CASE WHEN NEW.website IS NOT NULL AND NEW.website != '' THEN 5 ELSE 0 END
    - COALESCE(NEW.spam_score, 0) * 0.5;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_score
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_score();

-- Yeni kullanici kaydinda otomatik profil olusturma
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _name TEXT;
  _surname TEXT;
  _full_name TEXT;
  _avatar TEXT;
  _username TEXT;
BEGIN
  _name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), '');
  _surname := COALESCE(NULLIF(NEW.raw_user_meta_data->>'surname', ''), '');
  _full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(TRIM(_name || ' ' || _surname), ''),
    split_part(NEW.email, '@', 1)
  );
  _avatar := NEW.raw_user_meta_data->>'avatar_url';
  _username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 12)
  );

  INSERT INTO public.profiles (user_id, email, name, surname, full_name, username, avatar_url)
  VALUES (NEW.id, NEW.email, _name, _surname, _full_name, _username, _avatar);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =====================================================
-- 2. TAKIP SISTEMI
-- =====================================================
CREATE TABLE public.follows (
  id BIGSERIAL PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE public.follow_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, target_id),
  CHECK (requester_id != target_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follow_requests_target ON follow_requests(target_id);
CREATE INDEX idx_follow_requests_status ON follow_requests(status) WHERE status = 'pending';

-- Takip sayaci trigger
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE user_id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();


-- =====================================================
-- 3. ENGELLEME
-- =====================================================
CREATE TABLE public.blocks (
  id BIGSERIAL PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);


-- =====================================================
-- 3b. KULLANICI ADI YONLENDIRMELERI
-- =====================================================
CREATE TABLE public.username_redirects (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_username_redirects_old ON username_redirects(old_username);
CREATE INDEX idx_username_redirects_user ON username_redirects(user_id);


-- =====================================================
-- 4. ETIKETLER
-- =====================================================
CREATE TABLE public.tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  post_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);

CREATE TABLE public.tag_follows (
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);


-- =====================================================
-- 5. KATEGORILER
-- =====================================================
CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 6. MAKALELER (posts)
-- =====================================================
CREATE TABLE public.posts (
  id BIGSERIAL PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,

  content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post')),
  language TEXT DEFAULT 'tr',
  reading_time INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'moderation', 'removed', 'archived')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'only_me')),
  published_at TIMESTAMPTZ,

  meta_title TEXT,
  meta_description TEXT,
  slug_hash TEXT,

  -- Istatistik
  view_count BIGINT DEFAULT 0,
  unique_view_count BIGINT DEFAULT 0,
  premium_view_count BIGINT DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- Algoritma
  quality_score REAL DEFAULT 0,
  trending_score REAL DEFAULT 0,
  spam_score REAL DEFAULT 0,

  total_coins_earned INTEGER DEFAULT 0,
  source_links JSONB DEFAULT '[]',

  allow_comments BOOLEAN DEFAULT TRUE,
  is_nsfw BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published ON posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_posts_trending ON posts(trending_score DESC) WHERE status = 'published';
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_quality ON posts(quality_score DESC) WHERE status = 'published';
CREATE INDEX idx_posts_visibility ON posts(visibility);

-- Post sayaci trigger
CREATE OR REPLACE FUNCTION update_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
    UPDATE profiles SET post_count = post_count + 1 WHERE user_id = NEW.author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'published' AND NEW.status = 'published' THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE user_id = NEW.author_id;
    ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
      UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE user_id = NEW.author_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
    UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE user_id = OLD.author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_count
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_post_count();


-- =====================================================
-- 7. POST-TAG ILISKISI
-- =====================================================
CREATE TABLE public.post_tags (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- =====================================================
-- 8. POST-CATEGORY ILISKISI
-- =====================================================
CREATE TABLE public.post_categories (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);


-- =====================================================
-- 9. BEGENILER
-- =====================================================
CREATE TABLE public.likes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_likes_user ON likes(user_id);

-- Like sayaci trigger
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_like_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();


-- =====================================================
-- 10. BOOKMARK (Kaydedilenler)
-- =====================================================
CREATE TABLE public.bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- Bookmark sayaci trigger
CREATE OR REPLACE FUNCTION update_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_save_count
  AFTER INSERT OR DELETE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_save_count();


-- =====================================================
-- 11. PAYLASIMLAR
-- =====================================================
CREATE TABLE public.shares (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  visitor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share sayaci trigger
CREATE OR REPLACE FUNCTION update_share_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET share_count = share_count + 1 WHERE id = NEW.post_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_share_count
  AFTER INSERT ON shares
  FOR EACH ROW EXECUTE FUNCTION update_share_count();


-- =====================================================
-- 12. YORUMLAR
-- Max karakter: free=250, basic=250, pro=250, max=500, business=500
-- DB constraint en yuksek limiti kabul eder (500)
-- Uygulama katmaninda plan bazli kontrol yapilir
-- =====================================================
CREATE TABLE public.comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,

  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'gif')),
  gif_url TEXT,

  visitor_name TEXT,
  visitor_email TEXT,
  visitor_id TEXT,

  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'spam', 'removed')),

  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  spam_score REAL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- Yorum sayaci trigger
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();


-- =====================================================
-- 13. YORUM BEGENILERI
-- =====================================================
CREATE TABLE public.comment_likes (
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_like_count
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();


-- =====================================================
-- 14. BILDIRIMLER
-- =====================================================
CREATE TABLE public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,

  type TEXT NOT NULL CHECK (type IN (
    'like', 'comment', 'reply', 'mention', 'follow',
    'follow_request', 'follow_accepted',
    'first_post', 'comeback_post', 'milestone',
    'coin_earned', 'gift_received', 'premium_expired',
    'premium_activated', 'premium_cancelled',
    'system'
  )),

  object_id BIGINT,
  object_type TEXT,
  content TEXT,

  is_read BOOLEAN DEFAULT FALSE,
  is_seen BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_dedup ON notifications(user_id, actor_id, type, object_id);


-- =====================================================
-- 15. BILDIRIM AYARLARI
-- =====================================================
CREATE TABLE public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  like_enabled BOOLEAN DEFAULT TRUE,
  comment_enabled BOOLEAN DEFAULT TRUE,
  reply_enabled BOOLEAN DEFAULT TRUE,
  mention_enabled BOOLEAN DEFAULT TRUE,
  follow_enabled BOOLEAN DEFAULT TRUE,
  first_post_enabled BOOLEAN DEFAULT TRUE,
  milestone_enabled BOOLEAN DEFAULT TRUE,
  coin_earned_enabled BOOLEAN DEFAULT TRUE,
  gift_received_enabled BOOLEAN DEFAULT TRUE,
  paused_until TIMESTAMPTZ,
  -- Email notification preferences
  email_like BOOLEAN DEFAULT FALSE,
  email_comment BOOLEAN DEFAULT TRUE,
  email_follow BOOLEAN DEFAULT TRUE,
  email_gift BOOLEAN DEFAULT TRUE,
  email_milestone BOOLEAN DEFAULT TRUE,
  email_withdrawal BOOLEAN DEFAULT TRUE
);


-- =====================================================
-- 16. GORUNTULEMELER (Kazanc hesaplama icin)
-- =====================================================
CREATE TABLE public.post_views (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  visitor_id TEXT,

  read_percentage INTEGER DEFAULT 0,
  read_duration INTEGER DEFAULT 0,
  is_qualified_read BOOLEAN DEFAULT FALSE,
  is_premium_viewer BOOLEAN DEFAULT FALSE,
  coins_earned INTEGER DEFAULT 0,

  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_views_post ON post_views(post_id);
CREATE INDEX idx_post_views_viewer ON post_views(viewer_id);
CREATE INDEX idx_post_views_qualified ON post_views(is_qualified_read) WHERE is_qualified_read = TRUE;

-- Unique index: bir kullanici bir makaleye tek kayit (NULL viewer_id haric)
CREATE UNIQUE INDEX idx_post_views_unique_viewer
  ON post_views(post_id, viewer_id) WHERE viewer_id IS NOT NULL;

-- View sayaci trigger (unique view tracking dahil)
CREATE OR REPLACE FUNCTION update_view_counts()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Always increment total view count
  UPDATE posts SET view_count = view_count + 1 WHERE id = NEW.post_id;

  -- Check if this is a new unique viewer
  SELECT COUNT(*) INTO existing_count
  FROM post_views
  WHERE post_id = NEW.post_id
    AND viewer_id = NEW.viewer_id
    AND id != NEW.id;

  IF existing_count = 0 THEN
    UPDATE posts SET unique_view_count = unique_view_count + 1 WHERE id = NEW.post_id;
  END IF;

  IF NEW.is_premium_viewer THEN
    UPDATE posts SET premium_view_count = premium_view_count + 1 WHERE id = NEW.post_id;
  END IF;

  UPDATE profiles SET total_views_received = total_views_received + 1
    WHERE user_id = (SELECT author_id FROM posts WHERE id = NEW.post_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_view_counts
  AFTER INSERT ON post_views
  FOR EACH ROW EXECUTE FUNCTION update_view_counts();


-- =====================================================
-- 17. COIN ISLEMLERI
-- =====================================================
CREATE TABLE public.coin_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'read_earning', 'gift_sent', 'gift_received',
    'tip_sent', 'tip_received', 'referral_bonus',
    'premium_purchase', 'withdrawal', 'deposit',
    'system_bonus', 'refund', 'purchase'
  )),

  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  related_post_id BIGINT REFERENCES posts(id),
  related_user_id UUID REFERENCES profiles(user_id),
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC);


-- =====================================================
-- 18. COIN PAKETLERI (Satin alma)
-- =====================================================
CREATE TABLE public.coin_packages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  coins INTEGER NOT NULL,
  price_try DECIMAL(10,2) NOT NULL,
  bonus_coins INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_popular BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayilan coin paketleri
INSERT INTO coin_packages (name, coins, price_try, bonus_coins, is_popular, display_order) VALUES
  ('100 Jeton', 100, 29.99, 0, FALSE, 1),
  ('300 Jeton', 300, 79.99, 30, TRUE, 2),
  ('500 Jeton', 500, 119.99, 75, FALSE, 3),
  ('1000 Jeton', 1000, 199.99, 250, FALSE, 4);


-- =====================================================
-- 19. COIN ODEMELERI
-- =====================================================
CREATE TABLE public.coin_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES coin_packages(id),
  coins_purchased INTEGER NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'dev',
  payment_ref TEXT,
  merchant_oid TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coin_payments_user ON coin_payments(user_id, created_at DESC);
CREATE INDEX idx_coin_payments_status ON coin_payments(status);


-- =====================================================
-- 20. PREMIUM PLANLARI
-- Planlar: basic, pro, max, business
-- =====================================================
CREATE TABLE public.premium_plans (
  id TEXT PRIMARY KEY, -- 'basic', 'pro', 'max', 'business'
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  period TEXT DEFAULT 'ay' CHECK (period IN ('ay', 'yil')),
  is_active BOOLEAN DEFAULT TRUE,
  features JSONB DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayilan premium planlari
INSERT INTO premium_plans (id, name, price, period, display_order, features) VALUES
  ('basic', 'Basic', 39.99, 'ay', 1, '[
    "Onayli Rozet",
    "Reklamsiz Deneyim",
    "Oncelikli Destek",
    "Profil Cercevesi",
    "Uzun Gonderi"
  ]'::jsonb),
  ('pro', 'Pro', 79.99, 'ay', 2, '[
    "Onayli Rozet",
    "Reklamsiz Deneyim",
    "Oncelikli Destek",
    "Profil Cercevesi",
    "Uzun Gonderi",
    "Para Kazanma",
    "Onde Gosterim",
    "Analitik"
  ]'::jsonb),
  ('max', 'Max', 149.99, 'ay', 3, '[
    "Onayli Rozet",
    "Reklamsiz Deneyim",
    "Oncelikli Destek",
    "Profil Cercevesi",
    "Uzun Gonderi",
    "Para Kazanma",
    "Onde Gosterim",
    "Analitik",
    "Ziyaretciler",
    "Ozel Temalar",
    "Erken Erisim",
    "Hizli Inceleme",
    "Ozel Rozetler",
    "Planlama Araci",
    "Uzun Yorum (500 karakter)"
  ]'::jsonb),
  ('business', 'Business', 249, 'ay', 4, '[
    "Onayli Rozet",
    "Reklamsiz Deneyim",
    "Artirilmis Limitler",
    "Para Kazanma",
    "Kesfette One Cikma",
    "Aramalarda One Cikma",
    "Yorumlarda One Cikma",
    "Onerilerde One Cikma",
    "Analitik Paneli",
    "Dim Mod",
    "Iki Faktorlu Dogrulama",
    "Isletme Hesabi",
    "Profil Ziyaretcileri",
    "Uzun Gonderi",
    "Oncelikli Destek",
    "Hizli Inceleme",
    "Uzun Yorum (500 karakter)"
  ]'::jsonb);


-- =====================================================
-- 21. PREMIUM UYELIKLER
-- =====================================================
CREATE TABLE public.premium_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES premium_plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  payment_method TEXT DEFAULT 'dev',
  amount_paid DECIMAL(10,2) DEFAULT 0,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_premium_user ON premium_subscriptions(user_id, status);
CREATE INDEX idx_premium_expires ON premium_subscriptions(expires_at) WHERE status = 'active';


-- =====================================================
-- 22. PREMIUM ODEMELERI
-- =====================================================
CREATE TABLE public.premium_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES premium_subscriptions(id),
  plan_id TEXT NOT NULL REFERENCES premium_plans(id),
  amount_paid DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'dev',
  payment_ref TEXT,
  merchant_oid TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_premium_payments_user ON premium_payments(user_id, created_at DESC);


-- =====================================================
-- 23. HEDIYELER
-- =====================================================
CREATE TABLE public.gifts (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_id BIGINT REFERENCES posts(id),
  gift_type TEXT NOT NULL CHECK (gift_type IN ('coffee', 'heart', 'star', 'diamond')),
  coin_amount INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gifts_sender ON gifts(sender_id);
CREATE INDEX idx_gifts_receiver ON gifts(receiver_id);


-- =====================================================
-- 24. KUPONLAR
-- =====================================================
CREATE TABLE public.coupons (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  coupon_type TEXT DEFAULT 'general' CHECK (coupon_type IN ('general', 'premium', 'coin', 'referral')),
  applies_to TEXT CHECK (applies_to IS NULL OR applies_to IN ('coin', 'premium_basic', 'premium_pro', 'premium_max', 'premium_business')),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active) WHERE is_active = TRUE;


-- =====================================================
-- 25. KUPON KULLANIMI
-- =====================================================
CREATE TABLE public.coupon_usages (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  payment_id BIGINT,
  discount_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);


-- =====================================================
-- 26. RAPORLAR
-- =====================================================
CREATE TABLE public.reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  content_id BIGINT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'user')),
  content_author_id UUID REFERENCES profiles(user_id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  moderator_id UUID REFERENCES profiles(user_id),
  moderator_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(reporter_id, content_id, content_type)
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);


-- =====================================================
-- 27. OTURUMLAR
-- =====================================================
CREATE TABLE public.sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  device_hash TEXT,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_trusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id, is_active);


-- =====================================================
-- 28. GUVENLIK OLAYLARI
-- =====================================================
CREATE TABLE public.security_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);


-- =====================================================
-- 29. PROFIL ZIYARETLERI
-- =====================================================
CREATE TABLE public.profile_visits (
  id BIGSERIAL PRIMARY KEY,
  visited_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_visits_visited ON profile_visits(visited_id, created_at DESC);


-- =====================================================
-- 30. ANALITIK
-- =====================================================
CREATE TABLE public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  visitor_id TEXT,
  event_type TEXT NOT NULL,
  page_url TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type, created_at DESC);


-- =====================================================
-- 31. MODERASYON LOGLARI
-- =====================================================
CREATE TABLE public.moderation_logs (
  id BIGSERIAL PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES profiles(user_id),
  action TEXT NOT NULL CHECK (action IN (
    'approve_post', 'remove_post', 'archive_post',
    'approve_comment', 'remove_comment',
    'warn_user', 'mute_user', 'ban_user', 'unban_user',
    'verify_user', 'unverify_user',
    'grant_premium', 'revoke_premium',
    'change_role', 'dismiss_report', 'resolve_report'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'comment', 'report')),
  target_id TEXT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mod_logs_moderator ON moderation_logs(moderator_id, created_at DESC);
CREATE INDEX idx_mod_logs_target ON moderation_logs(target_type, target_id);


-- =====================================================
-- 32. NAKIT CEKIM TALEPLERI
-- =====================================================
CREATE TABLE public.withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 100), -- minimum 100 coin
  amount_try DECIMAL(10,2) NOT NULL, -- TL karsiligi
  iban TEXT NOT NULL,
  iban_holder TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_user ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests(status) WHERE status IN ('pending', 'processing');


-- =====================================================
-- 33. EMAIL LOG
-- =====================================================
CREATE TABLE public.email_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_user ON email_logs(user_id, created_at DESC);


-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Tum tablolarda RLS aktif
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE username_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- ── Follows ──
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- ── Follow Requests ──
CREATE POLICY "follow_requests_select" ON follow_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "follow_requests_insert" ON follow_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "follow_requests_delete" ON follow_requests FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- ── Blocks ──
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "blocks_insert" ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete" ON blocks FOR DELETE USING (auth.uid() = blocker_id);

-- ── Username Redirects ──
CREATE POLICY "username_redirects_public_read" ON username_redirects FOR SELECT USING (true);

-- ── Tags (herkes okuyabilir) ──
CREATE POLICY "tags_select" ON tags FOR SELECT USING (true);
CREATE POLICY "tag_follows_select" ON tag_follows FOR SELECT USING (true);
CREATE POLICY "tag_follows_insert" ON tag_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tag_follows_delete" ON tag_follows FOR DELETE USING (auth.uid() = user_id);

-- ── Categories (herkes okuyabilir) ──
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

-- ── Posts ──
CREATE POLICY "posts_select" ON posts FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = author_id);

-- ── Post Tags / Categories (herkes okuyabilir) ──
CREATE POLICY "post_tags_select" ON post_tags FOR SELECT USING (true);
CREATE POLICY "post_tags_insert" ON post_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "post_tags_delete" ON post_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid()));

CREATE POLICY "post_categories_select" ON post_categories FOR SELECT USING (true);
CREATE POLICY "post_categories_insert" ON post_categories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "post_categories_delete" ON post_categories FOR DELETE
  USING (EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid()));

-- ── Likes ──
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);

-- ── Bookmarks ──
CREATE POLICY "bookmarks_select" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_insert" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ── Shares ──
CREATE POLICY "shares_select" ON shares FOR SELECT USING (true);
CREATE POLICY "shares_insert" ON shares FOR INSERT WITH CHECK (true);

-- ── Comments ──
CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (status = 'approved' OR auth.uid() = author_id);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = author_id);

-- ── Comment Likes ──
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- ── Notifications ──
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- ── Notification Settings ──
CREATE POLICY "notification_settings_select" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notification_settings_all" ON notification_settings FOR ALL USING (auth.uid() = user_id);

-- ── Post Views (insert icin genis yetki - anonim de goruntuleyebilir) ──
CREATE POLICY "post_views_insert" ON post_views FOR INSERT WITH CHECK (true);
CREATE POLICY "post_views_select" ON post_views FOR SELECT
  USING (auth.uid() = viewer_id OR auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id));

-- ── Coin Transactions ──
CREATE POLICY "coin_transactions_select" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);

-- ── Coin Packages (herkes okuyabilir) ──
CREATE POLICY "coin_packages_select" ON coin_packages FOR SELECT USING (is_active = true);

-- ── Coin Payments ──
CREATE POLICY "coin_payments_select" ON coin_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coin_payments_insert" ON coin_payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Premium Plans (herkes okuyabilir) ──
CREATE POLICY "premium_plans_select" ON premium_plans FOR SELECT USING (is_active = true);

-- ── Premium Subscriptions ──
CREATE POLICY "premium_sub_select" ON premium_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ── Premium Payments ──
CREATE POLICY "premium_pay_select" ON premium_payments FOR SELECT USING (auth.uid() = user_id);

-- ── Gifts ──
CREATE POLICY "gifts_select" ON gifts FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "gifts_insert" ON gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ── Coupons (admin tam erisim, kullanici sadece aktif olanlar) ──
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "coupons_admin_all" ON coupons FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ── Coupon Usages ──
CREATE POLICY "coupon_usages_select" ON coupon_usages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coupon_usages_insert" ON coupon_usages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Reports ──
CREATE POLICY "reports_select" ON reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ── Sessions ──
CREATE POLICY "sessions_select" ON sessions FOR SELECT USING (auth.uid() = user_id);

-- ── Security Events (sadece kendi olaylari) ──
CREATE POLICY "security_events_select" ON security_events FOR SELECT USING (auth.uid() = user_id);

-- ── Profile Visits (sadece ziyaret edilen gorebilir) ──
CREATE POLICY "profile_visits_select" ON profile_visits FOR SELECT USING (auth.uid() = visited_id);
CREATE POLICY "profile_visits_insert" ON profile_visits FOR INSERT WITH CHECK (auth.uid() = visitor_id);

-- ── Analytics Events ──
CREATE POLICY "analytics_insert" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_select" ON analytics_events FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));

-- ── Moderation Logs (admin/moderator gorebilir) ──
CREATE POLICY "mod_logs_select" ON moderation_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));
CREATE POLICY "mod_logs_insert" ON moderation_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));

-- ── Withdrawal Requests ──
CREATE POLICY "withdrawal_select" ON withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "withdrawal_insert" ON withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "withdrawal_admin_all" ON withdrawal_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));

-- ── Email Logs (sadece admin) ──
CREATE POLICY "email_logs_admin" ON email_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin')));


-- =====================================================
-- STORAGE: images bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage politikalari (varsa sil, yeniden olustur)
DROP POLICY IF EXISTS "images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "images_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "images_owner_delete" ON storage.objects;

CREATE POLICY "images_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

CREATE POLICY "images_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "images_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "images_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);


-- =====================================================
-- VARSAYILAN KATEGORILER
-- =====================================================
INSERT INTO categories (name, slug, description) VALUES
  ('Teknoloji', 'teknoloji', 'Teknoloji ve yazilim'),
  ('Bilim', 'bilim', 'Bilim ve arastirma'),
  ('Kultur', 'kultur', 'Kultur ve sanat'),
  ('Yasam', 'yasam', 'Gunluk yasam'),
  ('Ekonomi', 'ekonomi', 'Ekonomi ve finans'),
  ('Spor', 'spor', 'Spor haberleri'),
  ('Saglik', 'saglik', 'Saglik ve wellness'),
  ('Egitim', 'egitim', 'Egitim ve ogrenim'),
  ('Seyahat', 'seyahat', 'Gezi ve seyahat'),
  ('Yemek', 'yemek', 'Yemek ve tarif');


-- =====================================================
-- MEVCUT AUTH KULLANICILARI ICIN PROFIL OLUSTUR
-- (Migration yeniden calistirildiginda profilsiz kalmasinlar)
-- =====================================================
INSERT INTO public.profiles (user_id, email, username, full_name, onboarding_completed)
SELECT
  id,
  email,
  'user_' || substr(replace(id::text, '-', ''), 1, 12),
  COALESCE(
    NULLIF(raw_user_meta_data->>'full_name', ''),
    split_part(email, '@', 1)
  ),
  TRUE
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;


-- =====================================================
-- BITTI! Feedim veritabani hazir.
-- Roller: user, premium, moderator, admin
-- Premium planlar: basic, pro, max, business
-- Yorum limitleri: free/basic/pro=250, max/business=500
-- =====================================================
