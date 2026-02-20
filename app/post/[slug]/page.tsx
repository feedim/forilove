import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserId } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import PostInteractionBar from "@/components/PostInteractionBar";
import PostHeaderActions from "@/components/PostHeaderActions";
import RelatedPosts from "@/components/RelatedPosts";
import Link from "next/link";

import { formatRelativeDate } from "@/lib/utils";
import PostStats from "@/components/PostStats";
import DOMPurify from "isomorphic-dompurify";
import PostContentClient from "@/components/PostContentClient";
import PostViewTracker from "@/components/PostViewTracker";
import VerifiedBadge, { getBadgeVariant } from "@/components/VerifiedBadge";
import PostFollowButton from "@/components/PostFollowButton";
import AdBanner from "@/components/AdBanner";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(rawSlug: string) {
  // Use admin client for public reads — bypasses JWT validation entirely.
  // Published posts are public content; no auth dependency needed.
  const admin = createAdminClient();
  const slug = decodeURIComponent(rawSlug);

  const { data: post, error } = await admin
    .from("posts")
    .select(`
      *,
      profiles!posts_author_id_fkey(user_id, name, surname, full_name, username, avatar_url, is_verified, is_premium, premium_plan, profile_score, follower_count, post_count, status, account_private),
      post_tags(tag_id, tags(id, name, slug)),
      post_categories(category_id, categories(id, name, slug))
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !post) return null;

  // Check author status
  const author = post.profiles;
  if (author?.status && author.status !== 'active') return null;

  return post;
}

async function getRelatedPosts(postId: number, categoryIds: number[]) {
  if (categoryIds.length === 0) return [];
  const admin = createAdminClient();

  const { data: catPostIds } = await admin
    .from("post_categories")
    .select("post_id")
    .in("category_id", categoryIds)
    .neq("post_id", postId);

  if (!catPostIds || catPostIds.length === 0) return [];

  const { data: posts } = await admin
    .from("posts")
    .select(`
      id, title, slug, excerpt, featured_image, reading_time, like_count, comment_count, save_count, published_at,
      profiles!posts_author_id_fkey(user_id, name, surname, full_name, username, avatar_url, is_verified, premium_plan)
    `)
    .in("id", catPostIds.map(cp => cp.post_id))
    .eq("status", "published")
    .order("trending_score", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (posts || []).map((p: any) => ({
    ...p,
    profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
  }));
}

async function getAuthorPosts(authorId: string, currentPostId: number) {
  const admin = createAdminClient();

  // Check author quality first
  const { data: authorProfile } = await admin
    .from("profiles")
    .select("profile_score, follower_count, is_verified, post_count, status")
    .eq("user_id", authorId)
    .single();

  if (!authorProfile) return [];

  // Quality gate: author must meet minimum criteria
  const ps = authorProfile.profile_score || 0;
  const fc = authorProfile.follower_count || 0;
  const pc = authorProfile.post_count || 0;
  const isVerified = authorProfile.is_verified || false;

  // Require: (profile_score >= 15 OR verified) AND (follower >= 1 OR post_count >= 3)
  if (ps < 15 && !isVerified) return [];
  if (fc < 1 && pc < 3) return [];
  if (authorProfile.status !== "active") return [];

  const { data: posts } = await admin
    .from("posts")
    .select(`
      id, title, slug, excerpt, featured_image, reading_time, like_count, comment_count, save_count, published_at, word_count,
      profiles!posts_author_id_fkey(user_id, name, surname, full_name, username, avatar_url, is_verified, premium_plan)
    `)
    .eq("author_id", authorId)
    .eq("status", "published")
    .neq("id", currentPostId)
    .gte("word_count", 30)
    .order("trending_score", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (posts || []).map((p: any) => ({
    ...p,
    profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
  }));
}

const getCachedPost = unstable_cache(getPost, ["post-by-slug"], { revalidate: 60, tags: ["posts"] });
const getCachedRelatedPosts = unstable_cache(getRelatedPosts, ["related-posts"], { revalidate: 600, tags: ["posts"] });
const getCachedAuthorPosts = unstable_cache(getAuthorPosts, ["author-posts"], { revalidate: 600, tags: ["posts"] });

async function getUserInteractions(postId: number) {
  const userId = await getAuthUserId();
  if (!userId) return { liked: false, saved: false, userId: null };

  const admin = createAdminClient();
  const [{ data: like }, { data: bookmark }] = await Promise.all([
    admin.from("likes").select("id").eq("user_id", userId).eq("post_id", postId).single(),
    admin.from("bookmarks").select("id").eq("user_id", userId).eq("post_id", postId).single(),
  ]);

  return { liked: !!like, saved: !!bookmark, userId };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) return { title: "Post bulunamadı" };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://feedim.com";
  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || "";
  const url = `${baseUrl}/post/${encodeURIComponent(post.slug)}`;
  const authorName = post.profiles?.full_name || post.profiles?.username || "Feedim";

  const keywords = post.meta_keywords
    ? post.meta_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : undefined;

  return {
    title: `${title} | Feedim`,
    description,
    keywords,
    authors: [{ name: authorName }],
    openGraph: {
      title,
      description,
      type: "article",
      url,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [authorName],
      images: post.featured_image ? [{ url: post.featured_image, width: 1200, height: 630 }] : undefined,
      siteName: "Feedim",
      locale: "tr_TR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) notFound();

  // Private account check — only author + followers can view
  const postAuthor = post.profiles;
  if (postAuthor?.account_private) {
    const userId = await getAuthUserId();
    if (userId !== postAuthor.user_id) {
      const adminClient = createAdminClient();
      const { data: follow } = await adminClient
        .from('follows').select('id')
        .eq('follower_id', userId || '').eq('following_id', postAuthor.user_id).single();
      if (!follow) notFound();
    }
  }

  const categoryIds = (post.post_categories || []).map((pc: { category_id: number }) => pc.category_id);
  const [relatedPosts, authorPosts, interactions] = await Promise.all([
    getCachedRelatedPosts(post.id, categoryIds),
    getCachedAuthorPosts(post.author_id, post.id),
    getUserInteractions(post.id),
  ]);

  const author = post.profiles;
  const authorName = author?.full_name || [author?.name, author?.surname].filter(Boolean).join(" ") || author?.username || "Anonim";
  const isOwnPost = interactions.userId === author?.user_id;
  const tags = (post.post_tags || []).map((pt: { tags: { id: number; name: string; slug: string } }) => pt.tags).filter(Boolean);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://feedim.com";

  const sanitizedContent = DOMPurify.sanitize(post.content || "", {
    ALLOWED_TAGS: ['h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre', 'sub', 'sup', 'mark', 'del', 's'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class', 'colspan', 'rowspan'],
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    image: post.featured_image || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    wordCount: post.word_count,
    author: { "@type": "Person", name: authorName, url: `${baseUrl}/u/${author?.username}` },
    publisher: { "@type": "Organization", name: "Feedim", url: baseUrl },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}/post/${encodeURIComponent(post.slug)}` },
  };

  return (
    <div className="overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostViewTracker postId={post.id} />
        {/* Main content */}
        <article className="px-4 sm:px-5 py-3 md:py-5">
          {/* PostHeaderActions — portals to header */}
          <PostHeaderActions
            postId={post.id}
            postUrl={`/post/${post.slug}`}
            postTitle={post.title}
            authorUsername={author?.username}
            isOwnPost={isOwnPost}
            postSlug={post.slug}
            portalToHeader
          />

          {/* Stats — views + likes */}
          <div className="mb-3">
            <PostStats viewCount={post.view_count || 0} likeCount={post.like_count || 0} postId={post.id} />
          </div>

          {/* Title */}
          <h1 className="text-[1.44rem] font-bold leading-[1.36] mb-5">{post.title}</h1>

          {/* Author — PostHead */}
          <div className="flex items-center gap-2 mb-3">
            {author?.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={authorName}
                className="h-10 w-10 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <img className="default-avatar-auto h-10 w-10 rounded-full object-cover shrink-0" alt="" loading="lazy" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link href={`/u/${author?.username}`} className="font-semibold text-[0.85rem] hover:underline truncate">@{author?.username}</Link>
                {author?.is_verified && <VerifiedBadge size="sm" variant={getBadgeVariant(author?.premium_plan)} />}
              </div>
              <div className="flex items-center gap-2.5 text-[0.65rem] text-text-muted">
                {post.published_at && (
                  <span>{formatRelativeDate(post.published_at)}</span>
                )}
              </div>
            </div>
            <PostFollowButton authorUsername={author?.username || ""} authorUserId={author?.user_id || ""} />
          </div>

          {/* Featured Image + Content (client component for image viewer) */}
          <PostContentClient
            html={sanitizedContent}
            featuredImage={post.featured_image ? { src: post.featured_image, alt: post.title } : undefined}
            className={[
              // Base
              "text-[0.95rem] leading-[1.74] text-text-readable",
              // Headings
              "[&_h2]:text-[1.30rem] [&_h2]:font-bold [&_h2]:leading-[1.36] [&_h2]:mt-8 [&_h2]:mb-3",
              "[&_h3]:text-[1.25rem] [&_h3]:font-bold [&_h3]:leading-[1.38] [&_h3]:mt-6 [&_h3]:mb-2",
              "[&_h4]:text-[1.1rem] [&_h4]:font-semibold [&_h4]:leading-[1.4] [&_h4]:mt-5 [&_h4]:mb-2",
              // Paragraph & links
              "[&_p]:mb-4",
              "[&_a]:text-accent-main [&_a]:underline",
              // Images
              "[&_img]:rounded-[21px] [&_img]:max-w-full [&_img]:my-4 [&_img]:cursor-zoom-in",
              // Blockquote
              "[&_blockquote]:my-5 [&_blockquote]:pl-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-text-muted/30 [&_blockquote]:text-text-muted [&_blockquote]:italic",
              // Lists
              "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4",
              "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4",
              "[&_li]:mb-1.5 [&_li]:leading-[1.7]",
              // Table (responsive: overflow-x-auto on container, table min-width)
              "overflow-x-auto",
              "[&_table]:w-full [&_table]:my-5 [&_table]:border-collapse [&_table]:text-[0.88rem] [&_table]:border [&_table]:border-border-primary [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:min-w-[320px]",
              "[&_th]:text-left [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2.5 [&_th]:border [&_th]:border-border-primary [&_th]:bg-bg-secondary/50",
              "[&_td]:px-3 [&_td]:py-2.5 [&_td]:border [&_td]:border-border-primary",
              // Code
              "[&_code]:text-[0.85em] [&_code]:bg-bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono",
              "[&_pre]:my-5 [&_pre]:bg-bg-secondary [&_pre]:rounded-xl [&_pre]:px-5 [&_pre]:py-4 [&_pre]:overflow-x-auto [&_pre]:text-[0.85rem] [&_pre]:leading-[1.6]",
              "[&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0",
              // HR
              "[&_hr]:my-6 [&_hr]:border-border-primary",
              // Figure
              "[&_figure]:my-4",
              "[&_figcaption]:text-sm [&_figcaption]:text-text-muted [&_figcaption]:text-center [&_figcaption]:mt-2 [&_figcaption]:italic",
              // Inline formatting
              "[&_mark]:bg-yellow-200/40 [&_mark]:px-0.5 [&_mark]:rounded-sm",
              "[&_del]:text-text-muted [&_s]:text-text-muted",
              // Iframe
              "[&_iframe]:rounded-[12px] [&_iframe]:max-w-full [&_iframe]:my-4",
            ].join(" ")}
          />

          {/* PostNavBar — Like, Comment, Save, More */}
          <PostInteractionBar
            postId={post.id}
            initialLiked={interactions.liked}
            initialSaved={interactions.saved}
            likeCount={post.like_count || 0}
            commentCount={post.comment_count || 0}
            saveCount={post.save_count || 0}
            shareCount={post.share_count || 0}
            viewCount={post.view_count || 0}
            hideStats
            isOwnPost={isOwnPost}
            postUrl={`/post/${post.slug}`}
            postTitle={post.title}
            postSlug={post.slug}
            authorUsername={author?.username}
          >
            {/* Tags — liked-by ile interaction bar arasında */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {tags.map((tag: { id: number; name: string; slug: string }) => (
                  <Link
                    key={tag.id}
                    href={`/dashboard/explore/tag/${tag.slug}`}
                    className="bg-bg-secondary text-text-primary text-[0.88rem] sm:text-[0.8rem] font-bold px-4 sm:px-3 py-2 sm:py-1.5 rounded-full transition hover:bg-bg-tertiary"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </PostInteractionBar>

          {/* Ad placement — after content */}
          <AdBanner slot="post-detail" size="rectangle" className="my-6" />

          {/* Author's other posts */}
          {authorPosts.length > 0 && (
            <RelatedPosts
              posts={authorPosts}
              title={`${authorName} adlı kişiden daha fazla`}
            />
          )}

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <RelatedPosts
              posts={relatedPosts}
              title={authorPosts.length > 0 ? "Benzer Yazılar" : undefined}
            />
          )}
        </article>

        {/* Ad placement — bottom of page */}
        <AdBanner slot="post-bottom" size="leaderboard" className="my-4 px-4" />
    </div>
  );
}
