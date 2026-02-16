// Blocked promo codes — affiliates cannot create codes matching these
// Admin users are exempt from this blocklist
// Checked case-insensitively against the cleaned (uppercased) code

export const BLOCKED_PROMO_CODES = new Set([
  // İndirim varyasyonları (TR + EN)
  "İNDİRİM",
  "İNDİRİM5",
  "INDIRIM",
  "INDIRIM5",
  "UCUZ",
  "UCUZLUK",
  "BEDAVA",
  "ÜCRETSİZ",
  "UCRETSIZ",
  "FIRSAT",
  "FIRSATCI",
  "SÜPER",
  "SUPER",
  "MEGA",
  "HIPER",
  "EKSTRA",
  "EXTRA",
  "BONUS",
  "SAVE",
  "OFF",
  "DEAL",
  "SALE",
  "DISCOUNT",
  "FREE",
  "GRATIS",
  "SPECIAL",
  "ÖZEL",
  "OZEL",
  "HEDİYE",
  "HEDIYE",
  "KUPON",
  "KOD",
  "PROMO",
  "VIP",
  "PREMIUM",
  "PRO",
  "GOLD",
  "SILVER",
  "PLATIN",
  "ELMAS",

  // Marka / site adı
  "FORILOVE",
  "FORİLOVE",
  "FORLOVE",

  // Hoş geldin / karşılama
  "HOŞGELDİ",
  "HOŞGELDÎ",
  "MERHABA",
  "SELAM",
  "WELCOME",
  "HELLO",
  "YENİ",
  "YENI",
  "KAYIT",
  "ÜYELIK",
  "ÜYELİK",
  "UYELIK",

  // Düğün / evlilik terimleri
  "DÜĞÜN",
  "DUGUN",
  "DÜĞÜNÜM",
  "DUGUNUM",
  "EVLİLİK",
  "EVLILIK",
  "NİKAH",
  "NIKAH",
  "NİŞAN",
  "NISAN",
  "SÖZ",
  "SOZ",
  "DAVET",
  "DAVETİYE",
  "DAVETIYE",
  "KINA",
  "GELİN",
  "GELIN",
  "DAMAT",
  "SEVGİLİ",
  "SEVGILI",
  "AŞK",
  "ASK",
  "AŞKIM",
  "ASKIM",
  "CANIM",
  "CANIM",
  "GÜZEL",
  "GUZEL",

  // Özel günler
  "BAYRAM",
  "RAMAZAN",
  "YILBAŞI",
  "YILBASI",
  "YÜZDE",
  "YUZDE",
  "ANNELER",
  "BABALAR",

  // Kampanya terimleri
  "KAMPANYA",

  // Test / admin
  "TEST",
  "ADMIN",
  "DEMO",
  "DENEME",
  "DEBUG",
  "ROOT",
  "SYSTEM",
  "SİSTEM",
  "SISTEM",

  // Yüzde + sayı kombinasyonları
  "YÜZDE5",
  "YÜZDE10",
  "YÜZDE15",
  "YÜZDE20",
  "YUZDE5",
  "YUZDE10",
  "YUZDE15",
  "YUZDE20",
]);

// Substrings: if the code CONTAINS any of these, it's blocked
// This catches variations like "İNDİRİM3", "PROMO99", "FORILOV" etc.
const BLOCKED_SUBSTRINGS = [
  "İNDİRİM",
  "INDIRIM",
  "FORILOVE",
  "FORİLOVE",
  "KAMPANY",
  "PROMOSYO",
  "BEDAVA",
  "ÜCRETSİZ",
  "UCRETSIZ",
  "DISCOUNT",
];

export function isBlockedPromoCode(cleanCode: string): boolean {
  const upper = cleanCode.toLocaleUpperCase("tr-TR");

  // Exact match
  if (BLOCKED_PROMO_CODES.has(upper)) return true;

  // Substring match
  for (const sub of BLOCKED_SUBSTRINGS) {
    if (upper.includes(sub)) return true;
  }

  return false;
}
