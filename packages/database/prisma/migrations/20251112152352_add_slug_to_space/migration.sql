-- Step 1: Add slug column as nullable first
ALTER TABLE "Space" ADD COLUMN     "slug" TEXT;

-- Step 2: Generate unique slugs for existing spaces
UPDATE "Space"
SET "slug" =
  CASE
    WHEN "id" IS NOT NULL THEN
      LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9\s-]', '', 'g')) || '-' || SUBSTRING("id", LENGTH("id") - 7)
    ELSE 'unnamed-space'
  END
WHERE "slug" IS NULL;

-- Step 3: Make the column NOT NULL
ALTER TABLE "Space" ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Create unique index
CREATE UNIQUE INDEX "Space_workspaceId_teamId_slug_key" ON "Space"("workspaceId", "teamId", "slug");