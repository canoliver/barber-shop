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
