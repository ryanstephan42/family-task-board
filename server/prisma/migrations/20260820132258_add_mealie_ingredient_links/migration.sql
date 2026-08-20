-- CreateTable
CREATE TABLE "MealieIngredientLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeSlug" TEXT NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "inventoryItemName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MealieIngredientLink_recipeSlug_ingredientName_key" ON "MealieIngredientLink"("recipeSlug", "ingredientName");
