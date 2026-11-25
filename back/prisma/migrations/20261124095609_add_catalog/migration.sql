-- Hand-added: the trigram indexes below (items_*_trgm) need pg_trgm, and
-- Prisma never emits CREATE EXTENSION without the postgresqlExtensions preview
-- feature. It has to come first. pg_trgm is a trusted extension from
-- Postgres 13 on, so the database owner can create it without superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('PRODATA', 'LOCAL');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "source" "ItemSource" NOT NULL DEFAULT 'PRODATA',
    "type" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "description" VARCHAR(255) NOT NULL,
    "category" VARCHAR(80),
    "base_unit_code" VARCHAR(10) NOT NULL,
    "cost_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "vat_code" VARCHAR(20) NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "source_id" INTEGER,
    "barcode" VARCHAR(60),
    "manufacturer" VARCHAR(80),
    "brand" VARCHAR(80),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "item_units" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "unit_code" VARCHAR(10) NOT NULL,
    "factor" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "item_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_cost_history" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "old_cost" DECIMAL(12,4),
    "new_cost" DECIMAL(12,4) NOT NULL,
    "source" "ItemSource" NOT NULL,
    "sync_run_id" INTEGER,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cost_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "archived_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_rates" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,

    CONSTRAINT "vat_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_sku_key" ON "items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "items_source_id_key" ON "items"("source_id");

-- CreateIndex
CREATE INDEX "items_category_idx" ON "items"("category");

-- CreateIndex
CREATE INDEX "items_is_archived_idx" ON "items"("is_archived");

-- CreateIndex
CREATE INDEX "items_type_idx" ON "items"("type");

-- CreateIndex
CREATE INDEX "items_brand_idx" ON "items"("brand");

-- CreateIndex
CREATE INDEX "items_sku_trgm" ON "items" USING GIN ("sku" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "items_description_trgm" ON "items" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "items_category_trgm" ON "items" USING GIN ("category" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "item_units_item_id_unit_code_key" ON "item_units"("item_id", "unit_code");

-- CreateIndex
CREATE INDEX "item_cost_history_item_id_changed_at_idx" ON "item_cost_history"("item_id", "changed_at");

-- CreateIndex
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "vat_rates_code_valid_from_key" ON "vat_rates"("code", "valid_from");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_base_unit_code_fkey" FOREIGN KEY ("base_unit_code") REFERENCES "units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "units"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cost_history" ADD CONSTRAINT "item_cost_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cost_history" ADD CONSTRAINT "item_cost_history_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
