import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * PayTR Callback (IPN) endpoint
 * PayTR ödeme sonucunu buraya POST eder
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const formData = await request.formData();

    const merchant_oid = formData.get('merchant_oid') as string;
    const status = formData.get('status') as string;
    const total_amount = formData.get('total_amount') as string;
    const hash = formData.get('hash') as string;

    const merchant_key = (process.env.PAYTTR_MERCHANT_KEY || '').trim();
    const merchant_salt = (process.env.PAYTTR_MERCHANT_SALT || '').trim();

    if (!merchant_key || !merchant_salt) {
      console.error('[PayTR Callback] Missing env vars');
      return new NextResponse('OK', { status: 200 });
    }

    // Hash doğrulama — HMAC key = merchant_key
    const hashSTR = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
    const calculatedHash = crypto.createHmac('sha256', merchant_key).update(hashSTR).digest('base64');

    const hashBuffer = Buffer.from(hash || '', 'utf8');
    const calculatedBuffer = Buffer.from(calculatedHash, 'utf8');
    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      console.error('[PayTR Callback] Hash mismatch for', merchant_oid);
      return new NextResponse('OK', { status: 200 });
    }

    // Ödeme kaydını bul
    const { data: payment, error: paymentError } = await supabase
      .from('coin_payments')
      .select('*, coin_packages(*)')
      .eq('payment_id', merchant_oid)
      .single();

    if (paymentError || !payment) {
      console.error('[PayTR Callback] Payment not found:', merchant_oid, paymentError?.message);
      return new NextResponse('OK', { status: 200 });
    }

    // Zaten işlenmiş mi kontrol et
    if (payment.status === 'completed') {
      return new NextResponse('OK', { status: 200 });
    }

    // Tutar çapraz kontrolü
    const expectedAmountKurus = Math.round(payment.price_paid * 100);
    const receivedAmountKurus = parseInt(total_amount, 10);
    if (expectedAmountKurus !== receivedAmountKurus) {
      console.error('[PayTR Callback] Amount mismatch:', merchant_oid, `expected=${expectedAmountKurus}, received=${receivedAmountKurus}`);
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
        console.error('[PayTR Callback] Coin add failed:', merchant_oid, coinsError.message);
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

      await supabase
        .from('coin_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

    } else {
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
  } catch (error: any) {
    console.error('[PayTR Callback] Exception:', error?.message);
    return new NextResponse('OK', { status: 200 });
  }
}
