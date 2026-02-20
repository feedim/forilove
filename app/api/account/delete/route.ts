import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST — soft-delete account (14-day grace period)
export async function POST(request: Request) {
  try {
    // CSRF protection
    const origin = request.headers.get('origin') || '';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (!origin || !siteUrl || origin !== siteUrl.replace(/\/$/, '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Parse optional reason from body
    let reason: string | null = null;
    try {
      const body = await request.json();
      if (body.reason && typeof body.reason === 'string') {
        reason = body.reason.slice(0, 500);
      }
    } catch {}

    // Soft-delete: mark as deleted, don't remove data
    const { error } = await admin
      .from('profiles')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        delete_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Hesap silme hatası' }, { status: 500 });
  }
}

// PUT — reactivate deleted account (within 14-day grace period)
export async function PUT() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('status, deleted_at')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.status !== 'deleted') {
      return NextResponse.json({ error: 'Hesap silinmemiş' }, { status: 400 });
    }

    // Check 14-day window
    if (profile.deleted_at) {
      const deletedAt = new Date(profile.deleted_at).getTime();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - deletedAt > fourteenDays) {
        return NextResponse.json({ error: 'Hesap kurtarma süresi dolmuş' }, { status: 410 });
      }
    }

    const { error } = await admin
      .from('profiles')
      .update({
        status: 'active',
        deleted_at: null,
        delete_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Hesap kurtarma hatası' }, { status: 500 });
  }
}
