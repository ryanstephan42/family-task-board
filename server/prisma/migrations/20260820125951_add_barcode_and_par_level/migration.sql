-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN "barcode" TEXT;
ALTER TABLE "FoodItem" ADD COLUMN "parLevel" REAL;

-- CreateTable
CREATE TABLE "BarcodeProductPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeProductPreference_barcode_key" ON "BarcodeProductPreference"("barcode");
