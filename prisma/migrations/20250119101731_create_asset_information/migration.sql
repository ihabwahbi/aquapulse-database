-- CreateTable
CREATE TABLE "AssetInformation" (
    "id" SERIAL NOT NULL,
    "assetCodeLevel1" TEXT NOT NULL,
    "assetCodeLevel2" TEXT NOT NULL,
    "assetCodeLevel3" TEXT NOT NULL,
    "assetCodeLevel4" TEXT NOT NULL,
    "assetSerialNumber" TEXT NOT NULL,
    "geoUnit" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "assetStatus" TEXT NOT NULL,

    CONSTRAINT "AssetInformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetInformation_assetCodeLevel4_assetSerialNumber_key" ON "AssetInformation"("assetCodeLevel4", "assetSerialNumber");
