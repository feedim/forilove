import { createAdminClient } from '@/lib/supabase/admin'

export interface BlogPost {
  id: string
  slug: string
  title: string
  description: string
  keywords: string[]
  content: string
  date: string
  readTime: string
  coverImage?: string
  updatedAt?: string
}

function mapRow(row: any): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    keywords: row.keywords || [],
    content: row.content,
    date: row.created_at,
    readTime: row.read_time,
    coverImage: row.cover_image_url || undefined,
    updatedAt: row.updated_at,
  }
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return (data || []).map(mapRow)
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  return data ? mapRow(data) : undefined
}

export function getWordCount(html: string): number {
  return html.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
}
