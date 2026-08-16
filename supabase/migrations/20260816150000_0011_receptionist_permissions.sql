CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_receptionist()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'receptionist'::user_role) AND is_active = true);
$$;
REVOKE ALL ON FUNCTION public.is_current_user_admin_or_receptionist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin_or_receptionist() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_permitted" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_current_user_admin() OR (public.is_current_user_admin_or_receptionist() AND role = 'barber'::user_role));

DROP POLICY IF EXISTS "collaborators_insert_admin" ON public.collaborators; DROP POLICY IF EXISTS "collaborators_update_admin" ON public.collaborators;
CREATE POLICY "collaborators_insert_management" ON public.collaborators FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin_or_receptionist());
CREATE POLICY "collaborators_update_management" ON public.collaborators FOR UPDATE TO authenticated USING (public.is_current_user_admin_or_receptionist()) WITH CHECK (public.is_current_user_admin_or_receptionist());

DROP POLICY IF EXISTS "services_insert_admin" ON public.services; DROP POLICY IF EXISTS "services_update_admin" ON public.services; DROP POLICY IF EXISTS "services_delete_admin" ON public.services;
CREATE POLICY "services_insert_management" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin_or_receptionist());
CREATE POLICY "services_update_management" ON public.services FOR UPDATE TO authenticated USING (public.is_current_user_admin_or_receptionist()) WITH CHECK (public.is_current_user_admin_or_receptionist());
CREATE POLICY "services_delete_management" ON public.services FOR DELETE TO authenticated USING (public.is_current_user_admin_or_receptionist());

DROP POLICY IF EXISTS "booking_links_insert_admin" ON public.booking_links; DROP POLICY IF EXISTS "booking_links_update_admin" ON public.booking_links; DROP POLICY IF EXISTS "booking_links_delete_admin" ON public.booking_links;
CREATE POLICY "booking_links_insert_management" ON public.booking_links FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin_or_receptionist());
CREATE POLICY "booking_links_update_management" ON public.booking_links FOR UPDATE TO authenticated USING (public.is_current_user_admin_or_receptionist()) WITH CHECK (public.is_current_user_admin_or_receptionist());
CREATE POLICY "booking_links_delete_management" ON public.booking_links FOR DELETE TO authenticated USING (public.is_current_user_admin_or_receptionist());

DROP POLICY IF EXISTS "cash_select_staff" ON public.cash_register; DROP POLICY IF EXISTS "cash_insert_staff" ON public.cash_register; DROP POLICY IF EXISTS "cash_update_staff" ON public.cash_register;
CREATE POLICY "cash_select_admin" ON public.cash_register FOR SELECT TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "cash_insert_admin" ON public.cash_register FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "cash_update_admin" ON public.cash_register FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

CREATE POLICY "fin_trans_insert_receptionist_sale" ON public.financial_transactions FOR INSERT TO authenticated
 WITH CHECK (public.is_current_user_admin_or_receptionist() AND type = 'income'::transaction_type AND category = 'Venda' AND reference_type = 'sale' AND created_by = auth.uid());
