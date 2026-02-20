"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    // Dashboard main element (desktop scroll container)
    const main = document.querySelector("main.md\\:overflow-y-auto");
    if (main) main.scrollTop = 0;

    // Window scroll (mobile + non-dashboard pages)
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
