-- CreateTable
CREATE TABLE "ItemUnitPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FoodItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "location" TEXT NOT NULL DEFAULT 'Pantry',
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackExpiration" BOOLEAN NOT NULL DEFAULT true,
    "expirationDate" DATETIME,
    "notes" TEXT,
    "lowStock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FoodItem" ("category", "createdAt", "expirationDate", "id", "location", "lowStock", "name", "notes", "purchaseDate", "quantity", "unit", "updatedAt") SELECT "category", "createdAt", "expirationDate", "id", "location", "lowStock", "name", "notes", "purchaseDate", "quantity", "unit", "updatedAt" FROM "FoodItem";
DROP TABLE "FoodItem";
ALTER TABLE "new_FoodItem" RENAME TO "FoodItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnitPreference_itemName_key" ON "ItemUnitPreference"("itemName");
