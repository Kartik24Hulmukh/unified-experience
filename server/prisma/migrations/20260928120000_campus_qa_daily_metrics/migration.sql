-- No historical backfill: existing gaps cannot supply an answered denominator.
CREATE TABLE "campus_qa_daily_metrics" (
  "day" DATE NOT NULL PRIMARY KEY,
  "answered" INTEGER NOT NULL DEFAULT 0 CHECK ("answered" >= 0),
  "unanswered" INTEGER NOT NULL DEFAULT 0 CHECK ("unanswered" >= 0),
  "reopened" INTEGER NOT NULL DEFAULT 0 CHECK ("reopened" >= 0)
);
