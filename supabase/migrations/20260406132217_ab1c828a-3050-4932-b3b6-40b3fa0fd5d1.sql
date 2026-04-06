-- Step 1: Add 'guest' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guest' AFTER 'approved';