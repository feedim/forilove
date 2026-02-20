-- bundles: ana paket tablosu
CREATE TABLE public.bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- bundle_templates: junction tablosu
CREATE TABLE public.bundle_templates (
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bundle_id, template_id)
);

-- bundle_purchases: paket satın alma kaydı
CREATE TABLE public.bundle_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  bundle_id UUID NOT NULL REFERENCES public.bundles(id),
  coins_spent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: bundles
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles_public_read" ON public.bundles FOR SELECT USING (true);
CREATE POLICY "bundles_creator_insert" ON public.bundles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('creator','admin'))
  );
CREATE POLICY "bundles_owner_update" ON public.bundles FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "bundles_owner_delete" ON public.bundles FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS: bundle_templates
ALTER TABLE public.bundle_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_templates_public_read" ON public.bundle_templates FOR SELECT USING (true);
CREATE POLICY "bundle_templates_owner_manage" ON public.bundle_templates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bundles b
      WHERE b.id = bundle_id
      AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bundles b
      WHERE b.id = bundle_id
      AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'))
    )
  );

-- RLS: bundle_purchases
ALTER TABLE public.bundle_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_purchases_own_read" ON public.bundle_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "bundle_purchases_insert" ON public.bundle_purchases FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_bundles_slug ON public.bundles(slug);
CREATE INDEX idx_bundles_created_by ON public.bundles(created_by);
CREATE INDEX idx_bundles_is_active ON public.bundles(is_active);
CREATE INDEX idx_bundle_templates_bundle ON public.bundle_templates(bundle_id);
CREATE INDEX idx_bundle_templates_template ON public.bundle_templates(template_id);
CREATE INDEX idx_bundle_purchases_user ON public.bundle_purchases(user_id);
CREATE INDEX idx_bundle_purchases_bundle ON public.bundle_purchases(bundle_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bundles_updated_at
  BEFORE UPDATE ON public.bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bundles_updated_at();
