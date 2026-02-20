import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: List user's sessions
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: sessions } = await admin
      .from("sessions")
      .select("id, device_hash, ip_address, user_agent, is_active, is_trusted, created_at, last_active_at")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ sessions: sessions || [] });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// POST: Record current session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { device_hash, user_agent } = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";

    const admin = createAdminClient();

    // Check if session with same device_hash exists
    if (device_hash) {
      const { data: existing } = await admin
        .from("sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("device_hash", device_hash)
        .eq("is_active", true)
        .single();

      if (existing) {
        // Update last_active_at
        await admin
          .from("sessions")
          .update({ last_active_at: new Date().toISOString(), ip_address: ip })
          .eq("id", existing.id);
        return NextResponse.json({ session_id: existing.id });
      }
    }

    // Check max 5 trusted devices
    const { count: trustedCount } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    // Insert new session
    const { data: session } = await admin
      .from("sessions")
      .insert({
        user_id: user.id,
        device_hash: device_hash || null,
        ip_address: ip,
        user_agent: user_agent || null,
        is_active: true,
        is_trusted: (trustedCount || 0) < 5,
      })
      .select("id")
      .single();

    return NextResponse.json({ session_id: session?.id, total_sessions: (trustedCount || 0) + 1 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// PUT: Update session trust status
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { session_id, is_trusted } = await req.json();
    if (!session_id || typeof is_trusted !== "boolean") {
      return NextResponse.json({ error: "session_id ve is_trusted gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("sessions")
      .update({ is_trusted })
      .eq("id", session_id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// DELETE: End a session or all sessions
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("id");
    const all = req.nextUrl.searchParams.get("all") === "true";

    const admin = createAdminClient();

    if (all) {
      // End all sessions except current
      await admin
        .from("sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_active", true);
      return NextResponse.json({ success: true, message: "Tüm oturumlar sonlandırıldı" });
    }

    if (sessionId) {
      // End specific session
      const { error } = await admin
        .from("sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Session ID gerekli" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
