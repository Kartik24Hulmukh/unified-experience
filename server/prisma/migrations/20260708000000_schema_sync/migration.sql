-- ============================================================
-- BErozgar — Schema Sync Migration
-- Date: 2026-07-08
--
-- PURPOSE: Bring the production database up to date with the
-- current Prisma schema. All previous models were added to
-- schema.prisma via `prisma db push` without creating proper
-- migration files. This migration is fully IDEMPOTENT — safe
-- to run on databases that already have some of these objects.
-- ============================================================

-- ── 1. Add missing PrivilegeLevel enum values ─────────────────
-- The schema_overhaul migration only added STANDARD and SUPER.
-- OBSERVER and REVIEWER were added to schema.prisma without a migration.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PrivilegeLevel' AND e.enumlabel = 'OBSERVER'
  ) THEN
    ALTER TYPE "PrivilegeLevel" ADD VALUE 'OBSERVER';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PrivilegeLevel' AND e.enumlabel = 'REVIEWER'
  ) THEN
    ALTER TYPE "PrivilegeLevel" ADD VALUE 'REVIEWER';
  END IF;
END $$;

-- ── 2. Create ListingModule enum ──────────────────────────────
-- The schema_overhaul migration added `module TEXT` to listings.
-- The current schema uses ListingModule enum. We create the enum
-- and alter the column type.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingModule') THEN
    CREATE TYPE "ListingModule" AS ENUM (
      'ACCOMMODATION',
      'RESALE',
      'ACADEMICS',
      'MESS',
      'HOSPITAL'
    );
  END IF;
END $$;

-- Alter the listings.module column from TEXT to ListingModule enum (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listings'
      AND column_name = 'module'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "listings"
      ALTER COLUMN "module" TYPE "ListingModule"
      USING ("module"::"ListingModule");
  END IF;
END $$;

-- Add module index if not exists
CREATE INDEX IF NOT EXISTS "listings_module_idx" ON "listings"("module");

-- ── 3. Create listing_images table ───────────────────────────
CREATE TABLE IF NOT EXISTS "listing_images" (
  "id"         TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "url"        TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- FK: listing_images → listings (CASCADE delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_images_listing_id_fkey'
  ) THEN
    ALTER TABLE "listing_images"
      ADD CONSTRAINT "listing_images_listing_id_fkey"
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "listing_images_listing_id_idx" ON "listing_images"("listing_id");

-- ── 4. Create mess_providers table ──────────────────────────
CREATE TABLE IF NOT EXISTS "mess_providers" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "location"      TEXT,
  "timings"       TEXT,
  "price_range"   TEXT,
  "cuisine"       TEXT[] NOT NULL DEFAULT '{}',
  "contact_phone" TEXT,
  "rating"        DOUBLE PRECISION DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mess_providers_pkey" PRIMARY KEY ("id")
);

-- ── 5. Create hospitals table ────────────────────────────────
CREATE TABLE IF NOT EXISTS "hospitals" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "address"         TEXT NOT NULL,
  "distance"        TEXT,
  "specialties"     TEXT[] NOT NULL DEFAULT '{}',
  "contact_phone"   TEXT,
  "emergency_phone" TEXT,
  "rating"          DOUBLE PRECISION DEFAULT 0,
  "is_active"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- ── 6. Ensure updated_at trigger function exists ─────────────
-- Prisma uses @updatedAt which translates to a trigger in Postgres
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for mess_providers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'mess_providers_updated_at'
  ) THEN
    CREATE TRIGGER mess_providers_updated_at
      BEFORE UPDATE ON "mess_providers"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Trigger for hospitals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hospitals_updated_at'
  ) THEN
    CREATE TRIGGER hospitals_updated_at
      BEFORE UPDATE ON "hospitals"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
