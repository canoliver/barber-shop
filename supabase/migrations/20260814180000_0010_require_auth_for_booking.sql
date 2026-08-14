-- Booking links now require an authenticated client account.
DROP POLICY IF EXISTS "services_select_public" ON public.services;
DROP POLICY IF EXISTS "collaborators_select_public" ON public.collaborators;
DROP POLICY IF EXISTS "booking_links_select_public" ON public.booking_links;
DROP POLICY IF EXISTS "appointments_select_public" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_public" ON public.appointments;