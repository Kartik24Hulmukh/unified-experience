-- ============================================================
-- BErozgar — Schema Sync Migration
-- Date: 2026-07-08
--
-- PURPOSE: Bring the production database up to date with the
-- current Prisma schema. All previous models were added to
-- schema.prisma via `prisma db push` without creating proper
-- migration files.
--
-- NOTE: This migration uses the CREATE TYPE + RENAME pattern
-- for enum alterations to remain safe inside Prisma's
-- transaction wrapper. ALTER TYPE ... ADD VALUE cannot run
-- inside a PostgreSQL transaction block.
-- ============================================================

-- ── 1. Add missing PrivilegeLevel enum values ─────────────────
-- The schema_overhaul migration added STANDARD and SUPER only.
-- We recreate the enum with OBSERVER and REVIEWER included.
-- Uses the CREATE new → USING cast → RENAME pattern (transaction-safe).
CREATE TYPE "PrivilegeLevel_new" AS ENUM ('STANDARD', 'SUPER', 'OBSERVER', 'REVIEWER');

ALTER TABLE "users" ALTER COLUMN "privilege_level" DROP DEFAULT;

ALTER TABLE "users" ALTER COLUMN "privilege_level" TYPE "PrivilegeLevel_new"
  USING "privilege_level"::text::"PrivilegeLevel_new";

ALTER TYPE "PrivilegeLevel" RENAME TO "PrivilegeLevel_old";
ALTER TYPE "PrivilegeLevel_new" RENAME TO "PrivilegeLevel";
DROP TYPE "PrivilegeLevel_old";

ALTER TABLE "users" ALTER COLUMN "privilege_level" SET DEFAULT 'STANDARD';

-- ── 2. Create ListingModule enum ──────────────────────────────
-- The schema_overhaul migration added `module TEXT` to listings.
-- The current schema uses ListingModule enum.
CREATE TYPE "ListingModule" AS ENUM (
  'ACCOMMODATION',
  'RESALE',
  'ACADEMICS',
  'MESS',
  'HOSPITAL'
);

-- Alter the listings.module column from TEXT to ListingModule enum.
-- Invalid/unrecognised text values are coerced to NULL (column is nullable).
ALTER TABLE "listings"
  ALTER COLUMN "module" TYPE "ListingModule"
  USING CASE
    WHEN "module" IN ('ACCOMMODATION','RESALE','ACADEMICS','MESS','HOSPITAL')
      THEN "module"::"ListingModule"
    ELSE NULL
  END;

-- Add module index
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
ALTER TABLE "listing_images"
  ADD CONSTRAINT "listing_images_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

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
