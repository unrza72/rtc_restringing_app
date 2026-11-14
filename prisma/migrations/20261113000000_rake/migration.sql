-- The own-string fee becomes the club's rake: same column, but it now applies
-- to every job, not just own-string ones (SPEC.md §5a). Renamed rather than
-- dropped so finished jobs keep the amount they were charged.
ALTER TABLE "ClubSettings" RENAME COLUMN "ownStringFeeCents" TO "rakeCents";
ALTER TABLE "StringingRequest" RENAME COLUMN "ownStringFeeCents" TO "rakeCents";
