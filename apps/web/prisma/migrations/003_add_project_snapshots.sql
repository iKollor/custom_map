-- Stores the full map editor state (projects, categories, features) as JSON.
-- A single-tenant app can use a fixed row id ("default"); the schema allows
-- additional rows per user/tenant in the future.

CREATE TABLE IF NOT EXISTS "project_snapshots" (
    "id" TEXT PRIMARY KEY,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);