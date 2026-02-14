"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Coins, Undo2, Redo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useAuthModal } from "@/components/AuthModal";
import { usePurchaseConfirm } from "@/components/PurchaseConfirmModal";
import { getActivePrice, isDiscountActive } from "@/lib/discount";
import type { CouponInfo } from "@/components/PurchaseConfirmModal";
import { Suspense } from "react";

/* ─── Types ─── */

interface TemplateHook {
  key: string;
  type: "text" | "image" | "textarea" | "color" | "date" | "url" | "background-image" | "list";
  label: string;
  defaultValue: string;
  locked?: boolean;
}

/* ─── Wrapper for Suspense (useSearchParams) ─── */

export default function GuestEditorWrapper({ params }: { params: Promise<{ templateId: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Heart className="h-12 w-12 text-pink-500 fill-pink-500 animate-pulse" />
      </div>
    }>
      <GuestEditorPage params={params} />
    </Suspense>
  );
}

/* ─── Main Page ─── */

function GuestEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { requireAuth } = useAuthModal();
  const { confirm } = usePurchaseConfirm();

  const [template, setTemplate] = useState<any>(null);
  const [hooks, setHooks] = useState<TemplateHook[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewInitRef = useRef(false);
  const valuesRef = useRef<Record<string, string>>({});
  const undoStackRef = useRef<Record<string, string>[]>([]);
  const redoStackRef = useRef<Record<string, string>[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set());
  const handleFieldUnlockRef = useRef<(key: string) => void>(() => {});
  const TEMPLATE_UNLOCK_COST = 29;

  // Edit modal state
  const [editingHook, setEditingHook] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftListItems, setDraftListItems] = useState<string[]>([]);

  valuesRef.current = values;

  /* ─── Undo/Redo ─── */

  const pushUndo = (snapshot: Record<string, string>) => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), snapshot];
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const undo = () => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push({ ...valuesRef.current });
    setValues(prev);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({ ...valuesRef.current });
    setValues(next);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  };

  /* ─── Hook parsing ─── */

  const parseHooksFromHTML = (html: string): TemplateHook[] => {
    const parsedHooks: TemplateHook[] = [];

    // Check for HOOK_ placeholders (old format)
    const hookMatches = html.matchAll(/HOOK_(\w+)/g);
    const foundHooks = new Set<string>();

    for (const match of hookMatches) {
      const hookName = match[1];
      if (!foundHooks.has(hookName)) {
        foundHooks.add(hookName);
        let type: TemplateHook["type"] = "text";
        let defaultValue = "";

        if (hookName.includes("image") || hookName.includes("photo")) {
          type = "image";
          defaultValue = "https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=800";
        } else if (hookName.includes("message")) {
          type = "textarea";
          defaultValue = "Sevgili mesajinizi buraya yazin...";
        } else if (hookName.includes("date")) {
          type = "date";
          defaultValue = new Date().toISOString().split("T")[0];
        } else if (hookName.includes("color")) {
          type = "color";
          defaultValue = "#ff006e";
        } else {
          defaultValue = hookName.replace(/_/g, " ");
        }

        parsedHooks.push({
          key: hookName,
          type,
          label: hookName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          defaultValue,
        });
      }
    }

    // If no HOOK_ found, try data-editable attributes (new format)
    if (parsedHooks.length === 0) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const editableElements = doc.querySelectorAll("[data-editable]");
      const seenKeys = new Set<string>();

      editableElements.forEach((element) => {
        const key = element.getAttribute("data-editable");
        if (!key || seenKeys.has(key)) return;
        seenKeys.add(key);

        const elType = element.getAttribute("data-type") || "text";
        const label = element.getAttribute("data-label") || key;

        let defaultValue = "";
        if (elType === "list") {
          const itemClass = element.getAttribute("data-list-item-class") || "";
          const duplicate = element.getAttribute("data-list-duplicate") === "true";
          const items: string[] = [];
          if (itemClass) {
            element.querySelectorAll(`.${itemClass}`).forEach((child) => {
              items.push(child.textContent?.trim() || "");
            });
          }
          const finalItems = duplicate && items.length > 0 ? items.slice(0, Math.ceil(items.length / 2)) : items;
          defaultValue = JSON.stringify(finalItems.length > 0 ? finalItems : [""]);
        } else if (elType === "image") {
          defaultValue = element.getAttribute("src") || "";
        } else if (elType === "color") {
          const style = element.getAttribute("style") || "";
          const cssProp = element.getAttribute("data-css-property") || "background-color";
          const colorMatch = style.match(new RegExp(`${cssProp}\\s*:\\s*([^;]+)`));
          defaultValue = colorMatch ? colorMatch[1].trim() : "#000000";
        } else if (elType === "background-image") {
          const style = element.getAttribute("style") || "";
          const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
          defaultValue = bgMatch ? bgMatch[1] : "";
        } else if (elType === "url") {
          defaultValue = element.getAttribute("href") || "";
        } else {
          defaultValue = element.textContent?.trim() || "";
        }

        const locked = element.getAttribute("data-locked") === "true";

        parsedHooks.push({
          key,
          type: elType as TemplateHook["type"],
          label: label || key,
          defaultValue,
          locked,
        });
      });
    }

    return parsedHooks;
  };

  const extractDefaults = (hks: TemplateHook[]): Record<string, string> => {
    const defaults: Record<string, string> = {};
    hks.forEach((hook) => {
      defaults[hook.key] = hook.defaultValue;
    });
    return defaults;
  };

  const isFieldLocked = (hookKey: string): boolean => {
    if (template?.coin_price > 0) return false;
    const hook = hooks.find((h) => h.key === hookKey);
    if (!hook?.locked) return false;
    return !unlockedFields.has(hookKey);
  };

  const isValidCssColor = (color: string): boolean => {
    if (!color) return false;
    return /^#([0-9A-Fa-f]{3,8})$/.test(color) || /^(rgb|hsl)a?\s*\(/.test(color) || /^[a-zA-Z]+$/.test(color);
  };

  /* ─── Preview rendering ─── */

  const updatePreview = useCallback(() => {
    const htmlContent = template?.html_content;
    if (!htmlContent) return;

    let html = htmlContent;

    if (html.includes("HOOK_")) {
      Object.entries(values).forEach(([key, value]) => {
        if (key.startsWith("__")) return;
        const regex = new RegExp(`HOOK_${key}`, "g");
        html = html.replace(regex, value || "");
      });
      writeToPreview(html);
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const isSafeUrl = (url: string) => {
        if (url.startsWith("data:image/")) return true;
        try {
          const parsed = new URL(url, "https://placeholder.com");
          return /^https?:$/.test(parsed.protocol);
        } catch {
          return false;
        }
      };

      const safeCssValue = (val: string) => val.replace(/expression\s*\(|javascript:|vbscript:/gi, "");

      Object.entries(values).forEach(([key, value]) => {
        const element = doc.querySelector(`[data-editable="${key}"]`);
        if (!element) return;

        const elType = element.getAttribute("data-type") || "text";
        const cssProperty = element.getAttribute("data-css-property");

        if (elType === "image") {
          if (isSafeUrl(value)) element.setAttribute("src", value);
        } else if (elType === "background-image") {
          if (isSafeUrl(value)) {
            const currentStyle = element.getAttribute("style") || "";
            element.setAttribute("style", `${currentStyle}; background-image: url('${value}');`);
          }
        } else if (elType === "color") {
          if (!isValidCssColor(value)) return;
          const safeVal = safeCssValue(value);
          const currentStyle = element.getAttribute("style") || "";
          if (cssProperty) {
            element.setAttribute("style", `${currentStyle}; ${safeCssValue(cssProperty)}: ${safeVal};`);
          } else {
            element.setAttribute("style", `${currentStyle}; background-color: ${safeVal};`);
          }
        } else if (elType === "url") {
          if (isSafeUrl(value)) element.setAttribute("href", value);
        } else if (elType === "list") {
          try {
            const items = JSON.parse(value);
            if (!Array.isArray(items)) return;
            const itemClass = element.getAttribute("data-list-item-class") || "";
            const sepClass = element.getAttribute("data-list-sep-class") || "";
            const sepHtml = element.getAttribute("data-list-sep-html") || "";
            const duplicate = element.getAttribute("data-list-duplicate") === "true";
            const buildListItems = (arr: string[]) =>
              arr
                .map((text) => {
                  let s = `<span class="${itemClass}">${text}</span>`;
                  if (sepClass) s += `<span class="${sepClass}">${sepHtml}</span>`;
                  return s;
                })
                .join("");
            let inner = buildListItems(items);
            if (duplicate) inner += buildListItems(items);
            element.innerHTML = inner;
          } catch {}
        } else {
          element.textContent = value;
        }

        element.setAttribute("data-clickable", "true");
        const currentStyle = element.getAttribute("style") || "";
        element.setAttribute("style", `${currentStyle}; cursor: pointer;`);
      });

      // Tap highlight reset
      const tapStyle = doc.createElement("style");
      tapStyle.textContent = "* { -webkit-tap-highlight-color: transparent !important; }";
      doc.head.appendChild(tapStyle);

      // Compute locked fields
      const lockedFieldKeys = hooks
        .filter((h) => h.locked && template?.coin_price === 0 && !unlockedFields.has(h.key))
        .map((h) => h.key);

      // Click event listener script
      const script = doc.createElement("script");
      script.textContent = `
        document.addEventListener('DOMContentLoaded', function() {
          var LOCKED_SET = new Set(${JSON.stringify(lockedFieldKeys)});

          document.addEventListener('click', function(e) {
            var els = document.elementsFromPoint(e.clientX, e.clientY);
            for (var i = 0; i < els.length; i++) {
              var editable = els[i].closest ? els[i].closest('[data-editable]') : null;
              if (!editable) editable = els[i].hasAttribute && els[i].hasAttribute('data-editable') ? els[i] : null;
              if (editable) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                var key = editable.getAttribute('data-editable');
                if (LOCKED_SET.has(key)) {
                  window.parent.postMessage({ type: 'UNLOCK_HOOK', key: key }, '*');
                } else {
                  window.parent.postMessage({ type: 'EDIT_HOOK', key: key }, '*');
                }
                return;
              }
            }
          }, true);

          var lastHovered = null;
          document.addEventListener('mousemove', function(e) {
            var els = document.elementsFromPoint(e.clientX, e.clientY);
            var editable = null;
            for (var i = 0; i < els.length; i++) {
              editable = els[i].closest ? els[i].closest('[data-editable]') : null;
              if (!editable) editable = els[i].hasAttribute && els[i].hasAttribute('data-editable') ? els[i] : null;
              if (editable) break;
            }
            var topEl = els[0];
            if (topEl) topEl.style.cursor = editable ? 'pointer' : '';
            if (editable !== lastHovered) {
              if (lastHovered) {
                lastHovered.style.outline = '2px solid transparent';
                lastHovered.style.boxShadow = 'none';
              }
              if (editable) {
                var eKey = editable.getAttribute('data-editable');
                if (LOCKED_SET.has(eKey)) {
                  editable.style.outline = '2px solid rgba(255,255,255,0.6)';
                  editable.style.boxShadow = '0 0 0 4px rgba(0,0,0,0.15)';
                } else {
                  editable.style.outline = '2px solid #ec4899';
                  editable.style.boxShadow = '0 0 0 4px rgba(236, 72, 153, 0.1)';
                }
              }
              lastHovered = editable;
            }
          }, false);

          document.querySelectorAll('[data-editable]').forEach(function(el) {
            el.style.outline = '2px solid transparent';
            el.style.transition = 'outline 0.2s, box-shadow 0.2s';

            var elKey = el.getAttribute('data-editable');
            if (LOCKED_SET.has(elKey)) {
              el.style.position = el.style.position || 'relative';
              el.style.opacity = '0.45';
              el.style.padding = el.style.padding || '11px';
              var overlay = document.createElement('div');
              overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.15);pointer-events:none;z-index:2;border-radius:inherit;';
              overlay.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>';
              el.appendChild(overlay);
            }

            if (el.getAttribute('data-type') === 'color') {
              el.style.position = el.style.position || 'relative';
              var dot = document.createElement('span');
              dot.style.cssText = 'position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;border:2px solid rgba(0,0,0,0.5);pointer-events:none;z-index:1;box-shadow:0 1px 3px rgba(0,0,0,0.3)';
              var cssProp = el.getAttribute('data-css-property') || 'background-color';
              var style = el.getAttribute('style') || '';
              var colorMatch = style.match(new RegExp(cssProp + '\\\\s*:\\\\s*([^;]+)'));
              dot.style.background = colorMatch ? colorMatch[1].trim() : '#ec4899';
              el.appendChild(dot);
            }

            if (el.getAttribute('data-type') === 'list') {
              Array.from(el.children).forEach(function(child) {
                child.style.cursor = 'pointer';
                child.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  var key = el.getAttribute('data-editable');
                  window.parent.postMessage({ type: 'EDIT_HOOK', key: key }, '*');
                });
              });
            }
          });
        });
      `;
      doc.body.appendChild(script);

      writeToPreview(doc.documentElement.outerHTML);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, values, hooks, unlockedFields]);

  const writeToPreview = (html: string) => {
    const iframe = iframeRef.current;
    if (previewInitRef.current && iframe?.contentDocument) {
      const doc = iframe.contentDocument;
      const scrollY = doc.documentElement?.scrollTop || doc.body?.scrollTop || 0;
      doc.open();
      doc.write(html);
      doc.close();
      requestAnimationFrame(() => {
        if (doc.documentElement) doc.documentElement.scrollTop = scrollY;
        if (doc.body) doc.body.scrollTop = scrollY;
      });
    } else {
      setPreviewHtml(html);
      previewInitRef.current = true;
    }
  };

  /* ─── Load template ─── */

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const { data: templateData } = await supabase
          .from("templates")
          .select("id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, html_content, created_by, purchase_count")
          .eq("id", resolvedParams.templateId)
          .eq("is_active", true)
          .single();

        if (!templateData) {
          toast.error("Sablon bulunamadi");
          router.push("/templates");
          return;
        }

        setTemplate(templateData);

        const htmlContent = templateData.html_content;
        if (htmlContent) {
          const parsedHooks = parseHooksFromHTML(htmlContent);
          setHooks(parsedHooks);

          let initialValues = extractDefaults(parsedHooks);

          // Restore guest edits from localStorage (OAuth return)
          const isAuthReturn = searchParams.get("auth_return") === "true";
          if (isAuthReturn) {
            try {
              const guestEdits = localStorage.getItem("forilove_guest_edits");
              if (guestEdits) {
                const parsed = JSON.parse(guestEdits);
                if (parsed.templateId === resolvedParams.templateId && parsed.values) {
                  initialValues = parsed.values;
                }
                localStorage.removeItem("forilove_guest_edits");
              }
            } catch {}
          }

          setValues(initialValues);
        }
      } catch {
        toast.error("Yukleme hatasi");
        router.push("/templates");
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Update preview when values change ─── */

  useEffect(() => {
    if (template?.html_content) {
      const timer = setTimeout(() => updatePreview(), 200);
      return () => clearTimeout(timer);
    }
  }, [values, template, updatePreview]);

  /* ─── Iframe message listener ─── */

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "null" && event.origin !== window.location.origin) return;
      if (event.data?.type === "UNLOCK_HOOK" && typeof event.data.key === "string" && /^[a-zA-Z0-9_-]+$/.test(event.data.key)) {
        handleFieldUnlockRef.current(event.data.key);
      } else if (event.data?.type === "EDIT_HOOK" && typeof event.data.key === "string" && /^[a-zA-Z0-9_-]+$/.test(event.data.key)) {
        setDraftValue(valuesRef.current[event.data.key] || "");
        setEditingHook(event.data.key);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingHook(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Populate draftListItems when list hook is opened ─── */

  useEffect(() => {
    if (!editingHook) return;
    const hook = hooks.find((h) => h.key === editingHook);
    if (hook?.type === "list") {
      const val = valuesRef.current[editingHook] || hook.defaultValue || "[]";
      try {
        setDraftListItems(JSON.parse(val));
      } catch {
        setDraftListItems([""]);
      }
    }
  }, [editingHook, hooks]);

  /* ─── Edit modal save ─── */

  const saveEditModal = () => {
    if (!editingHook) {
      setEditingHook(null);
      return;
    }

    const hook = hooks.find((h) => h.key === editingHook);
    let finalValue = draftValue;

    if (hook?.type === "list") {
      const filtered = draftListItems.filter((item) => item.trim());
      finalValue = JSON.stringify(filtered.length > 0 ? filtered : [""]);
    }

    pushUndo({ ...valuesRef.current });
    setValues((prev) => ({ ...prev, [editingHook]: finalValue }));
    setEditingHook(null);
  };

  /* ─── Field unlock (locked fields in free templates) ─── */

  const handleFieldUnlock = async (hookKey: string) => {
    const allLockedKeys = hooks.filter((h) => h.locked && !unlockedFields.has(h.key)).map((h) => h.key);
    if (allLockedKeys.length === 0) return;

    // Require auth first
    const user = await requireAuth(`/editor/${resolvedParams.templateId}`);
    if (!user) return;

    // Save edits before purchase flow
    localStorage.setItem("forilove_guest_edits", JSON.stringify({
      templateId: resolvedParams.templateId,
      values: valuesRef.current,
    }));

    // Get coin balance
    const { data: profile } = await supabase.from("profiles").select("coin_balance").eq("user_id", user.id).single();
    const coinBalance = profile?.coin_balance || 0;

    const result = await confirm({
      itemName: "Tum Kilitleri Ac",
      description: "Bu sablondaki tum kilitli alanlari duzenleyebilirsiniz",
      coinCost: TEMPLATE_UNLOCK_COST,
      currentBalance: coinBalance,
      icon: "template",
      allowCoupon: true,
      onConfirm: async () => {
        const { data: spendResult, error: spendError } = await supabase.rpc("spend_coins", {
          p_user_id: user.id,
          p_amount: TEMPLATE_UNLOCK_COST,
          p_description: "Ucretsiz sablon kilitleri acildi",
          p_reference_id: null,
          p_reference_type: "template_unlock",
        });

        if (spendError) throw spendError;
        if (!spendResult[0]?.success) {
          return { success: false, error: spendResult[0]?.message || "Coin harcama basarisiz" };
        }

        return { success: true, newBalance: spendResult[0].new_balance };
      },
    });

    if (!result?.success) return;

    setUnlockedFields(new Set(allLockedKeys));
    // Open edit modal for the clicked field
    setDraftValue(valuesRef.current[hookKey] || "");
    setEditingHook(hookKey);
  };
  handleFieldUnlockRef.current = handleFieldUnlock;

  /* ─── Publish flow ─── */

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // 1. Require auth
      const user = await requireAuth(`/editor/${resolvedParams.templateId}`);
      if (!user) {
        setPublishing(false);
        return;
      }

      // Save guest edits to localStorage before any redirects
      localStorage.setItem("forilove_guest_edits", JSON.stringify({
        templateId: resolvedParams.templateId,
        values: valuesRef.current,
      }));

      // 2. Check if already purchased
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("template_id", resolvedParams.templateId)
        .eq("payment_status", "completed")
        .maybeSingle();

      if (!existingPurchase) {
        const coinPrice = getActivePrice(template);

        if (coinPrice === 0) {
          // Auto-purchase free template
          const { error: purchaseError } = await supabase.from("purchases").insert({
            user_id: user.id,
            template_id: resolvedParams.templateId,
            coins_spent: 0,
            payment_method: "coins",
            payment_status: "completed",
          });

          if (purchaseError) {
            toast.error("Satin alma hatasi");
            setPublishing(false);
            return;
          }
        } else {
          // Paid template — show purchase modal
          const { data: profile } = await supabase.from("profiles").select("coin_balance").eq("user_id", user.id).single();
          const coinBalance = profile?.coin_balance || 0;

          let displayOriginalPrice: number | undefined;
          let displayDiscountLabel: string | undefined;

          if (isDiscountActive(template)) {
            displayOriginalPrice = template.coin_price;
            displayDiscountLabel = template.discount_label;
          }

          const purchaseResult = await confirm({
            itemName: template.name,
            description: "Sablonu satin alip duzenlemeye baslayin",
            coinCost: coinPrice,
            originalPrice: displayOriginalPrice,
            discountLabel: displayDiscountLabel,
            currentBalance: coinBalance,
            icon: "template",
            allowCoupon: true,
            onConfirm: async (couponInfo?: CouponInfo) => {
              let verifiedPrice = coinPrice;

              if (couponInfo) {
                const { data: couponCheck } = await supabase.rpc("validate_coupon", {
                  p_code: couponInfo.code,
                  p_user_id: user.id,
                });
                if (couponCheck?.valid) {
                  verifiedPrice = Math.max(0, Math.round(verifiedPrice * (1 - couponCheck.discount_percent / 100)));
                } else {
                  return { success: false, error: couponCheck?.error || "Kupon dogrulanamadi" };
                }
              }

              let newBalance = 0;

              if (verifiedPrice > 0) {
                const { data: spendResult, error: spendError } = await supabase.rpc("spend_coins", {
                  p_user_id: user.id,
                  p_amount: verifiedPrice,
                  p_description: `Sablon satin alindi: ${template.name}`,
                  p_reference_id: template.id,
                  p_reference_type: "template",
                });

                if (spendError) throw spendError;
                if (!spendResult[0]?.success) {
                  return { success: false, error: spendResult[0]?.message || "Coin harcama basarisiz" };
                }
                newBalance = spendResult[0].new_balance;
              } else {
                const { data: balanceData } = await supabase.from("profiles").select("coin_balance").eq("user_id", user.id).single();
                newBalance = balanceData?.coin_balance ?? 0;
              }

              const { error: purchaseError } = await supabase.from("purchases").insert({
                user_id: user.id,
                template_id: template.id,
                coins_spent: verifiedPrice,
                payment_method: "coins",
                payment_status: "completed",
              });

              if (purchaseError) throw purchaseError;

              return { success: true, newBalance };
            },
          });

          if (!purchaseResult?.success) {
            setPublishing(false);
            return;
          }
        }
      }

      // 3. Redirect to dashboard editor (localStorage edits will be picked up there)
      toast.success("Yonlendiriliyorsunuz...");
      router.push(`/dashboard/editor/${resolvedParams.templateId}`);
    } catch (err: any) {
      toast.error(err.message || "Bir hata olustu");
      setPublishing(false);
    }
  };

  /* ─── Current editing hook ─── */

  const currentHook = editingHook ? hooks.find((h) => h.key === editingHook) : null;

  /* ─── Loading ─── */

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Heart className="h-12 w-12 text-pink-500 fill-pink-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="w-full px-3 sm:px-6 flex items-center justify-between min-h-[73px]">
          <button onClick={() => router.push("/templates")} className="flex items-center gap-2 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg sm:text-xl font-bold max-w-[200px] sm:max-w-[300px] truncate md:absolute md:left-[120px] md:border-l md:border-white/10 md:pl-4">
            {template?.name}
          </h1>
          <div className="flex items-center gap-2">
            {/* Undo/Redo - desktop */}
            <div className="hidden md:flex btn-secondary shrink-0 items-center rounded-full overflow-hidden" style={{ padding: "0 1rem" }}>
              <button onClick={undo} disabled={!canUndo} className="flex items-center justify-center px-1.5 disabled:opacity-30 disabled:cursor-not-allowed" style={{ height: 38 }} aria-label="Geri al">
                <Undo2 className="h-[25px] w-[25px] text-white/70" />
              </button>
              <div className="w-px h-5 bg-white/15 shrink-0" />
              <button onClick={redo} disabled={!canRedo} className="flex items-center justify-center px-1.5 disabled:opacity-30 disabled:cursor-not-allowed" style={{ height: 38 }} aria-label="Yinele">
                <Redo2 className="h-[25px] w-[25px] text-white/70" />
              </button>
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="btn-primary shrink-0 px-4 py-2 text-sm whitespace-nowrap"
            >
              {publishing ? "Yukleniyor..." : "Yayina Al"}
            </button>
          </div>
        </nav>
      </header>

      {/* Main Editor Layout */}
      <div className="relative min-h-[calc(100vh-73px)]">
        {/* Live Preview */}
        <div className="h-[calc(100vh-73px-56px)] md:h-[calc(100vh-73px)] overflow-y-auto bg-white">
          <iframe ref={iframeRef} srcDoc={previewHtml} className="w-full h-full border-0" title="Preview" />
        </div>

        {/* Mobile Bottom Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="btn-secondary shrink-0 flex items-center rounded-full overflow-hidden" style={{ padding: "0 1rem" }}>
              <button onClick={undo} disabled={!canUndo} className="flex items-center justify-center px-1.5 disabled:opacity-30 disabled:cursor-not-allowed" style={{ height: 38 }} aria-label="Geri al">
                <Undo2 className="h-[25px] w-[25px] text-white/70" />
              </button>
              <div className="w-px h-5 bg-white/15 shrink-0" />
              <button onClick={redo} disabled={!canRedo} className="flex items-center justify-center px-1.5 disabled:opacity-30 disabled:cursor-not-allowed" style={{ height: 38 }} aria-label="Yinele">
                <Redo2 className="h-[25px] w-[25px] text-white/70" />
              </button>
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="btn-primary flex-1 py-2.5 text-sm"
            >
              {publishing ? "Yukleniyor..." : "Yayina Al"}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingHook && currentHook && (
        <div
          onClick={() => setEditingHook(null)}
          className="fixed inset-0 z-[9999999] flex items-end justify-center bg-black/70 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] bg-zinc-900 rounded-t-[32px] p-6 flex flex-col gap-4 animate-[slideUp_0.25s_ease-out] max-h-[80vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">{currentHook.label}</h3>
              <button
                onClick={() => setEditingHook(null)}
                aria-label="Kapat"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Input based on type */}
            {currentHook.type === "textarea" ? (
              <textarea
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                rows={5}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition resize-none"
                autoFocus
              />
            ) : currentHook.type === "color" ? (
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="w-14 h-14 rounded-xl border-0 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="flex-1 bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-pink-500/50 transition"
                />
              </div>
            ) : currentHook.type === "date" ? (
              <input
                type="date"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500/50 transition"
              />
            ) : currentHook.type === "url" || currentHook.type === "image" || currentHook.type === "background-image" ? (
              <div className="flex flex-col gap-2">
                <input
                  type="url"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
                  autoFocus
                />
                {(currentHook.type === "image" || currentHook.type === "background-image") && draftValue && (
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draftValue} alt="Preview" className="w-full max-h-40 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
            ) : currentHook.type === "list" ? (
              <div className="flex flex-col gap-2">
                {draftListItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const newItems = [...draftListItems];
                        newItems[index] = e.target.value;
                        setDraftListItems(newItems);
                      }}
                      className="flex-1 bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
                      placeholder={`Madde ${index + 1}`}
                    />
                    {draftListItems.length > 1 && (
                      <button
                        onClick={() => setDraftListItems(draftListItems.filter((_, i) => i !== index))}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-red-400 transition"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setDraftListItems([...draftListItems, ""])}
                  className="text-sm text-pink-500 hover:text-pink-400 transition text-left"
                >
                  + Madde Ekle
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
                autoFocus
              />
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditingHook(null)}
                className="btn-secondary flex-1 py-3 text-sm"
              >
                Vazgec
              </button>
              <button
                onClick={saveEditModal}
                className="btn-primary flex-1 py-3 text-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
