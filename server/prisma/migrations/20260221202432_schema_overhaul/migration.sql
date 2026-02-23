/*
  Warnings:

  - Added the required column `against_id` to the `disputes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `disputes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `disputes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seller_id` to the `requests` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PrivilegeLevel" AS ENUM ('STANDARD', 'SUPER');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('FRAUD', 'ITEM_NOT_AS_DESCRIBED', 'NO_SHOW', 'OTHER');

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_request_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_role" TEXT,
ADD COLUMN     "ip_address" VARCHAR(45);

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "against_id" UUID NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "listing_id" UUID,
ADD COLUMN     "type" "DisputeType" NOT NULL,
ALTER COLUMN "request_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "module" TEXT;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "seller_id" UUID NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "is_restricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privilege_level" "PrivilegeLevel" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "restriction_reason" TEXT;

-- CreateIndex
CREATE INDEX "disputes_against_id_idx" ON "disputes"("against_id");

-- CreateIndex
CREATE INDEX "listings_category_idx" ON "listings"("category");

-- CreateIndex
CREATE INDEX "requests_seller_id_idx" ON "requests"("seller_id");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_against_id_fkey" FOREIGN KEY ("against_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
