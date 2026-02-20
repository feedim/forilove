import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMetaKeywordsAI } from '@/lib/seo';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, content, tags } = await request.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const keyword = await generateMetaKeywordsAI(
      title.trim(),
      content || '',
      { tags: Array.isArray(tags) ? tags : [] }
    );

    return NextResponse.json({ keyword });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
