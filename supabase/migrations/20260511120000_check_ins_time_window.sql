-- Inchecken voor "vandaag" (Amsterdam) alleen tussen 08:00 en 22:00 lokale tijd.

CREATE OR REPLACE FUNCTION public.check_ins_enforce_time_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amsterdam_vandaag date := (timezone('Europe/Amsterdam', now()))::date;
  amsterdam_tijd time := (timezone('Europe/Amsterdam', now()))::time;
  wordt_actief boolean;
BEGIN
  wordt_actief := NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active');

  IF wordt_actief AND NEW.date = amsterdam_vandaag THEN
    IF amsterdam_tijd < time '08:00' OR amsterdam_tijd >= time '22:00' THEN
      RAISE EXCEPTION 'Inchecken is alleen mogelijk tussen 08:00 en 22:00 (Nederlandse tijd).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_ins_time_window ON public.check_ins;

CREATE TRIGGER check_ins_time_window
  BEFORE INSERT OR UPDATE ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ins_enforce_time_window();
