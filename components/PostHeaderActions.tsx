"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import PostMoreModal from "@/components/modals/PostMoreModal";
import ShareModal from "@/components/modals/ShareModal";

interface PostHeaderActionsProps {
  postId: number;
  postUrl: string;
  postTitle: string;
  authorUsername?: string;
  isOwnPost?: boolean;
  postSlug?: string;
  portalToHeader?: boolean;
}

export default function PostHeaderActions({ postId, postUrl, postTitle, authorUsername, isOwnPost, postSlug, portalToHeader }: PostHeaderActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<Element | null>(null);

  useEffect(() => {
    setMounted(true);
    if (portalToHeader) {
      setHeaderSlot(document.getElementById("header-right-slot"));
    }
  }, [portalToHeader]);

  const button = (
    <button
      onClick={() => setMoreOpen(true)}
      className="flex items-center justify-center w-9 h-9 rounded-full text-text-primary transition"
    >
      <MoreHorizontal className="h-[20px] w-[20px]" />
    </button>
  );

  const modals = (
    <>
      <PostMoreModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        postId={postId}
        postUrl={postUrl}
        authorUsername={authorUsername}
        onShare={() => setShareOpen(true)}
        isOwnPost={isOwnPost}
        postSlug={postSlug}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={postUrl}
        title={postTitle}
        postId={postId}
      />
    </>
  );

  // Portal mode: render nothing during SSR, portal after mount
  if (portalToHeader) {
    if (!mounted) return null;
    return (
      <>
        {headerSlot ? createPortal(button, headerSlot) : null}
        {modals}
      </>
    );
  }

  return (
    <>
      {button}
      {modals}
    </>
  );
}
