import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * PayTR Callback (IPN) endpoint
 * PayTR ödeme sonucunu buraya POST eder
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const merchant_oid = formData.get('merchant_oid') as string;
    const status = formData.get('status') as string;
    const total_amount = formData.get('total_amount') as string;
    const hash = formData.get('hash') as string;

    console.log('[PayTR CB] Received:', { merchant_oid, status, total_amount, hash: hash?.substring(0, 10) + '...' });

    const merchant_key = (process.env.PAYTTR_MERCHANT_KEY || '').trim();
    const merchant_salt = (process.env.PAYTTR_MERCHANT_SALT || '').trim();

    if (!merchant_key || !merchant_salt) {
      console.error('[PayTR CB] CRITICAL: env vars missing');
      return new NextResponse('OK', { status: 200 });
    }

    // Hash doğrulama (timing-safe comparison)
    // PayTR callback hash: HMAC-SHA256(merchant_key, merchant_oid + merchant_salt + status + total_amount)
    const hashSTR = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
    const calculatedHash = crypto.createHmac('sha256', merchant_key).update(hashSTR).digest('base64');

    const hashBuffer = Buffer.from(hash || '', 'utf8');
    const calculatedBuffer = Buffer.from(calculatedHash, 'utf8');
    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      console.error('[PayTR CB] Hash mismatch:', { merchant_oid, received: hash, calculated: calculatedHash });
      return new NextResponse('OK', { status: 200 });
    }

    console.log('[PayTR CB] Hash OK for:', merchant_oid);

    const supabase = createAdminClient();

    // Ödeme kaydını bul
    const { data: payment, error: paymentError } = await supabase
      .from('coin_payments')
      .select('*, coin_packages(*)')
      .eq('payment_id', merchant_oid)
      .single();

    if (paymentError || !payment) {
      console.error('[PayTR CB] Payment not found:', merchant_oid, paymentError?.message);
      return new NextResponse('OK', { status: 200 });
    }

    console.log('[PayTR CB] Payment found:', { id: payment.id, status: payment.status, price_paid: payment.price_paid, coins: payment.coins_purchased });

    // Zaten işlenmiş mi kontrol et
    if (payment.status === 'completed') {
      console.log('[PayTR CB] Already completed, skipping:', merchant_oid);
      return new NextResponse('OK', { status: 200 });
    }

    // Tutar çapraz kontrolü: PayTR total_amount (kuruş) vs DB price_paid (TL)
    const expectedAmountKurus = Math.round(payment.price_paid * 100);
    const receivedAmountKurus = parseInt(total_amount, 10);
    if (expectedAmountKurus !== receivedAmountKurus) {
      console.error('[PayTR CB] Amount mismatch:', { expected: expectedAmountKurus, received: receivedAmountKurus });
      await supabase
        .from('coin_payments')
        .update({
          status: 'failed',
          metadata: { ...payment.metadata, error: `Tutar uyuşmazlığı: beklenen ${expectedAmountKurus}, gelen ${receivedAmountKurus}` },
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
      return new NextResponse('OK', { status: 200 });
    }

    // Ödeme başarılı mı?
    if (status === 'success') {
      console.log('[PayTR CB] Payment success, adding coins:', payment.coins_purchased);

      // Atomic coin ekleme
      const totalCoins = payment.coins_purchased;

      const { error: coinsError } = await supabase.rpc('add_coins_to_user', {
        p_user_id: payment.user_id,
        p_amount: totalCoins,
        p_type: 'purchase',
        p_description: `${payment.coin_packages?.name || 'Paket'} satın alındı`,
        p_reference_id: payment.id,
        p_reference_type: 'payment'
      });

      if (coinsError) {
        console.error('[PayTR CB] CRITICAL: Coin addition failed:', payment.id, coinsError.message, coinsError.details, coinsError.hint);
        await supabase
          .from('coin_payments')
          .update({
            status: 'failed',
            metadata: { ...payment.metadata, error: `Coin eklenemedi: ${coinsError.message}` },
            completed_at: new Date().toISOString(),
          })
          .eq('id', payment.id);

        return new NextResponse('OK', { status: 200 });
      }

      console.log('[PayTR CB] Coins added, marking completed:', payment.id);

      // Ödemeyi completed olarak işaretle
      await supabase
        .from('coin_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      console.log('[PayTR CB] DONE — payment completed:', merchant_oid);

    } else {
      console.log('[PayTR CB] Payment failed by PayTR:', merchant_oid);
      // Ödeme başarısız
      await supabase
        .from('coin_payments')
        .update({
          status: 'failed',
          metadata: { ...payment.metadata, error: 'Ödeme başarısız' },
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[PayTR CB] Unexpected error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
