-- APODEX continuation k: admin-reviewed campus answers stored in the database,
-- plus gap resolution tracking so the demand queue shrinks as answers ship.

-- AlterTable
ALTER TABLE "campus_qa_gaps" ADD COLUMN "resolved_at" TIMESTAMP(3),
ADD COLUMN "answer_id" UUID;

-- CreateIndex
CREATE INDEX "campus_qa_gaps_resolved_at_idx" ON "campus_qa_gaps"("resolved_at");

-- CreateTable
CREATE TABLE "campus_qa_answers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "question" VARCHAR(200) NOT NULL,
    "answer" VARCHAR(1200) NOT NULL,
    "topic" VARCHAR(20) NOT NULL,
    "keywords" TEXT[],
    "source" VARCHAR(300) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_qa_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campus_qa_answers_slug_key" ON "campus_qa_answers"("slug");

-- CreateIndex
CREATE INDEX "campus_qa_answers_published_idx" ON "campus_qa_answers"("published");
