-- Migration to allow Admins to delete their own clients and ensure RLS is correctly configured
-- This also adds an RLS policy for the delete operation which was missing

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clients' 
        AND policyname = 'Admins can delete their clients'
    ) THEN
        CREATE POLICY "Admins can delete their clients" 
        ON public.clients 
        FOR DELETE 
        TO authenticated 
        USING (admin_id = public.get_admin_id_for_user());
    END IF;
END $$;
