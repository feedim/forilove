import Link from "next/link";

interface PublicFooterProps {
  variant?: "default" | "compact" | "inline" | "minimal";
}

const links = [
  { href: "/help", label: "Yardım Merkezi", short: "Yardım Merkezi" },
  { href: "/help/about", label: "Hakkımızda", short: "Hakkımızda" },
  { href: "/help/terms", label: "Kullanım Koşulları", short: "Koşullar" },
  { href: "/help/privacy", label: "Gizlilik", short: "Gizlilik" },
  { href: "/help/privacy", label: "KVKK", short: "KVKK" },
  { href: "/help/contact", label: "İletişim", short: "İletişim" },
  { href: "/help/disclaimer", label: "Sorumluluk Reddi", short: "Sorumluluk Reddi" },
];

export default function PublicFooter({ variant = "default" }: PublicFooterProps) {
  const year = new Date().getFullYear();

  // Minimal — sadece copyright (error sayfası)
  if (variant === "minimal") {
    return (
      <footer className="py-6 text-center">
        <p className="text-xs text-text-muted/50">&copy; {year} Feedim</p>
      </footer>
    );
  }

  // Compact — sidebar footer
  if (variant === "compact") {
    return (
      <nav className="px-4 pb-3 pt-1">
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.65rem] text-text-muted leading-relaxed">
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} className="hover:underline">{link.short}</Link>
          ))}
          <Link href="/premium" className="hover:underline">Premium ol</Link>
        </div>
        <p className="text-[0.6rem] text-text-muted/60 mt-1">&copy; {year} Feedim. Tüm hakları saklıdır.</p>
      </nav>
    );
  }

  // Inline — landing page footer (centered, small)
  if (variant === "inline") {
    return (
      <footer className="py-3 px-4 shrink-0">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.72rem] text-text-muted">
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} className="hover:underline">{link.label}</Link>
          ))}
          <Link href="/premium" className="hover:underline">Premium ol</Link>
          <span>&copy; {year} Feedim. Tüm hakları saklıdır.</span>
        </nav>
      </footer>
    );
  }

  // Default — full footer (help, premium, not-found sayfaları)
  return (
    <footer className="mt-auto border-t border-border-primary py-8 px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center sm:justify-start">
            {links.map((link) => (
              <Link key={link.href + link.label} href={link.href} className="text-text-muted hover:text-text-primary transition">{link.label}</Link>
            ))}
            <Link href="/premium" className="text-text-muted hover:text-text-primary transition">Premium ol</Link>
          </div>
          <p className="text-xs text-text-muted shrink-0">&copy; {year} Feedim. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </footer>
  );
}
