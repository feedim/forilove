/**
 * Check if a template's discount is currently active.
 * Returns true if discount_price exists and hasn't expired.
 */
export function isDiscountActive(template: {
  discount_price?: number | null;
  discount_expires_at?: string | null;
}): boolean {
  if (!template.discount_price) return false;
  if (!template.discount_expires_at) return true; // no expiry = always active
  return new Date(template.discount_expires_at) > new Date();
}

/**
 * Get the effective price for a template (discount-aware).
 */
export function getActivePrice(template: {
  coin_price: number;
  discount_price?: number | null;
  discount_expires_at?: string | null;
}): number {
  return isDiscountActive(template) ? template.discount_price! : template.coin_price;
}
