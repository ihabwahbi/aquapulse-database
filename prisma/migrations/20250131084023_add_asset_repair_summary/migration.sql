-- CreateTable
CREATE TABLE "AssetRepairSummary" (
    "id" SERIAL NOT NULL,
    "geoUnit" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "assetStatus" TEXT NOT NULL,
    "assetCodeLevel4" TEXT NOT NULL,
    "assetSerialNumber" TEXT NOT NULL,
    "daysDown" TEXT NOT NULL,
    "repairResponsibility" TEXT NOT NULL,
    "ranStatus" TEXT NOT NULL,
    "partsDeclared" TEXT NOT NULL,
    "reservationStatus" TEXT NOT NULL,
    "supplyStatus" TEXT NOT NULL,
    "gbv" TEXT NOT NULL,
    "estimatedRepairDate" TEXT NOT NULL,

    CONSTRAINT "AssetRepairSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetRepairSummary_assetCodeLevel4_assetSerialNumber_key" ON "AssetRepairSummary"("assetCodeLevel4", "assetSerialNumber");
