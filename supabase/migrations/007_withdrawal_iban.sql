-- Withdrawal IBAN bilgilerini profiles tablosuna ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_iban TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_holder_name TEXT;

-- Withdrawal requests tablosuna komisyon kolonları ekle
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS commission_try NUMERIC(10,2) DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS gross_try NUMERIC(10,2) DEFAULT 0;
