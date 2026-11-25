-- Turns the free-text items.category / items.brand columns into foreign keys
-- to the new categories / brands tables, and adds the brochure columns.
--
-- Hand-edited: Prisma's generated order (DropIndex → AlterTable → CreateTable)
-- would drop the two columns before the new tables exist, losing the values.
-- Here the tables are created first, the add-only half of the ALTER runs, the
-- existing values are copied over, and only then are the columns dropped. The
-- end state is byte-identical to the generated draft, so there is no drift,
-- and the data-migration statements are no-ops on an empty database, so
-- `migrate reset` and fresh deploys behave the same.

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- AlterTable (add-only half)
ALTER TABLE "items" ADD COLUMN     "brand_id" INTEGER,
ADD COLUMN     "brochure_file" VARCHAR(100),
ADD COLUMN     "brochure_name" VARCHAR(255),
ADD COLUMN     "brochure_size" INTEGER,
ADD COLUMN     "category_id" INTEGER;

-- Data migration (hand-written). The app stores NULL for an emptied field, but
-- guard against '' anyway so no nameless category is ever created.
INSERT INTO "categories" ("name")
SELECT DISTINCT "category" FROM "items" WHERE "category" IS NOT NULL AND "category" <> '';

INSERT INTO "brands" ("name")
SELECT DISTINCT "brand" FROM "items" WHERE "brand" IS NOT NULL AND "brand" <> '';

UPDATE "items" i SET "category_id" = c."id" FROM "categories" c WHERE i."category" = c."name";
UPDATE "items" i SET "brand_id"    = b."id" FROM "brands"     b WHERE i."brand"    = b."name";

-- Abort (the whole file runs in one transaction) if any non-empty value
-- failed to map — better to keep the old columns than to drop data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "items" WHERE "category" IS NOT NULL AND "category" <> '' AND "category_id" IS NULL)
  OR EXISTS (SELECT 1 FROM "items" WHERE "brand" IS NOT NULL AND "brand" <> '' AND "brand_id" IS NULL)
  THEN RAISE EXCEPTION 'catalog_refs migration: unmapped category/brand value'; END IF;
END $$;

-- DropIndex
DROP INDEX "items_brand_idx";

-- DropIndex
DROP INDEX "items_category_idx";

-- DropIndex
DROP INDEX "items_category_trgm";

-- AlterTable (destructive half, now safe)
ALTER TABLE "items" DROP COLUMN "brand",
DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "items_brand_id_idx" ON "items"("brand_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
