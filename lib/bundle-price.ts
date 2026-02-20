import { getActivePrice } from "@/lib/discount";

interface TemplateForPrice {
  coin_price: number;
  discount_price?: number | null;
  discount_expires_at?: string | null;
}

export function calculateBundlePrice(templates: TemplateForPrice[]) {
  const totalOriginal = templates.reduce(
    (sum, t) => sum + getActivePrice(t),
    0
  );
  const bundlePrice = Math.ceil(totalOriginal * 0.8);
  const savings = totalOriginal - bundlePrice;

  return { totalOriginal, bundlePrice, savings };
}
