CREATE OR REPLACE FUNCTION public.validate_attachment_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ext TEXT;
  image_exts TEXT[] := ARRAY['jpg','jpeg','png','webp'];
  document_exts TEXT[] := ARRAY['pdf','csv','xlsx','xls','txt'];
  battery_exts TEXT[] := ARRAY['log','csv','txt'];
BEGIN
  IF NEW.file_path IS NULL OR length(trim(NEW.file_path)) = 0 THEN
    RAISE EXCEPTION 'file_path is required';
  END IF;

  IF NEW.file_size IS NOT NULL AND NEW.file_size < 0 THEN
    RAISE EXCEPTION 'file_size cannot be negative';
  END IF;

  ext := lower(split_part(NEW.file_path, '.', array_length(string_to_array(NEW.file_path, '.'), 1)));
  IF ext IS NULL OR ext = '' THEN
    RAISE EXCEPTION 'unsupported file extension';
  END IF;

  IF NEW.file_type = 'image' THEN
    IF NOT (ext = ANY (image_exts)) THEN
      RAISE EXCEPTION 'file_type image requires jpg/jpeg/png/webp extension';
    END IF;
    IF NEW.file_size IS NOT NULL AND NEW.file_size > 5242880 THEN
      RAISE EXCEPTION 'image file_size exceeds 5MB limit';
    END IF;
  ELSIF NEW.file_type = 'document' THEN
    IF NOT (ext = ANY (document_exts)) THEN
      RAISE EXCEPTION 'file_type document requires pdf/csv/xlsx/xls/txt extension';
    END IF;
    IF NEW.file_size IS NOT NULL AND NEW.file_size > 20971520 THEN
      RAISE EXCEPTION 'document file_size exceeds 20MB limit';
    END IF;
  ELSIF NEW.file_type = 'battery_file' THEN
    IF NOT (ext = ANY (battery_exts)) THEN
      RAISE EXCEPTION 'file_type battery_file requires log/csv/txt extension';
    END IF;
    IF NEW.file_size IS NOT NULL AND NEW.file_size > 20971520 THEN
      RAISE EXCEPTION 'battery file_size exceeds 20MB limit';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;