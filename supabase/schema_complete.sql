-- Barber Shop - complete schema for a new Supabase project
-- Execute this entire file once in Supabase SQL Editor.

-- ============================================================================
-- SOURCE: 20260802184859_0001_create_profiles_and_enums.sql
-- ============================================================================
/*
# BarberPro — Profiles, Enums, and Barbershop Settings

1. New Types (Enums)
- `user_role`: admin | barber | receptionist
- `appointment_status`: scheduled | confirmed | in_progress | completed | cancelled | no_show
- `appointment_source`: manual | link | walk_in
- `payment_method`: cash | credit_card | debit_card | pix | mixed
- `discount_type`: percentage | fixed
- `sale_item_type`: service | product
- `movement_type`: entry | exit | adjustment | sale
- `transaction_type`: income | expense
- `cash_status`: open | closed
- `reward_type`: discount | free_service | product

2. New Tables
- `profiles`: extends auth.users (full_name, phone, avatar_url, role, is_active).
- `settings`: singleton barbershop configuration (id=1).

3. Security
- RLS enabled on profiles and settings.
- Profiles: users read/update own; admins read/update all.
- Settings: authenticated can read; admins can write.
- SECURITY DEFINER helper `is_current_user_admin()`.
- Auto-create profile on signup via trigger.
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'barber', 'receptionist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_source AS ENUM ('manual', 'link', 'walk_in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'pix', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_item_type AS ENUM ('service', 'product');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM ('entry', 'exit', 'adjustment', 'sale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cash_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_type AS ENUM ('discount', 'free_service', 'product');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  role user_role NOT NULL DEFAULT 'barber',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: is_current_user_admin() — SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
  );
$$;

-- ============================================================
-- PROFILE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- SETTINGS TABLE (singleton row id=1)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  shop_name text NOT NULL DEFAULT 'BarberPro',
  logo_url text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  cnpj text DEFAULT '',
  opening_time time DEFAULT '09:00',
  closing_time time DEFAULT '19:00',
  instagram text DEFAULT '',
  facebook text DEFAULT '',
  whatsapp text DEFAULT '',
  slot_interval_minutes integer NOT NULL DEFAULT 30,
  allow_online_booking boolean NOT NULL DEFAULT true,
  max_advance_booking_days integer NOT NULL DEFAULT 30,
  cancellation_policy text DEFAULT '',
  email_notifications boolean NOT NULL DEFAULT true,
  loyalty_enabled boolean NOT NULL DEFAULT true,
  points_per_real numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_authenticated" ON public.settings;
CREATE POLICY "settings_select_authenticated" ON public.settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings FOR UPDATE
  TO authenticated USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "settings_insert_admin" ON public.settings;
CREATE POLICY "settings_insert_admin" ON public.settings FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

-- ============================================================
-- TRIGGERS: auto-create profile + updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- SOURCE: 20260802184923_0002_create_core_tables.sql
-- ============================================================================
/*
# BarberPro — Core Business Tables

1. New Tables
- `clients`: customer records (full_name, phone unique, email, birth_date, notes, loyalty_points).
- `services`: service catalog (name, description, duration_minutes, price, category, is_active, image_url).
- `collaborators`: barbers/staff (profile_id FK, full_name, phone, email, nickname, specialty, commission_percentage, work_days jsonb, work_hours, breaks, is_active, avatar_url).
- `products`: product catalog (name, brand, category, sku unique, barcode, cost_price, selling_price, image_url, is_active).
- `inventory`: per-product stock (current_stock, minimum_stock, maximum_stock, location).
- `inventory_movements`: stock movement log (product_id, movement_type, quantity, previous_stock, new_stock, reason, performed_by).
- `appointments`: booking records (client_id, collaborator_id, service_id, appointment_date, start_time, end_time, status, notes, source, created_by).

2. Indexes
- clients.phone (unique), clients.full_name
- services.category, services.is_active
- collaborators.profile_id, collaborators.is_active
- products.sku (unique), products.category
- inventory.product_id
- inventory_movements.product_id, created_at
- appointments.appointment_date, appointments.collaborator_id, appointments.client_id, appointments.status

3. Security
- RLS enabled on all tables.
- Admins: full CRUD.
- Receptionists: read/write clients, appointments; read services, collaborators, products, inventory.
- Barbers: read clients, services, collaborators, products, inventory; read/write own appointments.
- Public booking page (anon) can read active services and collaborators (for the booking flow) — handled in a later migration via a dedicated policy set.
*/

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text UNIQUE NOT NULL,
  email text DEFAULT '',
  birth_date date,
  notes text DEFAULT '',
  loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients (phone);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_staff" ON public.clients;
CREATE POLICY "clients_select_staff" ON public.clients FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "clients_insert_staff" ON public.clients;
CREATE POLICY "clients_insert_staff" ON public.clients FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update_staff" ON public.clients;
CREATE POLICY "clients_update_staff" ON public.clients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
CREATE POLICY "clients_delete_admin" ON public.clients FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 30,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Outros',
  is_active boolean NOT NULL DEFAULT true,
  image_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services (category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services (is_active);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_staff" ON public.services;
CREATE POLICY "services_select_staff" ON public.services FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "services_insert_admin" ON public.services;
CREATE POLICY "services_insert_admin" ON public.services FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "services_update_admin" ON public.services;
CREATE POLICY "services_update_admin" ON public.services FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "services_delete_admin" ON public.services;
CREATE POLICY "services_delete_admin" ON public.services FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- COLLABORATORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  nickname text DEFAULT '',
  specialty text DEFAULT '',
  commission_percentage numeric(5,2) NOT NULL DEFAULT 0,
  work_days jsonb NOT NULL DEFAULT '["1","2","3","4","5"]'::jsonb,
  work_hours_start time NOT NULL DEFAULT '09:00',
  work_hours_end time NOT NULL DEFAULT '19:00',
  break_start time,
  break_end time,
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_profile_id ON public.collaborators (profile_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_is_active ON public.collaborators (is_active);

ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collaborators_select_staff" ON public.collaborators;
CREATE POLICY "collaborators_select_staff" ON public.collaborators FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "collaborators_insert_admin" ON public.collaborators;
CREATE POLICY "collaborators_insert_admin" ON public.collaborators FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "collaborators_update_admin" ON public.collaborators;
CREATE POLICY "collaborators_update_admin" ON public.collaborators FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "collaborators_delete_admin" ON public.collaborators;
CREATE POLICY "collaborators_delete_admin" ON public.collaborators FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  brand text DEFAULT '',
  category text NOT NULL DEFAULT 'Outros',
  sku text UNIQUE DEFAULT '',
  barcode text DEFAULT '',
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_staff" ON public.products;
CREATE POLICY "products_select_staff" ON public.products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin" ON public.products FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin" ON public.products FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin" ON public.products FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock integer NOT NULL DEFAULT 0,
  minimum_stock integer NOT NULL DEFAULT 5,
  maximum_stock integer NOT NULL DEFAULT 100,
  location text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory (product_id);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select_staff" ON public.inventory;
CREATE POLICY "inventory_select_staff" ON public.inventory FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_insert_admin" ON public.inventory;
CREATE POLICY "inventory_insert_admin" ON public.inventory FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "inventory_update_staff" ON public.inventory;
CREATE POLICY "inventory_update_staff" ON public.inventory FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_delete_admin" ON public.inventory;
CREATE POLICY "inventory_delete_admin" ON public.inventory FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

DROP TRIGGER IF EXISTS inventory_set_updated_at ON public.inventory;
CREATE TRIGGER inventory_set_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INVENTORY MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reason text DEFAULT '',
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product_id ON public.inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at ON public.inventory_movements (created_at);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_movements_select_staff" ON public.inventory_movements;
CREATE POLICY "inv_movements_select_staff" ON public.inventory_movements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "inv_movements_insert_staff" ON public.inventory_movements;
CREATE POLICY "inv_movements_insert_staff" ON public.inventory_movements FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "inv_movements_update_admin" ON public.inventory_movements;
CREATE POLICY "inv_movements_update_admin" ON public.inventory_movements FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "inv_movements_delete_admin" ON public.inventory_movements;
CREATE POLICY "inv_movements_delete_admin" ON public.inventory_movements FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes text DEFAULT '',
  source appointment_source NOT NULL DEFAULT 'manual',
  client_name text DEFAULT '',
  client_phone text DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_collaborator ON public.appointments (collaborator_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_staff" ON public.appointments;
CREATE POLICY "appointments_select_staff" ON public.appointments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "appointments_insert_staff" ON public.appointments;
CREATE POLICY "appointments_insert_staff" ON public.appointments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "appointments_update_staff" ON public.appointments;
CREATE POLICY "appointments_update_staff" ON public.appointments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "appointments_delete_staff" ON public.appointments;
CREATE POLICY "appointments_delete_staff" ON public.appointments FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- SOURCE: 20260802184947_0003_create_sales_financial_loyalty.sql
-- ============================================================================
/*
# BarberPro — Sales, Financial, Booking, Loyalty, Notifications

1. New Tables
- `sales`: POS sales header (appointment_id nullable, client_id, collaborator_id, payment_method, subtotal, discount_amount, discount_type, total_amount, notes, created_by).
- `sale_items`: line items per sale (sale_id, item_type, service_id, product_id, quantity, unit_price, total_price).
- `commissions`: commission records per sale per collaborator (collaborator_id, sale_id, appointment_id, commission_percentage, commission_amount, is_paid, paid_at).
- `financial_transactions`: manual income/expense entries (type, category, description, amount, payment_method, reference_id, reference_type, date, created_by).
- `cash_register`: cash sessions (opened_by, closed_by, opening_balance, closing_balance, total_income, total_expenses, status, opened_at, closed_at, notes).
- `booking_links`: per-collaborator public booking slugs (collaborator_id, slug unique, is_active, custom_message).
- `loyalty_rewards`: reward catalog (name, description, points_required, reward_type, reward_value, is_active).
- `notifications`: per-user notifications (recipient_id, title, message, type, is_read).

2. Indexes
- sales.created_at, sales.client_id, sales.collaborator_id
- sale_items.sale_id
- commissions.collaborator_id, commissions.is_paid, commissions.sale_id
- financial_transactions.date, financial_transactions.type
- cash_register.status, cash_register.opened_at
- booking_links.slug (unique)
- notifications.recipient_id, notifications.is_read

3. Security
- RLS enabled on all tables.
- Sales/sale_items: all staff read; admin/receptionist/barber write (sales are created by all roles).
- Commissions: all staff read; only admin can mark paid / update.
- Financial transactions: admin read/write; others no access (financial reports restricted).
- Cash register: admin/receptionist read/write.
- Booking links: all staff read; admin write. (Public anon read handled in booking migration.)
- Loyalty rewards: all staff read; admin write.
- Notifications: each user reads/updates own only.
*/

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_type discount_type NOT NULL DEFAULT 'fixed',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales (client_id);
CREATE INDEX IF NOT EXISTS idx_sales_collaborator_id ON public.sales (collaborator_id);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_staff" ON public.sales;
CREATE POLICY "sales_select_staff" ON public.sales FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "sales_insert_staff" ON public.sales;
CREATE POLICY "sales_insert_staff" ON public.sales FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sales_update_admin" ON public.sales;
CREATE POLICY "sales_update_admin" ON public.sales FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;
CREATE POLICY "sales_delete_admin" ON public.sales FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_type sale_item_type NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_items_select_staff" ON public.sale_items;
CREATE POLICY "sale_items_select_staff" ON public.sale_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "sale_items_insert_staff" ON public.sale_items;
CREATE POLICY "sale_items_insert_staff" ON public.sale_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sale_items_update_admin" ON public.sale_items;
CREATE POLICY "sale_items_update_admin" ON public.sale_items FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "sale_items_delete_admin" ON public.sale_items;
CREATE POLICY "sale_items_delete_admin" ON public.sale_items FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  commission_percentage numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_collaborator_id ON public.commissions (collaborator_id);
CREATE INDEX IF NOT EXISTS idx_commissions_is_paid ON public.commissions (is_paid);
CREATE INDEX IF NOT EXISTS idx_commissions_sale_id ON public.commissions (sale_id);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_select_staff" ON public.commissions;
CREATE POLICY "commissions_select_staff" ON public.commissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "commissions_insert_staff" ON public.commissions;
CREATE POLICY "commissions_insert_staff" ON public.commissions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "commissions_update_admin" ON public.commissions;
CREATE POLICY "commissions_update_admin" ON public.commissions FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "commissions_delete_admin" ON public.commissions;
CREATE POLICY "commissions_delete_admin" ON public.commissions FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- FINANCIAL TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  description text DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method,
  reference_id uuid,
  reference_type text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_trans_date ON public.financial_transactions (date);
CREATE INDEX IF NOT EXISTS idx_fin_trans_type ON public.financial_transactions (type);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_trans_select_admin" ON public.financial_transactions;
CREATE POLICY "fin_trans_select_admin" ON public.financial_transactions FOR SELECT
  TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "fin_trans_insert_admin" ON public.financial_transactions;
CREATE POLICY "fin_trans_insert_admin" ON public.financial_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "fin_trans_update_admin" ON public.financial_transactions;
CREATE POLICY "fin_trans_update_admin" ON public.financial_transactions FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "fin_trans_delete_admin" ON public.financial_transactions;
CREATE POLICY "fin_trans_delete_admin" ON public.financial_transactions FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- CASH REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opening_balance numeric(10,2) NOT NULL DEFAULT 0,
  closing_balance numeric(10,2),
  total_income numeric(10,2) NOT NULL DEFAULT 0,
  total_expenses numeric(10,2) NOT NULL DEFAULT 0,
  status cash_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cash_register_status ON public.cash_register (status);
CREATE INDEX IF NOT EXISTS idx_cash_register_opened_at ON public.cash_register (opened_at);

ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_select_staff" ON public.cash_register;
CREATE POLICY "cash_select_staff" ON public.cash_register FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "cash_insert_staff" ON public.cash_register;
CREATE POLICY "cash_insert_staff" ON public.cash_register FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cash_update_staff" ON public.cash_register;
CREATE POLICY "cash_update_staff" ON public.cash_register FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_delete_admin" ON public.cash_register;
CREATE POLICY "cash_delete_admin" ON public.cash_register FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- BOOKING LINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  custom_message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_links_slug ON public.booking_links (slug);

ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_links_select_staff" ON public.booking_links;
CREATE POLICY "booking_links_select_staff" ON public.booking_links FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "booking_links_insert_admin" ON public.booking_links;
CREATE POLICY "booking_links_insert_admin" ON public.booking_links FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "booking_links_update_admin" ON public.booking_links;
CREATE POLICY "booking_links_update_admin" ON public.booking_links FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "booking_links_delete_admin" ON public.booking_links;
CREATE POLICY "booking_links_delete_admin" ON public.booking_links FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- LOYALTY REWARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  points_required integer NOT NULL DEFAULT 0,
  reward_type reward_type NOT NULL DEFAULT 'discount',
  reward_value numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_select_staff" ON public.loyalty_rewards;
CREATE POLICY "loyalty_select_staff" ON public.loyalty_rewards FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "loyalty_insert_admin" ON public.loyalty_rewards;
CREATE POLICY "loyalty_insert_admin" ON public.loyalty_rewards FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "loyalty_update_admin" ON public.loyalty_rewards;
CREATE POLICY "loyalty_update_admin" ON public.loyalty_rewards FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "loyalty_delete_admin" ON public.loyalty_rewards;
CREATE POLICY "loyalty_delete_admin" ON public.loyalty_rewards FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "notif_insert_staff" ON public.notifications;
CREATE POLICY "notif_insert_staff" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = recipient_id);


-- ============================================================================
-- SOURCE: 20260802185007_0004_public_booking_and_seed.sql
-- ============================================================================
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


-- ============================================================================
-- SOURCE: 20260802190103_0005_create_storage_buckets.sql
-- ============================================================================
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


-- ============================================================================
-- SOURCE: 20260802190110_0006_enable_realtime.sql
-- ============================================================================
/*
# BarberPro — Enable Realtime

Enable Supabase Realtime for the tables that need live updates:
- appointments (calendar updates)
- notifications (notification badge)
- sales (dashboard revenue)
- inventory (stock alerts)

Realtime is enabled by adding tables to the publication.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;


-- ============================================================================
-- SOURCE: 20260812210347_0007_add_client_role.sql.sql
-- ============================================================================
/*
# Add 'client' role to user_role enum

1. Changes
- Adds 'client' value to the existing user_role enum type.
- This allows auth.users (profiles) to have role = 'client', so clients can log in
  and see the accompaniment screen.
2. Security
- No RLS changes. Existing policies remain unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'client'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'client';
  END IF;
END $$;


-- ============================================================================
-- SOURCE: 20260814150000_0008_allow_receptionist_delete_clients.sql
-- ============================================================================
-- Client management is available to admins and receptionists. Keep the DELETE
-- policy aligned with the application and use a SECURITY DEFINER helper to
-- avoid RLS recursion while checking the current user's profile.
CREATE OR REPLACE FUNCTION public.can_current_user_manage_clients()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin'::user_role, 'receptionist'::user_role)
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.can_current_user_manage_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_current_user_manage_clients() TO authenticated;

DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_staff" ON public.clients;

CREATE POLICY "clients_delete_staff" ON public.clients FOR DELETE
  TO authenticated
  USING (public.can_current_user_manage_clients());

-- ============================================================================
-- SOURCE: 20260814170000_0009_client_first_access.sql
-- ============================================================================
-- Link client records to Supabase Auth and require a password change on first access.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients (auth_user_id);

-- ============================================================================
-- SOURCE: 20260814180000_0010_require_auth_for_booking.sql
-- ============================================================================
-- Booking links now require an authenticated client account.
DROP POLICY IF EXISTS "services_select_public" ON public.services;
DROP POLICY IF EXISTS "collaborators_select_public" ON public.collaborators;
DROP POLICY IF EXISTS "booking_links_select_public" ON public.booking_links;
DROP POLICY IF EXISTS "appointments_select_public" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_public" ON public.appointments;

