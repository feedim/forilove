import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  const redirectTo = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Debug: show what happened instead of redirecting
  const cookieHeaders = response.headers.getSetCookie();
  const debugHtml = `<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:monospace;padding:40px">
    <h1>Auth Callback Debug</h1>
    <p><b>Code:</b> ${code.substring(0, 20)}...</p>
    <p><b>Error:</b> ${error ? error.message : 'none'}</p>
    <p><b>User:</b> ${data?.user?.email || 'null'}</p>
    <p><b>Session:</b> ${data?.session ? 'exists' : 'null'}</p>
    <p><b>Cookies set:</b> ${cookieHeaders.length}</p>
    <ul>${cookieHeaders.map(c => `<li>${c.split('=')[0]}=...</li>`).join('')}</ul>
    <br><a href="/dashboard" style="color:#e63e7a">Dashboard'a git →</a>
  </body></html>`;

  return new NextResponse(debugHtml, {
    headers: { "Content-Type": "text/html" },
  });
}
