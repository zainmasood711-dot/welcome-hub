CREATE POLICY "storage_field_attachments_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'support_engineer')
  )
);

CREATE POLICY "storage_field_attachments_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'field-attachments'
  AND owner = auth.uid()
);

CREATE POLICY "storage_field_attachments_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'support_engineer')
  )
)
WITH CHECK (
  bucket_id = 'field-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'support_engineer')
  )
);

CREATE POLICY "storage_field_attachments_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'support_engineer')
  )
);