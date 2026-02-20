"use client";

import NewEditorPage from "@/app/dashboard/editor/[templateId]/page";

export default function GuestEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  return <NewEditorPage params={params} guestMode />;
}
