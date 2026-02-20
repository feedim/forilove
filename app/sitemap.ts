import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllPosts } from '@/lib/blog/posts'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.forilove.com'
  const now = new Date().toISOString()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/paketler`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fl-coins`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/affiliate`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/affiliate/circle`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/kvkk`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/distance-sales-contract`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/pre-information-form`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/payment-security`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
  ]

  // Blog posts
  const allBlogPosts = await getAllPosts()
  const blogPosts: MetadataRoute.Sitemap = allBlogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt || post.date).toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Tag pages
  let tagPages: MetadataRoute.Sitemap = []
  try {
    const supabaseForTags = await createClient()
    const { data: tags } = await supabaseForTags
      .from('tags')
      .select('slug')

    if (tags) {
      tagPages = tags.map((tag) => ({
        url: `${baseUrl}/tag/${tag.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Sitemap still works without tags
  }

  // Bundle pages
  let bundlePages: MetadataRoute.Sitemap = []
  try {
    const supabaseForBundles = await createClient()
    const { data: bundles } = await supabaseForBundles
      .from('bundles')
      .select('slug, updated_at')
      .eq('is_active', true)

    if (bundles) {
      bundlePages = bundles.map((bundle) => ({
        url: `${baseUrl}/paketler/${bundle.slug}`,
        lastModified: new Date(bundle.updated_at).toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Sitemap still works without bundles
  }

  // Dynamic pages: published public projects
  let dynamicPages: MetadataRoute.Sitemap = []
  try {
    const supabase = await createClient()
    const { data: projects } = await supabase
      .from('projects')
      .select('slug, updated_at')
      .eq('is_published', true)
      .eq('is_public', true)
      .order('view_count', { ascending: false })
      .limit(1000)

    if (projects) {
      dynamicPages = projects.map((project) => ({
        url: `${baseUrl}/p/${project.slug}`,
        lastModified: new Date(project.updated_at).toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch {
    // Sitemap still works with static pages
  }

  return [...staticPages, ...blogPosts, ...tagPages, ...bundlePages, ...dynamicPages]
}
