/*
# BarberPro — Storage Buckets

1. Storage Buckets
- avatars: for user/collaborator profile photos (public)
- services: for service images (public)
- products: for product images (public)
- barbershop: for logo and brand assets (public)

2. Storage Policies
- Authenticated users can upload/read to all buckets.
- Public read access for all buckets (images are displayed publicly).
*/

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('services', 'services', true),
  ('products', 'products', true),
  ('barbershop', 'barbershop', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_upload_auth" ON storage.objects;
CREATE POLICY "avatars_upload_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update_auth" ON storage.objects;
CREATE POLICY "avatars_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

-- Storage policies for services
DROP POLICY IF EXISTS "services_read_all" ON storage.objects;
CREATE POLICY "services_read_all" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'services');

DROP POLICY IF EXISTS "services_upload_auth" ON storage.objects;
CREATE POLICY "services_upload_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'services');

DROP POLICY IF EXISTS "services_update_auth" ON storage.objects;
CREATE POLICY "services_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'services') WITH CHECK (bucket_id = 'services');

-- Storage policies for products
DROP POLICY IF EXISTS "products_read_all" ON storage.objects;
CREATE POLICY "products_read_all" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'products');

DROP POLICY IF EXISTS "products_upload_auth" ON storage.objects;
CREATE POLICY "products_upload_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "products_update_auth" ON storage.objects;
CREATE POLICY "products_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'products') WITH CHECK (bucket_id = 'products');

-- Storage policies for barbershop
DROP POLICY IF EXISTS "barbershop_read_all" ON storage.objects;
CREATE POLICY "barbershop_read_all" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'barbershop');

DROP POLICY IF EXISTS "barbershop_upload_auth" ON storage.objects;
CREATE POLICY "barbershop_upload_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'barbershop');

DROP POLICY IF EXISTS "barbershop_update_auth" ON storage.objects;
CREATE POLICY "barbershop_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'barbershop') WITH CHECK (bucket_id = 'barbershop');
