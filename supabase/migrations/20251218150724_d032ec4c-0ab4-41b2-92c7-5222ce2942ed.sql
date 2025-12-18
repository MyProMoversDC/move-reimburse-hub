-- Add operations_manager to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_manager';