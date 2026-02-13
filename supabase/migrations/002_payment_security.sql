-- Payment Security: Coin referral commission RPC
-- This function works with coin_payments table (unlike process_referral_commission which uses purchases table)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION process_coin_referral_commission(
  p_buyer_user_id UUID,
  p_coin_payment_id UUID,
  p_purchase_amount INT
) RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_commission INT;
BEGIN
  -- Find referral relationship
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = p_buyer_user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_referrer');
  END IF;

  -- Calculate 5% commission (minimum 5 FL)
  v_commission := GREATEST(FLOOR(p_purchase_amount * 0.05), 5);

  -- Duplication check
  IF EXISTS (
    SELECT 1 FROM coin_transactions
    WHERE reference_id = p_coin_payment_id
      AND reference_type = 'coin_referral_commission'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_processed');
  END IF;

  -- Atomically increment referrer's balance
  UPDATE profiles
  SET coin_balance = coin_balance + v_commission
  WHERE user_id = v_referrer_id;

  -- Record commission transaction
  INSERT INTO coin_transactions (user_id, amount, type, description, reference_id, reference_type)
  VALUES (
    v_referrer_id,
    v_commission,
    'referral_commission',
    'Referans komisyonu (coin satın alma)',
    p_coin_payment_id,
    'coin_referral_commission'
  );

  RETURN jsonb_build_object('success', true, 'commission', v_commission, 'referrer_id', v_referrer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
