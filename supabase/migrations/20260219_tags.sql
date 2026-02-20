-- tags tablosu
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- template_tags junction
CREATE TABLE public.template_tags (
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (template_id, tag_id)
);

-- RLS: herkes okuyabilir
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_public_read" ON public.tags FOR SELECT USING (true);
ALTER TABLE public.template_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_tags_public_read" ON public.template_tags FOR SELECT USING (true);

-- Creator/admin yönetim
CREATE POLICY "tags_creator_insert" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('creator','admin')));

-- Admin: etiket güncelleme ve silme
CREATE POLICY "tags_admin_update" ON public.tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "tags_admin_delete" ON public.tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "template_tags_creator_manage" ON public.template_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.created_by = auth.uid()));

-- Indexes
CREATE INDEX idx_template_tags_template ON public.template_tags(template_id);
CREATE INDEX idx_template_tags_tag ON public.template_tags(tag_id);
CREATE INDEX idx_tags_slug ON public.tags(slug);

-- Seed etiketler
INSERT INTO public.tags (name, slug, description) VALUES
  ('Yıldönümü', 'yildonumu', 'Yıldönümü kutlamaları için özel şablonlar'),
  ('Doğum Günü', 'dogum-gunu', 'Doğum günü sürprizleri için şablonlar'),
  ('Sevgililer Günü', 'sevgililer-gunu', 'Sevgililer Günü''ne özel romantik şablonlar'),
  ('Evlilik Teklifi', 'evlilik-teklifi', 'Evlilik teklifi için unutulmaz şablonlar'),
  ('Anneler Günü', 'anneler-gunu', 'Anneler Günü için sevgi dolu şablonlar'),
  ('Babalar Günü', 'babalar-gunu', 'Babalar Günü için özel şablonlar'),
  ('Mezuniyet', 'mezuniyet', 'Mezuniyet kutlamaları için şablonlar'),
  ('Düğün', 'dugun', 'Düğün davetiyesi ve anılar için şablonlar'),
  ('Romantik', 'romantik', 'Romantik ve duygusal şablonlar'),
  ('Komik', 'komik', 'Eğlenceli ve komik şablonlar');
