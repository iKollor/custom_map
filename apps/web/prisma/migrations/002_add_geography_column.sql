-- This migration adds a geometry column with proper PostGIS geography type.
-- Idempotent so it can be re-run safely on container startup.
-- Only applies if the "features" table already exists (Prisma db push).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'features'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'features'
              AND column_name = 'geometry_geog'
        ) THEN
            EXECUTE 'ALTER TABLE "features" ADD COLUMN geometry_geog geography(GEOMETRY, 4326)';
        END IF;

        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_features_geometry_geog ON "features" USING GIST (geometry_geog)';
    END IF;
END $$;