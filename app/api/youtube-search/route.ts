import { NextRequest, NextResponse } from "next/server";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
];

interface PipedItem {
  type: string;
  url: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  duration: number;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(
        `${instance}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const items = (data.items || [])
        .filter((item: PipedItem) => item.type === "stream" && item.url)
        .slice(0, 20)
        .map((item: PipedItem) => {
          const videoId = item.url?.replace("/watch?v=", "") || "";
          return {
            id: videoId,
            title: item.title || "",
            artist: item.uploaderName || "",
            thumbnail: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            duration: item.duration || 0,
          };
        });

      return NextResponse.json({ items });
    } catch {
      continue;
    }
  }

  // All instances failed
  return NextResponse.json({ items: [] });
}
