/*
  Warnings:

  - You are about to drop the column `assetStatus` on the `AssetInformation` table. All the data in the column will be lost.
  - Added the required column `repairStatus` to the `AssetInformation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- rename_asset_status_to_repair_status.sql
ALTER TABLE "AssetInformation" RENAME COLUMN "assetStatus" TO "repairStatus";
