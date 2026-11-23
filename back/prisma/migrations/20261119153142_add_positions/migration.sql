-- Positions become a table, and employees.position (free text) becomes a
-- foreign key to it.
--
-- Order matters: the backfill has to run while the old text column is still
-- there. `prisma migrate dev` would have emitted ADD COLUMN then DROP COLUMN
-- and destroyed all 15 values.

-- 1. the table
CREATE TABLE "positions" (
    "id"         SERIAL       NOT NULL,
    "name"       VARCHAR(80)  NOT NULL,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- 2. the canonical five first, so they take the low ids, then every value the
--    data actually uses. ON CONFLICT keeps the pair idempotent.
INSERT INTO "positions" ("name")
SELECT unnest(ARRAY['Technician','Team leader','Project manager','Sales','Administration'])
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "positions" ("name")
SELECT DISTINCT btrim("position")
FROM "employees"
WHERE "position" IS NOT NULL AND btrim("position") <> ''
ON CONFLICT ("name") DO NOTHING;

-- 3. point employees at it, BEFORE the old column goes
ALTER TABLE "employees" ADD COLUMN "position_id" INTEGER;

UPDATE "employees" e
SET "position_id" = p."id"
FROM "positions" p
WHERE btrim(e."position") = p."name";

-- 4. only now is the free text redundant
ALTER TABLE "employees" DROP COLUMN "position";

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "positions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Postgres does not index foreign keys automatically.
CREATE INDEX "employees_position_id_idx" ON "employees"("position_id");
