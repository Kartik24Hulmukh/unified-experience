-- Identity & Access Model migration
-- Adds CollegeStudentRegistry, new UserRole enum values, college link FK

-- 1. Create college_students registry table
CREATE TABLE IF NOT EXISTS "college_students" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "official_email" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "year" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "college_students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "college_students_official_email_key"
    ON "college_students"("official_email");

CREATE INDEX IF NOT EXISTS "college_students_official_email_idx"
    ON "college_students"("official_email");

-- 2. Migrate UserRole enum: STUDENT → STUDENT_VERIFIED, add PUBLIC_USER
--    Existing STUDENT users become STUDENT_VERIFIED (they signed up with college email).
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('STUDENT_VERIFIED', 'PUBLIC_USER', 'ADMIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Map old values: STUDENT → STUDENT_VERIFIED, ADMIN stays ADMIN
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new"
    USING (
        CASE "role"::text
            WHEN 'STUDENT' THEN 'STUDENT_VERIFIED'::"UserRole_new"
            WHEN 'ADMIN'   THEN 'ADMIN'::"UserRole_new"
            ELSE 'PUBLIC_USER'::"UserRole_new"
        END
    );

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PUBLIC_USER';
COMMIT;

-- 3. Add college_student_id FK to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "college_student_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_college_student_id_key"
    ON "users"("college_student_id");

ALTER TABLE "users" ADD CONSTRAINT "users_college_student_id_fkey"
    FOREIGN KEY ("college_student_id") REFERENCES "college_students"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
