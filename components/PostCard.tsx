import { memo } from "react";
import Link from "next/link";
import { Heart, Eye } from "lucide-react";
import { formatRelativeDate, formatCount } from "@/lib/utils";
import VerifiedBadge, { getBadgeVariant } from "@/components/VerifiedBadge";

interface PostCardProps {
  post: {
    id: number;
    title: string;
    slug: string;
    excerpt?: string;
    featured_image?: string;
    reading_time?: number;
    like_count?: number;
    comment_count?: number;
    view_count?: number;
    published_at?: string;
    profiles?: {
      user_id: string;
      name?: string;
      surname?: string;
      full_name?: string;
      username: string;
      avatar_url?: string;
      is_verified?: boolean;
      premium_plan?: string | null;
    };
  };
}

export default memo(function PostCard({ post }: PostCardProps) {
  const author = post.profiles;

  return (
    <article className="my-[5px] mx-1 sm:mx-3 py-4 px-2.5 sm:px-4 rounded-[14px] hover:bg-bg-secondary/60 transition-colors">
      {/* Post Head — author info */}
      <Link href={`/post/${post.slug}`} className="block">
        <div className="flex items-center gap-2 mb-2.5">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={author?.username || ""} className="h-7 w-7 rounded-full object-cover shrink-0" loading="lazy" />
          ) : (
            <img className="default-avatar-auto h-7 w-7 rounded-full object-cover shrink-0" alt="" loading="lazy" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[0.82rem] font-semibold truncate">{author?.username || "Anonim"}</span>
              {author?.is_verified && <VerifiedBadge variant={getBadgeVariant(author?.premium_plan)} />}
            </div>
            {post.published_at && <p className="text-[0.68rem] text-text-muted leading-tight">{formatRelativeDate(post.published_at)}</p>}
          </div>
        </div>

        {/* Content area */}
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-[1.05rem] font-semibold leading-snug text-text-primary mb-1.5 line-clamp-2">
              {post.title}
            </h3>
            {post.excerpt && (
              <p className="text-sm text-text-muted leading-relaxed line-clamp-2 mb-0">
                {post.excerpt}
              </p>
            )}
          </div>

          {/* Thumbnail */}
          <div className="w-[120px] h-[80px] shrink-0 rounded-lg overflow-hidden bg-bg-secondary">
            {post.featured_image ? (
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted/30">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-2 text-[0.72rem] text-text-muted">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatCount(post.like_count || 0)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCount(post.view_count || 0)}
          </span>
        </div>
      </Link>
    </article>
  );
});
