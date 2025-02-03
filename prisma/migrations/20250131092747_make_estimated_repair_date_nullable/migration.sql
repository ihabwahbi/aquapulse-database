-- DropIndex
DROP INDEX "AssetRepairSummary_assetCodeLevel4_assetSerialNumber_key";

-- AlterTable
ALTER TABLE "AssetRepairSummary" ALTER COLUMN "geoUnit" DROP NOT NULL,
ALTER COLUMN "locationCode" DROP NOT NULL,
ALTER COLUMN "assetStatus" DROP NOT NULL,
ALTER COLUMN "assetCodeLevel4" DROP NOT NULL,
ALTER COLUMN "assetSerialNumber" DROP NOT NULL,
ALTER COLUMN "daysDown" DROP NOT NULL,
ALTER COLUMN "repairResponsibility" DROP NOT NULL,
ALTER COLUMN "ranStatus" DROP NOT NULL,
ALTER COLUMN "partsDeclared" DROP NOT NULL,
ALTER COLUMN "reservationStatus" DROP NOT NULL,
ALTER COLUMN "supplyStatus" DROP NOT NULL,
ALTER COLUMN "gbv" DROP NOT NULL,
ALTER COLUMN "estimatedRepairDate" DROP NOT NULL;
