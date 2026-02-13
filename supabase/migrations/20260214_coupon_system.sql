-- =============================================
-- Kupon Kod Sistemi - Migration
-- Kupon kodları max 9 karakter
-- =============================================

-- 1. Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (char_length(code) >= 3 AND char_length(code) <= 9),
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  coupon_type TEXT NOT NULL DEFAULT 'general' CHECK (coupon_type IN ('general', 'welcome', 'promo')),
  target_user_id UUID REFERENCES auth.users(id) DEFAULT NULL,
  promo_link_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_upper ON public.coupons (UPPER(code));

-- 2. Coupon usages table
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usage_unique ON public.coupon_usages (coupon_id, user_id);

-- 3. Promo links table (admin creates, tracks signups)
CREATE TABLE IF NOT EXISTS public.promo_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (char_length(code) >= 3 AND char_length(code) <= 20),
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
  max_signups INTEGER DEFAULT NULL,
  current_signups INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_links_code_upper ON public.promo_links (UPPER(code));

-- 4. Promo signups tracking (which user came from which promo)
CREATE TABLE IF NOT EXISTS public.promo_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_link_id UUID NOT NULL REFERENCES public.promo_links(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  coupon_id UUID REFERENCES public.coupons(id),
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_signup_unique ON public.promo_signups (promo_link_id, user_id);

-- 5. RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_signups ENABLE ROW LEVEL SECURITY;

-- Coupons policies
CREATE POLICY "Users can read active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Coupon usages policies
CREATE POLICY "Users can read own usages" ON public.coupon_usages
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own usage" ON public.coupon_usages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Promo links policies (admin only)
CREATE POLICY "Admins can manage promo links" ON public.promo_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can read active promo links" ON public.promo_links
  FOR SELECT TO authenticated USING (is_active = true);

-- Promo signups policies
CREATE POLICY "Admins can read all promo signups" ON public.promo_signups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can read own promo signups" ON public.promo_signups
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own promo signup" ON public.promo_signups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================
-- 6. RPC: validate_coupon
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
  v_already_used BOOLEAN;
  v_clean_code TEXT;
BEGIN
  v_clean_code := UPPER(TRIM(p_code));

  -- Reject invalid length
  IF char_length(v_clean_code) < 3 OR char_length(v_clean_code) > 9 THEN
    RETURN json_build_object('valid', false, 'error', 'Geçersiz kupon kodu');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = v_clean_code AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Geçersiz kupon kodu');
  END IF;

  IF v_coupon.target_user_id IS NOT NULL AND v_coupon.target_user_id != p_user_id THEN
    RETURN json_build_object('valid', false, 'error', 'Bu kupon sizin için geçerli değil');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Kupon kodunun süresi dolmuş');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN json_build_object('valid', false, 'error', 'Kupon kullanım limiti dolmuş');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.coupon_usages WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN json_build_object('valid', false, 'error', 'Bu kuponu zaten kullandınız');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'discount_percent', v_coupon.discount_percent,
    'error', NULL
  );
END;
$$;

-- =============================================
-- 7. RPC: record_coupon_usage
-- =============================================
CREATE OR REPLACE FUNCTION public.record_coupon_usage(p_coupon_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.coupon_usages (coupon_id, user_id) VALUES (p_coupon_id, p_user_id);
  UPDATE public.coupons SET current_uses = current_uses + 1 WHERE id = p_coupon_id;
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Bu kuponu zaten kullandınız');
END;
$$;

-- =============================================
-- 8. RPC: get_welcome_coupon (also returns promo coupons)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_welcome_coupon(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE coupon_type = 'promo'
    AND target_user_id = p_user_id
    AND is_active = true
    AND current_uses = 0
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object(
    'found', true,
    'code', v_coupon.code,
    'discount_percent', v_coupon.discount_percent,
    'expires_at', v_coupon.expires_at,
    'coupon_type', v_coupon.coupon_type
  );
END;
$$;

-- =============================================
-- 9. RPC: process_promo_signup
-- Called when a user registers via a promo link
-- Creates a personal coupon for that user
-- =============================================
CREATE OR REPLACE FUNCTION public.process_promo_signup(p_promo_code TEXT, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo RECORD;
  v_already_signed BOOLEAN;
  v_coupon_code TEXT;
  v_new_coupon_id UUID;
BEGIN
  -- Find promo link
  SELECT * INTO v_promo
  FROM public.promo_links
  WHERE UPPER(code) = UPPER(TRIM(p_promo_code)) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promosyon süresi dolmuş');
  END IF;

  IF v_promo.max_signups IS NOT NULL AND v_promo.current_signups >= v_promo.max_signups THEN
    RETURN json_build_object('success', false, 'error', 'Promosyon limiti dolmuş');
  END IF;

  -- Check duplicate
  SELECT EXISTS(
    SELECT 1 FROM public.promo_signups WHERE promo_link_id = v_promo.id AND user_id = p_user_id
  ) INTO v_already_signed;

  IF v_already_signed THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyondan zaten yararlandınız');
  END IF;

  -- Generate 9-char coupon code: PR + 7 random
  v_coupon_code := 'PR' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 7));

  -- Create personal coupon
  INSERT INTO public.coupons (code, discount_percent, max_uses, coupon_type, target_user_id, promo_link_id, expires_at, is_active, created_by)
  VALUES (
    v_coupon_code,
    v_promo.discount_percent,
    1,
    'promo',
    p_user_id,
    v_promo.id,
    COALESCE(v_promo.expires_at, now() + INTERVAL '30 days'),
    true,
    p_user_id
  )
  RETURNING id INTO v_new_coupon_id;

  -- Record signup
  INSERT INTO public.promo_signups (promo_link_id, user_id, coupon_id)
  VALUES (v_promo.id, p_user_id, v_new_coupon_id);

  -- Increment counter
  UPDATE public.promo_links SET current_signups = current_signups + 1 WHERE id = v_promo.id;

  RETURN json_build_object(
    'success', true,
    'coupon_code', v_coupon_code,
    'discount_percent', v_promo.discount_percent
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyondan zaten yararlandınız');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Bir hata oluştu');
END;
$$;

-- Welcome coupon trigger removed (admin manages coupons manually + promo links)
