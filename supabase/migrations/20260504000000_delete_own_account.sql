-- Zelf-service: ingelogde gebruiker verwijdert eigen auth.users-rij (cascade naar public.*).
-- SECURITY DEFINER: alleen DELETE op auth.users waar id = auth.uid(); niet aan callable voor anon.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '28000';
  END IF;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

COMMENT ON FUNCTION public.delete_own_account() IS 'Verwijdert het eigen Supabase Auth-account; publieke tabellen volgen via ON DELETE CASCADE.';

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
