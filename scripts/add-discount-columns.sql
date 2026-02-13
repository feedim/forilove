-- Add discount columns to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS discount_price integer;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS discount_label text;

-- Update template prices: Premium templates (179 FL)
UPDATE templates SET coin_price = 179, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Midnight Whisper';

UPDATE templates SET coin_price = 179, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Timeless';

UPDATE templates SET coin_price = 179, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Davetiye';

-- Mid-tier templates (159 FL)
UPDATE templates SET coin_price = 159, discount_price = 99, discount_label = '14 Şubat''a Özel'
WHERE name = 'Valentine';

UPDATE templates SET coin_price = 159, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Monochrome';

UPDATE templates SET coin_price = 159, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Gitmeden Önce';

-- Basic templates (129 FL)
UPDATE templates SET coin_price = 129, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Annem';

UPDATE templates SET coin_price = 129, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Babam';

UPDATE templates SET coin_price = 129, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Best Friends';

UPDATE templates SET coin_price = 129, discount_price = 99, discount_label = 'Sınırlı Süre'
WHERE name = 'Birthday';
