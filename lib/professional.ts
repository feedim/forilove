import { PROFESSIONAL_CATEGORIES } from "@/lib/constants";

export function getCategoryLabel(accountType: string, categoryValue: string): string {
  const cats = accountType === "creator" ? PROFESSIONAL_CATEGORIES.creator : PROFESSIONAL_CATEGORIES.business;
  return cats.find(c => c.value === categoryValue)?.label || categoryValue;
}

export function isProfessional(accountType?: string): boolean {
  return accountType === "creator" || accountType === "business";
}
