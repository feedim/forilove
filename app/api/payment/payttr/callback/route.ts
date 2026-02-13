import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * PayTR Callback (IPN) endpoint
 * PayTR ödeme sonucunu buraya POST eder
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasEnvVars: !!(process.env.PAYTTR_MERCHANT_KEY && process.env.PAYTTR_MERCHANT_SALT),
  });
}

export async function POST(request: NextRequest) {
  console.log('[PayTR Callback] ▶ Request received');
  const supabase = createAdminClient();

  try {
    const formData = await request.formData();

    const merchant_oid = formData.get('merchant_oid') as string;
    const status = formData.get('status') as string;
    const total_amount = formData.get('total_amount') as string;
    const hash = formData.get('hash') as string;

    // Alan validasyonu — eksik alan varsa muhtemel geçici/parsing hatası → retry etsin
    if (!merchant_oid || !status || !total_amount || !hash) {
      console.error('[PayTR Callback] Missing required fields:', {
        merchant_oid: !!merchant_oid,
        status: !!status,
        total_amount: !!total_amount,
        hash: !!hash,
      });
      return new NextResponse('FAIL', { status: 500 });
    }

    console.log('[PayTR Callback] merchant_oid:', merchant_oid, 'status:', status, 'amount:', total_amount);

    const merchant_key = (process.env.PAYTTR_MERCHANT_KEY || '').trim();
    const merchant_salt = (process.env.PAYTTR_MERCHANT_SALT || '').trim();

    if (!merchant_key || !merchant_salt) {
      console.error('[PayTR Callback] Missing env vars');
      return new NextResponse('FAIL', { status: 500 });
    }

    // Hash doğrulama — HMAC key = merchant_key
    const hashSTR = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
    const calculatedHash = crypto.createHmac('sha256', merchant_key).update(hashSTR).digest('base64');

    const hashBuffer = Buffer.from(hash, 'utf8');
    const calculatedBuffer = Buffer.from(calculatedHash, 'utf8');
    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      console.error('[PayTR Callback] Hash mismatch for', merchant_oid);
      // Hatalı/tamper edilmiş istek — retry faydasız, 200 OK dönerek durdur.
      return new NextResponse('OK', { status: 200 });
    }

    console.log('[PayTR Callback] Hash verified for', merchant_oid);

    // Ödeme kaydını bul
    const { data: payment, error: paymentError } = await supabase
      .from('coin_payments')
      .select('*, coin_packages(*)')
      .eq('payment_id', merchant_oid)
      .single();

    if (paymentError || !payment) {
      console.error('[PayTR Callback] Payment not found (will retry):', merchant_oid, paymentError?.message);
      // Olası yarış/gecikme — retry ile yeniden denesin
      return new NextResponse('FAIL', { status: 500 });
    }

    // Zaten işlenmiş mi kontrol et (idempotency)
    if (payment.status === 'completed') {
      console.log('[PayTR Callback] Already completed, skipping:', merchant_oid);
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
      console.log('[PayTR Callback] Processing success for', merchant_oid, 'coins:', totalCoins, 'user:', payment.user_id);

      // 1. Mevcut bakiyeyi al
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('user_id', payment.user_id)
        .single();

      if (profileError || !profile) {
        console.error('[PayTR Callback] Profile not found (will retry):', merchant_oid, 'user:', payment.user_id, profileError?.message);
        // Payment "pending" kalır → PayTR retry edecek
        return new NextResponse('FAIL', { status: 500 });
      }

      const oldBalance = profile.coin_balance || 0;
      const newBalance = oldBalance + totalCoins;
      console.log('[PayTR Callback] Balance update:', merchant_oid, `${oldBalance} + ${totalCoins} = ${newBalance}`);

      // 2. Bakiyeyi artır + .select() ile doğrula
      const { data: updatedRows, error: updateError } = await supabase
        .from('profiles')
        .update({ coin_balance: newBalance })
        .eq('user_id', payment.user_id)
        .select('coin_balance');

      if (updateError) {
        console.error('[PayTR Callback] Balance update failed (will retry):', merchant_oid, updateError.message);
        // Payment "pending" kalır → PayTR retry edecek
        return new NextResponse('FAIL', { status: 500 });
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error('[PayTR Callback] Balance update affected 0 rows (will retry):', merchant_oid, 'user:', payment.user_id);
        // Payment "pending" kalır → PayTR retry edecek
        return new NextResponse('FAIL', { status: 500 });
      }

      console.log('[PayTR Callback] Balance updated successfully:', merchant_oid, 'new_balance:', updatedRows[0].coin_balance);

      // 3. Transaction kaydı ekle (kritik değil, coin zaten eklendi)
      const { error: txError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: payment.user_id,
          amount: totalCoins,
          type: 'purchase',
          description: `${payment.coin_packages?.name || 'Paket'} satın alındı`,
          reference_id: payment.id,
          reference_type: 'payment',
        });

      if (txError) {
        console.error('[PayTR Callback] Transaction record failed (non-critical):', merchant_oid, txError.message);
      }

      // 4. Ödemeyi completed olarak işaretle
      await supabase
        .from('coin_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      console.log('[PayTR Callback] ✓ Completed for', merchant_oid, 'coins:', totalCoins, 'new_balance:', updatedRows[0].coin_balance);

    } else {
      console.log('[PayTR Callback] Payment failed by PayTR:', merchant_oid, 'status:', status);
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
    console.error('[PayTR Callback] Exception (will retry):', error?.message, error?.stack);
    // Geçici hata olabilir → non-200 dön, PayTR retry etsin
    return new NextResponse('FAIL', { status: 500 });
  }
}
