-- This migration adds a geometry column with proper PostGIS geography type
-- After running Prisma migrations, run this to add the geography column

ALTER TABLE "features"
ADD COLUMN geometry_geog geography (GEOMETRY, 4326);

-- Create index on geography column for spatial queries
CREATE INDEX idx_features_geometry_geog ON "features" USING GIST (geometry_geog);