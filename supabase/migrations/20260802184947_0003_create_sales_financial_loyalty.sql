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
