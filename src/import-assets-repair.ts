import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const DEFAULT_XLSX_PATH = path.join(process.cwd(), 'data', 'extracts', 'asset_repair_summary.xlsx');

const AssetRepairRowSchema = z.object({
  Geounit: z.string().optional().default(''),
  'Physical Location': z.string().optional().default(''),
  'Asset Status': z.string().optional().default(''),
  'Asset Type': z.string().optional().default(''),
  Assetnum: z.string().optional().default(''),
  'Days Down': z.string().optional().default(''),
  'Repair Responsability': z.string().optional().default(''),
  'RAN Status': z.string().optional().default(''),
  'Parts Declared': z.string().optional().default(''),
  'Reservation Status': z.string().optional().default(''),
  'Supply Status': z.string().optional().default(''),
  'GBV': z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : '0'),
  'Estimate Repair Date': z.any().optional().default(null) // Corrected column name
});

type AssetRepairRow = z.infer<typeof AssetRepairRowSchema>;

function parseExcelDate(excelDate: any): Date | null {
    if (!excelDate) return null;
  
    // If the date is already a Date object, return it directly
    if (excelDate instanceof Date) {
      return excelDate;
    }
  
    // If it's a number, convert it from Excel serial format
    if (typeof excelDate === 'number') {
      return new Date((excelDate - 25569) * 86400000);
    }
  
    // If it's a string, try to parse it
    if (typeof excelDate === 'string') {
      const parsedDate = new Date(excelDate);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
  
    return null;
  }

async function importAssetRepair(filePath: string = DEFAULT_XLSX_PATH) {
  const records: any[] = [];
  const errors: any[] = [];
  let processed = 0;
  let successful = 0;

  try {
    console.log(`Starting import process from: ${filePath}`);
    await prisma.assetRepairSummary.deleteMany({});
    console.log('Database cleared successfully');

    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
      dateNF: 'yyyy-mm-dd',
      raw: true
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json<AssetRepairRow>(worksheet);

    console.log("\n=== Column Names in Excel ===");
    if (rawData.length > 0) {
      console.log(Object.keys(rawData[0])); // Logs column names to verify the correct name
    }

    console.log("\n=== Sample Raw Data ===");
    rawData.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i + 1}:`, {
        'Estimate Repair Date Raw': row['Estimate Repair Date'],
        'Type': typeof row['Estimate Repair Date']
      });
    });

    for (const row of rawData) {
      try {
        processed++;

        if (processed <= 2) {
          console.log(`\n=== Processing Row ${processed} ===`);
          console.log('Raw Estimate Repair Date:', row['Estimate Repair Date'], typeof row['Estimate Repair Date']);
        }

        const validRow = AssetRepairRowSchema.parse(row);
        const finalRepairDate = parseExcelDate(validRow['Estimate Repair Date']);

        if (processed <= 2) {
          console.log('Parsed Estimate Repair Date:', finalRepairDate);
        }

        const repairData: any = {
          geoUnit: validRow.Geounit,
          locationCode: validRow['Physical Location'],
          assetStatus: validRow['Asset Status'],
          assetCodeLevel4: validRow.Assetnum.split('|')[0]?.trim(),
          assetSerialNumber: validRow.Assetnum.split('|')[1]?.trim(),
          daysDown: validRow['Days Down'],
          repairResponsibility: validRow['Repair Responsability'],
          ranStatus: validRow['RAN Status'],
          partsDeclared: validRow['Parts Declared'],
          reservationStatus: validRow['Reservation Status'],
          supplyStatus: validRow['Supply Status'],
          gbv: validRow['GBV']
        };

        if (finalRepairDate) {
          repairData.estimatedRepairDate = finalRepairDate;
        }

        records.push(repairData);

        if (processed % 1000 === 0) {
          console.log(`Processed ${processed} records...`);
        }
      } catch (error) {
        console.error(`Error processing row ${processed}:`, error);
        errors.push({
          row: processed,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: row
        });
      }
    }

    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await prisma.$transaction(async (tx) => {
          for (const record of batch) {
            await tx.assetRepairSummary.create({ data: record });
            successful++;
          }
        });
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      } catch (error) {
        console.error(`Error processing batch starting at record ${i}:`, error);
        errors.push({
          row: `Batch starting at ${i}`,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: batch
        });
      }
    }

    console.log('\nImport Summary:');
    console.log(`Total records processed: ${processed}`);
    console.log(`Successfully imported: ${successful}`);
    console.log(`Failed validation: ${errors.length}`);

    if (errors.length > 0) {
      const errorLogPath = path.join(process.cwd(), 'data', 'extracts', 'import_repair_errors.json');
      fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(`\nErrors have been logged to: ${errorLogPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importAssetRepair().catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
}
