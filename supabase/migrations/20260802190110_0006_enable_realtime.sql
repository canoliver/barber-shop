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
