/*
  Warnings:

  - Changed the type of `estimatedRepairDate` on the `AssetRepairSummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "AssetRepairSummary" DROP COLUMN "estimatedRepairDate",
ADD COLUMN     "estimatedRepairDate" TIMESTAMP(3) NOT NULL;
