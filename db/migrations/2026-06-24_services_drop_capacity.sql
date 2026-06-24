-- Drop the `capacity` column from services (no longer tracked).
ALTER TABLE public.services DROP COLUMN IF EXISTS capacity;
