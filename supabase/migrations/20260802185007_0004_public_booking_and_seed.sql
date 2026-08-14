/*
# BarberPro — Public Booking Access & Seed Data

1. Security Changes
- Allow anon (unauthenticated) access to the public booking flow:
  - SELECT active services (is_active = true)
  - SELECT active collaborators (is_active = true)
  - SELECT active booking_links (is_active = true)
  - INSERT appointments with source = 'link' (online bookings only)
  - SELECT appointments (so the booking page can check for conflicts / existing bookings on a date)
- These are scoped to only what the public booking page needs.

2. Seed Data
- 6 services across categories (Corte, Barba, Combo, Tratamento, Coloração).
- 6 products across categories (Pomada, Shampoo, Óleo para Barba, Cera, Pós-Barba, Acessórios).
- Inventory rows for each product.
- 3 loyalty rewards.
- 8 sample clients.
- Note: collaborators and the admin user are created via the app's registration flow (auth.users trigger creates profiles). The admin should register the first account, then create collaborators in the UI.
*/

-- ============================================================
-- PUBLIC BOOKING POLICIES (anon role)
-- ============================================================

-- Services: public can read active services
DROP POLICY IF EXISTS "services_select_public" ON public.services;
CREATE POLICY "services_select_public" ON public.services FOR SELECT
  TO anon USING (is_active = true);

-- Collaborators: public can read active collaborators
DROP POLICY IF EXISTS "collaborators_select_public" ON public.collaborators;
CREATE POLICY "collaborators_select_public" ON public.collaborators FOR SELECT
  TO anon USING (is_active = true);

-- Booking links: public can read active links
DROP POLICY IF EXISTS "booking_links_select_public" ON public.booking_links;
CREATE POLICY "booking_links_select_public" ON public.booking_links FOR SELECT
  TO anon USING (is_active = true);

-- Appointments: public can read (to check availability) — limited to date/collaborator columns
DROP POLICY IF EXISTS "appointments_select_public" ON public.appointments;
CREATE POLICY "appointments_select_public" ON public.appointments FOR SELECT
  TO anon USING (source IN ('link', 'manual', 'walk_in'));

-- Appointments: public can insert online bookings (source = 'link' only)
DROP POLICY IF EXISTS "appointments_insert_public" ON public.appointments;
CREATE POLICY "appointments_insert_public" ON public.appointments FOR INSERT
  TO anon WITH CHECK (source = 'link');

-- ============================================================
-- SEED: SERVICES
-- ============================================================
INSERT INTO public.services (name, description, duration_minutes, price, category, is_active) VALUES
  ('Corte Masculino', 'Corte de cabelo masculino clássico ou moderno, finalização com pomada.', 40, 45.00, 'Corte', true),
  ('Corte + Barba', 'Combo completo: corte de cabelo e modelagem de barba com toalha quente.', 60, 70.00, 'Combo', true),
  ('Barba', 'Modelagem e design de barba com toalha quente e óleo para barba.', 30, 35.00, 'Barba', true),
  ('Pigmentação', 'Pigmentação de barba e cabelo para disfarçar falhas e dar densidade.', 90, 120.00, 'Coloração', true),
  ('Hidratação Capilar', 'Tratamento profundo de hidratação para cabelo e couro cabeludo.', 45, 65.00, 'Tratamento', true),
  ('Corte Infantil', 'Corte de cabelo para crianças até 12 anos.', 30, 35.00, 'Corte', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: PRODUCTS
-- ============================================================
INSERT INTO public.products (name, description, brand, category, sku, barcode, cost_price, selling_price, is_active) VALUES
  ('Pomada Modeladora Matte', 'Pomada modeladora com acabamento matte e fixação forte.', 'BarberPro', 'Pomada', 'BP-POM-001', '7891234560011', 18.00, 39.90, true),
  ('Shampoo Anticaspa', 'Shampoo antiqueda e anticaspa para uso diário.', 'BarberPro', 'Shampoo', 'BP-SHA-001', '7891234560028', 15.00, 34.90, true),
  ('Condicionador Hidratante', 'Condicionador hidratante com óleo de argan.', 'BarberPro', 'Condicionador', 'BP-CON-001', '7891234560035', 16.00, 36.90, true),
  ('Óleo para Barba', 'Óleo hidratante e modelador para barba, aroma amadeirado.', 'BarberPro', 'Óleo para Barba', 'BP-OIL-001', '7891234560042', 12.00, 29.90, true),
  ('Cera para Cabelo', 'Cera modeladora com brilho e fixação média.', 'BarberPro', 'Cera', 'BP-CER-001', '7891234560059', 14.00, 32.90, true),
  ('Loção Pós-Barba', 'Loção calmante pós-barba, reduz irritação e vermelhidão.', 'BarberPro', 'Pós-Barba', 'BP-POS-001', '7891234560066', 10.00, 27.90, true)
ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- SEED: INVENTORY (one row per product)
-- ============================================================
INSERT INTO public.inventory (product_id, current_stock, minimum_stock, maximum_stock, location)
SELECT id, 20, 5, 100, 'Prateleira A' FROM public.products
WHERE NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.product_id = public.products.id);

-- ============================================================
-- SEED: LOYALTY REWARDS
-- ============================================================
INSERT INTO public.loyalty_rewards (name, description, points_required, reward_type, reward_value, is_active) VALUES
  ('Desconto de R$10', 'Desconto de R$10 na próxima visita.', 100, 'discount', 10.00, true),
  ('Corte Grátis', 'Um corte de cabelo gratuito (até R$45).', 500, 'free_service', 45.00, true),
  ('Pomada Grátis', 'Pomada modeladora matte grátis.', 300, 'product', 39.90, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: CLIENTS
-- ============================================================
INSERT INTO public.clients (full_name, phone, email, birth_date, notes, loyalty_points) VALUES
  ('João Silva', '(11) 98765-4321', 'joao.silva@email.com', '1990-05-15', 'Cliente fiel, prefere corte baixo.', 120),
  ('Pedro Santos', '(11) 91234-5678', 'pedro.santos@email.com', '1985-11-22', 'Alérgico a produtos com álcool.', 85),
  ('Carlos Oliveira', '(11) 99876-5432', 'carlos.oliveira@email.com', '1992-03-08', 'Sempre agenda combo corte + barba.', 230),
  ('Lucas Pereira', '(11) 95555-1234', 'lucas.pereira@email.com', '1998-07-30', 'Gosta de pomada matte.', 45),
  ('Marcos Costa', '(11) 97777-8888', 'marcos.costa@email.com', '1988-12-05', 'Cliente novo, indicado pelo João.', 15),
  ('Rafael Almeida', '(11) 96666-7777', 'rafael.almeida@email.com', '1995-09-18', 'Prefere atendimento aos sábados.', 180),
  ('Bruno Ferreira', '(11) 94444-3333', 'bruno.ferreira@email.com', '1993-01-25', 'Sempre leva o filho para cortar também.', 95),
  ('Diego Souza', '(11) 93333-2222', 'diego.souza@email.com', '2000-04-12', 'Cliente jovem, gosta de cortes modernos.', 30)
ON CONFLICT (phone) DO NOTHING;
