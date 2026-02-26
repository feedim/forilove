import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role: only affiliate or admin
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "affiliate" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    // Validate PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Sadece PDF dosyası yüklenebilir" }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Dosya çok büyük. Maksimum 5MB." }, { status: 400 });
    }

    const timestamp = Date.now();
    const fileName = `${user.id}_${timestamp}.pdf`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("invoices")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      if (process.env.NODE_ENV === "development") console.error("Invoice upload error:", uploadError);
      return NextResponse.json({ error: "Dosya yüklenemedi" }, { status: 500 });
    }

    const { data: urlData } = admin.storage
      .from("invoices")
      .getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Invoice upload error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
