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