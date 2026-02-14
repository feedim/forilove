export interface MusicTrack {
  id: string;          // YouTube video ID (11 char)
  title: string;
  artist: string;
  category: 'dugun' | 'romantik' | 'pop' | 'enstrumantal';
}

export const MUSIC_CATEGORIES = [
  { key: 'all', label: 'Tümü' },
  { key: 'dugun', label: 'Düğün' },
  { key: 'romantik', label: 'Romantik' },
  { key: 'pop', label: 'Pop' },
  { key: 'enstrumantal', label: 'Enstrümantal' },
] as const;

export const MUSIC_LIBRARY: MusicTrack[] = [
  // ─── Düğün ──────────────────────────────────────────────
  { id: 'ZeS7Fjk2sKk', title: 'İyi ki Hayatımdasın', artist: 'Mustafa Ceceli', category: 'dugun' },
  { id: '-dpdsuewpYI', title: 'Evlenmene Bak', artist: 'İrem Derici', category: 'dugun' },
  { id: 'r7k0wn2-bQY', title: 'Vermem Seni Ellere', artist: 'Oğuzhan Koç', category: 'dugun' },
  { id: 'e-nGqec1VxI', title: 'Aşkımız Olay Olacak', artist: 'İrem Derici', category: 'dugun' },
  { id: 'l_HAOSBGYKc', title: 'Sen Sevda Mısın', artist: 'Buray', category: 'dugun' },
  { id: 'A33z9eomcr0', title: 'Aşkım Benim', artist: 'Mustafa Ceceli', category: 'dugun' },
  { id: 'aBS0y1sqfRU', title: 'Eksik', artist: 'Mustafa Ceceli & Elvan Günaydın', category: 'dugun' },
  { id: 'mTZRQltuHRc', title: 'Kalbimin Tek Sahibine', artist: 'İrem Derici', category: 'dugun' },
  { id: 'bdoqdoLSZCM', title: 'Adımı Kalbine Yaz', artist: 'Tarkan', category: 'dugun' },
  { id: 'jEwrdPOWaUM', title: 'Özledim', artist: 'Murat Boz', category: 'dugun' },
  { id: 'HIO5Ti020hw', title: 'Sesini Duymadan', artist: 'Burak Bulut & Eda Sakız', category: 'dugun' },
  { id: 'ME1WaoCudmw', title: 'Gel', artist: 'Mabel Matiz', category: 'dugun' },

  // ─── Romantik ───────────────────────────────────────────
  { id: 'NAHRpEqgcL4', title: 'Kuzu Kuzu', artist: 'Tarkan', category: 'romantik' },
  { id: 'QNoC_mVojhc', title: 'Öp', artist: 'Tarkan', category: 'romantik' },
  { id: 'SCZgGVqVsbY', title: 'Dudu', artist: 'Tarkan', category: 'romantik' },
  { id: 'jiRzQoFcIIA', title: 'Geri Dön', artist: 'Sezen Aksu', category: 'romantik' },
  { id: 'vLr3tG7xI6Y', title: 'Yoruldum', artist: 'Sıla', category: 'romantik' },
  { id: 'PwBJ7EKpAk8', title: 'Ben Seni Unutmak İçin Sevmedim', artist: 'Emel Sayın', category: 'romantik' },
  { id: 'Uh3yhBy0m6c', title: 'Hoşçakal', artist: 'Emre Aydın', category: 'romantik' },
  { id: 'pEm_BLbKhyc', title: 'Boş Yere', artist: 'Sıla', category: 'romantik' },
  { id: 'qUsE49lUQUY', title: 'Öyle Kolaysa', artist: 'Mabel Matiz', category: 'romantik' },
  { id: 'W1gUrzujPt8', title: 'Lal', artist: 'Sertab Erener', category: 'romantik' },
  { id: '1MbnAxvrvfU', title: 'Ağla Kalbim', artist: 'Bengü', category: 'romantik' },
  { id: '4goQBlcdVUk', title: 'Saygımdan', artist: 'Bengü', category: 'romantik' },
  { id: 'M-rZ3602Lm8', title: 'Bir Kadın Çizeceksin', artist: 'maNga', category: 'romantik' },

  // ─── Pop ────────────────────────────────────────────────
  { id: 'cpp69ghR1IM', title: 'Şımarık', artist: 'Tarkan', category: 'pop' },
  { id: 'QjRYopBRUIc', title: 'Janti', artist: 'Murat Boz', category: 'pop' },
  { id: 'OGulnXKTyC4', title: 'Gece', artist: 'Murat Boz', category: 'pop' },
  { id: '-hcZqXB18cY', title: 'Aşkı Bulamam Ben', artist: 'Murat Boz', category: 'pop' },
  { id: 'KSlOGG5Ohgg', title: 'Hadi Bakalım', artist: 'Sezen Aksu', category: 'pop' },
  { id: 'j0_QrKnqd5E', title: 'Everyway That I Can', artist: 'Sertab Erener', category: 'pop' },
  { id: 'ahUI0Q8hcoY', title: 'Düm Tek Tek', artist: 'Hadise', category: 'pop' },
  { id: 'nRUsNPC57H8', title: 'Şampiyon', artist: 'Hadise', category: 'pop' },
  { id: 'xjPozY4XER0', title: 'Shake It Up Şekerim', artist: 'Kenan Doğulu', category: 'pop' },
  { id: '1gc1MqsNrcY', title: 'Çakkıdı', artist: 'Kenan Doğulu', category: 'pop' },
  { id: 'icZ-OlVSvb4', title: 'Bangır Bangır', artist: 'Gülşen', category: 'pop' },
  { id: '9rJW5u29QFk', title: 'Seviyorsun', artist: 'Hande Yener', category: 'pop' },
  { id: '48BrcXVhk_w', title: 'Vay', artist: 'Edis', category: 'pop' },
  { id: '6zzHRUqB5O4', title: 'Dudak', artist: 'Edis', category: 'pop' },
  { id: 'GcGPedcPsOs', title: 'Cevapsız Çınlama', artist: 'Aleyna Tilki', category: 'pop' },
  { id: 'FrjWcu1c0-4', title: 'Bambaşka Biri', artist: 'Ajda Pekkan', category: 'pop' },

  // ─── Enstrümantal ───────────────────────────────────────
  { id: '7hp25qXj8ZU', title: 'Canon in D - Violin, Cello & Piano', artist: 'Pachelbel', category: 'enstrumantal' },
  { id: 'Ptk_1Dc2iPY', title: 'Canon in D - Cello & Piano', artist: 'Pachelbel', category: 'enstrumantal' },
  { id: '4KRJ0EeTkFs', title: 'Türk Dizi Piyano Müzikleri', artist: 'Piano Cover', category: 'enstrumantal' },
  { id: 'zfWInZtcWPA', title: 'İlk Dans - Enstrümantal', artist: 'Kiralık Aşk OST', category: 'enstrumantal' },
  { id: 'c9oMTrMy6A0', title: 'First Dance - Piano', artist: 'Instrumental', category: 'enstrumantal' },
  { id: 'f740PWAjD-Y', title: 'Romantic Violin & Piano Love Songs', artist: 'Instrumental', category: 'enstrumantal' },
  { id: 'aXYtJB7Qslk', title: 'Romantik Piyano & Keman Müzik', artist: 'Instrumental', category: 'enstrumantal' },
  { id: 'O-Rh_qnDpWU', title: 'Piyano ile Türküler', artist: 'Enstrümantal', category: 'enstrumantal' },
  { id: 'aS7uMzgrGCQ', title: 'Romantik Enstrümantal Müzik', artist: 'Piano', category: 'enstrumantal' },
  { id: 'EPEmEMp8zp4', title: 'Halo - Cello & Piano Cover', artist: 'Brooklyn Duo', category: 'enstrumantal' },
];
