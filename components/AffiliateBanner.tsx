"use client";

interface AffiliateBannerProps {
  compact?: boolean;
}

export default function AffiliateBanner({ compact }: AffiliateBannerProps) {
  if (compact) {
    return (
      <div className="w-full bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-2 text-center text-sm text-white font-medium">
        Affiliate indirimi aktif — tüm ürünlerde %100 indirim (tek seferlik)
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-orange-600 to-amber-500 px-6 py-4 text-center text-white">
      <p className="text-sm sm:text-base font-medium max-w-3xl mx-auto">
        Tanıtmak istediğiniz ürüne ücretsiz erişebilmek adına, tüm ürünlere %100 indirim uygulandı. Lütfen tanıtmak istediğiniz ürünü satın alınız. (Tek seferliktir. İlk satın alım sonrasında tüm ürünler eski fiyatına dönecektir.)
      </p>
    </div>
  );
}
