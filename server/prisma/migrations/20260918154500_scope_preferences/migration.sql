ALTER TABLE "ItemCategoryPreference" ADD COLUMN "householdId" TEXT;
ALTER TABLE "ItemUnitPreference" ADD COLUMN "householdId" TEXT;
ALTER TABLE "BarcodeProductPreference" ADD COLUMN "householdId" TEXT;
ALTER TABLE "MealieIngredientLink" ADD COLUMN "householdId" TEXT;

UPDATE "ItemCategoryPreference"
SET "householdId" = (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "householdId" IS NULL;
UPDATE "ItemUnitPreference"
SET "householdId" = (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "householdId" IS NULL;
UPDATE "BarcodeProductPreference"
SET "householdId" = (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "householdId" IS NULL;
UPDATE "MealieIngredientLink"
SET "householdId" = (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "householdId" IS NULL;

DROP INDEX IF EXISTS "ItemCategoryPreference_itemName_key";
DROP INDEX IF EXISTS "ItemUnitPreference_itemName_key";
DROP INDEX IF EXISTS "BarcodeProductPreference_barcode_key";
DROP INDEX IF EXISTS "MealieIngredientLink_recipeSlug_ingredientName_key";

CREATE INDEX "ItemCategoryPreference_householdId_idx" ON "ItemCategoryPreference"("householdId");
CREATE INDEX "ItemUnitPreference_householdId_idx" ON "ItemUnitPreference"("householdId");
CREATE INDEX "BarcodeProductPreference_householdId_idx" ON "BarcodeProductPreference"("householdId");
CREATE INDEX "MealieIngredientLink_householdId_idx" ON "MealieIngredientLink"("householdId");
CREATE UNIQUE INDEX "ItemCategoryPreference_householdId_itemName_key" ON "ItemCategoryPreference"("householdId", "itemName");
CREATE UNIQUE INDEX "ItemUnitPreference_householdId_itemName_key" ON "ItemUnitPreference"("householdId", "itemName");
CREATE UNIQUE INDEX "BarcodeProductPreference_householdId_barcode_key" ON "BarcodeProductPreference"("householdId", "barcode");
CREATE UNIQUE INDEX "MealieIngredientLink_householdId_recipeSlug_ingredientName_key" ON "MealieIngredientLink"("householdId", "recipeSlug", "ingredientName");
