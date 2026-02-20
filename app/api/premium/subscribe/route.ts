import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const body = await request.json();
    const { plan_id, payment_ref, coupon_code } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'Plan seçilmedi' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get plan details
    const { data: plan } = await admin
      .from('premium_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 });
    }

    // Check if user already has active subscription
    const { data: existingSub } = await admin
      .from('premium_subscriptions')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // Calculate expiry date
    const now = new Date();
    let expiresAt: Date;
    if (existingSub) {
      // Extend from current expiry
      expiresAt = new Date(existingSub.expires_at);
    } else {
      expiresAt = new Date(now);
    }

    if (plan.period === 'yil') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Apply coupon if provided
    let discountPercent = 0;
    let couponId: number | null = null;
    if (coupon_code) {
      const { data: coupon } = await admin
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (coupon) {
        const validType = !coupon.applies_to || coupon.applies_to === `premium_${plan_id}`;
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) > now;
        const notMaxed = !coupon.max_uses || coupon.current_uses < coupon.max_uses;

        // Check if user already used this coupon
        const { count: usageCount } = await admin
          .from('coupon_usages')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('user_id', user.id);

        if (validType && notExpired && notMaxed && (usageCount || 0) === 0) {
          discountPercent = coupon.discount_percent;
          couponId = coupon.id;
        }
      }
    }

    const originalAmount = Number(plan.price);
    const discountAmount = discountPercent > 0 ? (originalAmount * discountPercent) / 100 : 0;
    const finalAmount = originalAmount - discountAmount;

    // Create subscription
    if (existingSub) {
      await admin
        .from('premium_subscriptions')
        .update({
          plan_id,
          expires_at: expiresAt.toISOString(),
          amount_paid: finalAmount,
        })
        .eq('id', existingSub.id);
    } else {
      await admin.from('premium_subscriptions').insert({
        user_id: user.id,
        plan_id,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        payment_method: payment_ref ? 'paytr' : 'dev',
        amount_paid: finalAmount,
      });
    }

    // Create payment record
    const { data: payment } = await admin.from('premium_payments').insert({
      user_id: user.id,
      plan_id,
      amount_paid: finalAmount,
      status: 'completed',
      payment_method: payment_ref ? 'paytr' : 'dev',
      payment_ref: payment_ref || `dev_${Date.now()}`,
      completed_at: now.toISOString(),
    }).select('id').single();

    // Update profile premium status
    await admin
      .from('profiles')
      .update({
        is_premium: true,
        premium_plan: plan_id,
        premium_until: expiresAt.toISOString(),
      })
      .eq('user_id', user.id);

    // Record coupon usage (atomic increment to prevent race condition)
    if (couponId && payment) {
      await admin.from('coupon_usages').insert({
        coupon_id: couponId,
        user_id: user.id,
        payment_id: payment.id,
        discount_amount: discountAmount,
      });
      // Atomic increment — avoids read-modify-write race condition
      await admin.rpc('increment_coupon_uses', { coupon_id_param: couponId });
    }

    // Notification
    await createNotification({
      admin,
      user_id: user.id,
      actor_id: user.id,
      type: 'premium_activated',
      content: `Premium ${plan.name} planına hoş geldiniz!`,
    });

    return NextResponse.json({
      success: true,
      plan: plan.name,
      expires_at: expiresAt.toISOString(),
      amount_paid: finalAmount,
      discount: discountAmount,
    });
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// GET: Check subscription status
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const admin = createAdminClient();

    const { data: subscription } = await admin
      .from('premium_subscriptions')
      .select('*, premium_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ active: false });
    }

    const isExpired = new Date(subscription.expires_at) < new Date();

    if (isExpired) {
      // Auto-expire
      await Promise.all([
        admin.from('premium_subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id),
        admin.from('profiles')
          .update({ is_premium: false, premium_plan: null, premium_until: null })
          .eq('user_id', user.id),
      ]);

      await createNotification({
        admin,
        user_id: user.id,
        actor_id: user.id,
        type: 'premium_expired',
        content: 'Premium üyeliğiniz sona erdi.',
      });

      return NextResponse.json({ active: false, expired: true });
    }

    return NextResponse.json({
      active: true,
      plan_id: subscription.plan_id,
      plan_name: subscription.premium_plans?.name,
      expires_at: subscription.expires_at,
      auto_renew: subscription.auto_renew,
      started_at: subscription.started_at,
    });
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// DELETE: Cancel subscription
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const admin = createAdminClient();

    const { data: subscription } = await admin
      .from('premium_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: 'Aktif abonelik bulunamadı' }, { status: 404 });
    }

    await admin
      .from('premium_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        auto_renew: false,
      })
      .eq('id', subscription.id);

    // Premium stays until expiry, just stop auto-renew
    await createNotification({
      admin,
      user_id: user.id,
      actor_id: user.id,
      type: 'premium_cancelled',
      content: 'Premium üyeliğiniz iptal edildi. Süre sonuna kadar özellikler aktif kalacaktır.',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
