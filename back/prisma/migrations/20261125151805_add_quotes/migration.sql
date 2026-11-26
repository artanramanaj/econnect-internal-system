-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'READY_TO_SEND', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RevisionKind" AS ENUM ('NORMAL', 'CHANGE_ORDER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteLineKind" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" SERIAL NOT NULL,
    "doc_type" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(60) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" SERIAL NOT NULL,
    "partner_number" VARCHAR(20) NOT NULL,
    "legal_name" VARCHAR(160) NOT NULL,
    "trade_name" VARCHAR(160),
    "business_number" VARCHAR(30),
    "fiscal_number" VARCHAR(30),
    "vat_number" VARCHAR(30),
    "billing_address" VARCHAR(255),
    "city" VARCHAR(80),
    "email" VARCHAR(120),
    "phone" VARCHAR(30),
    "payment_terms" VARCHAR(160),
    "prodata_code" VARCHAR(40),
    "is_customer" BOOLEAN NOT NULL DEFAULT true,
    "is_supplier" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(80),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "access_notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" SERIAL NOT NULL,
    "quote_number" VARCHAR(20) NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "site_id" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "label" VARCHAR(80),
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" DATE,
    "payment_terms" VARCHAR(160),
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_revisions" (
    "id" SERIAL NOT NULL,
    "quote_id" INTEGER NOT NULL,
    "revision_major" INTEGER NOT NULL DEFAULT 1,
    "revision_minor" INTEGER NOT NULL DEFAULT 0,
    "kind" "RevisionKind" NOT NULL DEFAULT 'NORMAL',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "overall_markup_pct" DECIMAL(9,4),
    "vat_total" DECIMAL(14,2) NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_note" TEXT,
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" INTEGER,
    "client_order_ref" VARCHAR(80),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" SERIAL NOT NULL,
    "revision_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "section" VARCHAR(60),
    "kind" "QuoteLineKind" NOT NULL,
    "item_id" INTEGER,
    "sku" VARCHAR(60),
    "description" VARCHAR(255) NOT NULL,
    "unit_code" VARCHAR(10) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "markup_pct" DECIMAL(9,4),
    "unit_price" DECIMAL(12,4) NOT NULL,
    "line_cost" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "vat_code" VARCHAR(20) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_doc_type_year_key" ON "document_sequences"("doc_type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "partners_partner_number_key" ON "partners"("partner_number");

-- CreateIndex
CREATE UNIQUE INDEX "partners_prodata_code_key" ON "partners"("prodata_code");

-- CreateIndex
CREATE INDEX "partners_is_customer_is_active_idx" ON "partners"("is_customer", "is_active");

-- CreateIndex
CREATE INDEX "sites_partner_id_idx" ON "sites"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quote_number_key" ON "quotes"("quote_number");

-- CreateIndex
CREATE INDEX "quotes_partner_id_idx" ON "quotes"("partner_id");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_created_by_id_idx" ON "quotes"("created_by_id");

-- CreateIndex
CREATE INDEX "quotes_created_at_idx" ON "quotes"("created_at");

-- CreateIndex
CREATE INDEX "quote_revisions_quote_id_is_current_idx" ON "quote_revisions"("quote_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "quote_revisions_quote_id_revision_major_revision_minor_key" ON "quote_revisions"("quote_id", "revision_major", "revision_minor");

-- CreateIndex
CREATE INDEX "quote_lines_revision_id_sort_order_idx" ON "quote_lines"("revision_id", "sort_order");

-- CreateIndex
CREATE INDEX "quote_lines_item_id_idx" ON "quote_lines"("item_id");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "quote_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
