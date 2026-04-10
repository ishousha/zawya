-- Add missing admin role for Islam Abushousha
INSERT INTO public.user_roles (user_id, role)
VALUES ('7e4bed5b-1c36-4afd-9d17-03b81f8af48b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;