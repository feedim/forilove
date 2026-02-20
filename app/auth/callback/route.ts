import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Track cookies from Supabase operations
  let latestCookies: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          latestCookies = [...cookiesToSet];
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Google OAuth already provides strong authentication (Google's own 2FA).
  // Skip MFA check for OAuth logins — MFA only applies to password-based login.

  // Popup mode — send postMessage to opener and close
  const isPopup = requestUrl.searchParams.get("popup") === "true";

  if (isPopup) {
    const popupResponse = new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_CALLBACK_COMPLETE' }, window.location.origin);
          }
          window.close();
        </script>
        <p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#666">Giriş başarılı! Bu pencere kapanacak...</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );

    latestCookies.forEach(({ name, value, options }) => {
      popupResponse.cookies.set(name, value, options);
    });

    return popupResponse;
  }

  // Normal flow — check localStorage returnTo (set by AuthModal fallback) or query param
  const returnTo = requestUrl.searchParams.get("returnTo");
  const safeReturnTo = returnTo?.startsWith('/editor/') ? returnTo : null;

  const normalResponse = new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <script>
        var saved = localStorage.getItem('forilove_auth_return');
        if (saved) {
          localStorage.removeItem('forilove_auth_return');
          window.location.replace(saved);
        } else {
          window.location.replace(${JSON.stringify(safeReturnTo ? `${safeReturnTo}?auth_return=true` : "/dashboard")});
        }
      </script>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );

  // Apply session cookies
  latestCookies.forEach(({ name, value, options }) => {
    normalResponse.cookies.set(name, value, options);
  });

  return normalResponse;
}
