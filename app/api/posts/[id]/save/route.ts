import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlan, checkDailyLimit, logRateLimitHit } from '@/lib/limits';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .single();

    if (existing) {
      // Unsave
      await supabase.from('bookmarks').delete().eq('id', existing.id);
      return NextResponse.json({ saved: false });
    }

    // Daily save limit check
    const admin = createAdminClient();
    const plan = await getUserPlan(admin, user.id);
    const { allowed, limit } = await checkDailyLimit(admin, user.id, 'save', plan);
    if (!allowed) {
      logRateLimitHit(admin, user.id, 'save', request.headers.get('x-forwarded-for')?.split(',')[0]?.trim());
      return NextResponse.json(
        { error: `Günlük kaydetme limitine ulaştın (${limit}). Premium ile artır.`, limit, remaining: 0 },
        { status: 429 }
      );
    }

    // Save
    const { error } = await supabase
      .from('bookmarks')
      .insert({ user_id: user.id, post_id: postId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
