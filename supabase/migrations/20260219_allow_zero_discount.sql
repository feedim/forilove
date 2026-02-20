-- Allow 0% discount for affiliate tracking-only promo codes

-- 1. Update CHECK constraint on promo_links to allow discount_percent >= 0
ALTER TABLE public.promo_links DROP CONSTRAINT IF EXISTS promo_links_discount_percent_check;
ALTER TABLE public.promo_links ADD CONSTRAINT promo_links_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100);

-- 2. Update CHECK constraint on coupons to allow discount_percent >= 0
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_percent_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100);

-- 3. Update process_promo_signup to skip coupon creation for 0% discount
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
  v_user_created_at TIMESTAMPTZ;
BEGIN
  -- Promo sadece yeni kullanıcılara uygulanır (hesap < 1 saat)
  SELECT created_at INTO v_user_created_at
  FROM auth.users WHERE id = p_user_id;

  IF v_user_created_at IS NULL OR v_user_created_at < now() - INTERVAL '1 hour' THEN
    RETURN json_build_object('success', false, 'error', 'Promosyonlar sadece yeni kullanıcılar için geçerlidir');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_links
  WHERE UPPER(code) = UPPER(TRIM(p_promo_code)) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  -- Self-referral prevention: affiliate cannot use own promo
  IF v_promo.created_by = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Kendi promosyon kodunuzu kullanamazsınız');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promosyon süresi dolmuş');
  END IF;

  IF v_promo.max_signups IS NOT NULL AND v_promo.current_signups >= v_promo.max_signups THEN
    RETURN json_build_object('success', false, 'error', 'Promosyon limiti dolmuş');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.promo_signups WHERE promo_link_id = v_promo.id AND user_id = p_user_id
  ) INTO v_already_signed;

  IF v_already_signed THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyondan zaten yararlandınız');
  END IF;

  -- For 0% discount (tracking-only), skip coupon creation
  IF v_promo.discount_percent = 0 THEN
    INSERT INTO public.promo_signups (promo_link_id, user_id, coupon_id)
    VALUES (v_promo.id, p_user_id, NULL);

    UPDATE public.promo_links SET current_signups = current_signups + 1 WHERE id = v_promo.id;

    RETURN json_build_object(
      'success', true,
      'coupon_code', NULL,
      'discount_percent', 0
    );
  END IF;

  v_coupon_code := 'PR' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 7));

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

  INSERT INTO public.promo_signups (promo_link_id, user_id, coupon_id)
  VALUES (v_promo.id, p_user_id, v_new_coupon_id);

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
