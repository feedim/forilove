CREATE TABLE public.gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_email TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gifts_own_read" ON public.gifts FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "gifts_insert" ON public.gifts FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Race condition koruması: bakiye asla negatife düşemez
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_coin_balance_non_negative CHECK (coin_balance >= 0);

-- Helper: e-posta ile kullanıcı ID'si bul (SADECE service_role erişebilir)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- Authenticated kullanıcılar bu fonksiyonu direkt çağıramasın
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM anon;
