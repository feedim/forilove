import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify, transliterateTurkish, formatTagName } from '@/lib/utils';
import { VALIDATION } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const q = request.nextUrl.searchParams.get('q') || '';
    const followed = request.nextUrl.searchParams.get('followed');

    // Return followed tag IDs for the current user
    if (followed === 'true') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ followedTagIds: [] });
      const { data } = await supabase
        .from('tag_follows')
        .select('tag_id')
        .eq('user_id', user.id);
      return NextResponse.json({ followedTagIds: (data || []).map(d => d.tag_id) });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 100);

    let query = supabase
      .from('tags')
      .select('id, name, slug, post_count')
      .order('post_count', { ascending: false })
      .limit(limit);

    if (q.trim()) {
      const transliterated = transliterateTurkish(q.trim());
      query = query.or(`slug.ilike.%${transliterated}%,name.ilike.%${q.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ tags: data });
    response.headers.set('Cache-Control', 'public, s-maxage=300');
    return response;
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Etiket adı gerekli' }, { status: 400 });
    }

    const trimmedName = name.trim().replace(/\s+/g, ' ').substring(0, VALIDATION.tagName.max);

    if (trimmedName.length < VALIDATION.tagName.min) {
      return NextResponse.json({ error: `Etiket en az ${VALIDATION.tagName.min} karakter olmalı` }, { status: 400 });
    }

    // Only allowed characters (letters, numbers, spaces, hyphens, dots, &, #, +)
    if (!VALIDATION.tagName.pattern.test(trimmedName)) {
      return NextResponse.json({ error: 'Etiket adı geçersiz karakterler içeriyor' }, { status: 400 });
    }

    // No HTML tags
    if (/<[^>]+>/.test(trimmedName)) {
      return NextResponse.json({ error: 'Etiket adında HTML kullanılamaz' }, { status: 400 });
    }

    // No URLs
    if (/^(https?:\/\/|www\.)\S+$/i.test(trimmedName)) {
      return NextResponse.json({ error: 'Etiket adı bir URL olamaz' }, { status: 400 });
    }

    // No only numbers
    if (/^\d+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Etiket sadece sayılardan oluşamaz' }, { status: 400 });
    }

    // Display name: Title Case with Turkish chars preserved
    const displayName = formatTagName(trimmedName);
    const slug = slugify(trimmedName);

    if (!slug || !displayName) {
      return NextResponse.json({ error: 'Geçersiz etiket adı' }, { status: 400 });
    }

    // Use admin client to bypass RLS for tag creation
    const admin = createAdminClient();

    // Check if exists
    const { data: existing } = await admin
      .from('tags')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ tag: existing });
    }

    const { data: newTag, error } = await admin
      .from('tags')
      .insert({ name: displayName, slug })
      .select('id, name, slug')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag: newTag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
