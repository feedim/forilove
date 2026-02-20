"use client";

import { useEffect, useRef } from "react";

interface LoadMoreTriggerProps {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
}

export default function LoadMoreTrigger({ onLoadMore, loading, hasMore }: LoadMoreTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) callbackRef.current();
      },
      { rootMargin: "0px 0px 200px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-4">
      {loading && <span className="loader" style={{ width: 20, height: 20 }} />}
    </div>
  );
}
