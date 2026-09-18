ALTER TABLE "Task" ADD COLUMN "householdId" TEXT;
ALTER TABLE "Event" ADD COLUMN "householdId" TEXT;

CREATE INDEX "Task_householdId_idx" ON "Task"("householdId");
CREATE INDEX "Event_householdId_idx" ON "Event"("householdId");
