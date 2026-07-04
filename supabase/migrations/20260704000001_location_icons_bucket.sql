-- Storage bucket for location icon images.
-- Uses IF NOT EXISTS guard so it's safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'location-icons',
    'location-icons',
    true,
    2097152, -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload/replace/delete icons
CREATE POLICY "Admins can manage location icons"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'location-icons'
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        bucket_id = 'location-icons'
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- Anyone can read location icons (bucket is public, but belt-and-suspenders)
CREATE POLICY "Anyone can read location icons"
    ON storage.objects FOR SELECT
    TO authenticated, anon
    USING (bucket_id = 'location-icons');
