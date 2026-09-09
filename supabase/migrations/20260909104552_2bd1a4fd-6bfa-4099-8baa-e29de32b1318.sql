CREATE TABLE public.demo_usage (
  id text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  limit_total integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.demo_usage TO service_role;

ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;

INSERT INTO public.demo_usage (id, used, limit_total) VALUES ('global', 0, 50);

CREATE OR REPLACE FUNCTION public.demo_consume()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.demo_usage
     SET used = used + 1, updated_at = now()
   WHERE id = 'global' AND used < limit_total
  RETURNING used;
$$;

CREATE OR REPLACE FUNCTION public.demo_release()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.demo_usage
     SET used = greatest(used - 1, 0), updated_at = now()
   WHERE id = 'global';
$$;