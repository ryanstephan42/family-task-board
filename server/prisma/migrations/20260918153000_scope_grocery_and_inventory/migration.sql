ALTER TABLE "GroceryItem" ADD COLUMN "householdId" TEXT;
ALTER TABLE "FoodItem" ADD COLUMN "householdId" TEXT;

CREATE INDEX "GroceryItem_householdId_idx" ON "GroceryItem"("householdId");
CREATE INDEX "FoodItem_householdId_idx" ON "FoodItem"("householdId");
