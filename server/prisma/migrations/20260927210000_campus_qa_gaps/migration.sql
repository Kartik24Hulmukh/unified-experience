-- Aggregate privacy-safe demand signal for unmatched campus Q&A queries.
-- No user id, no IP: pure normalized query text + hit count.
CREATE TABLE "campus_qa_gaps" (
    "id" UUID NOT NULL,
    "query_hash" VARCHAR(64) NOT NULL,
    "query_text" VARCHAR(200) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campus_qa_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campus_qa_gaps_query_hash_key" ON "campus_qa_gaps"("query_hash");

-- CreateIndex
CREATE INDEX "campus_qa_gaps_hits_idx" ON "campus_qa_gaps"("hits");
