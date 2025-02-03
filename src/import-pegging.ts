import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const DEFAULT_XLSX_PATH = path.join(process.cwd(), 'data', 'extracts', 'pegging_report.xlsx');

// Helper functions for data preprocessing
function splitReservationLine(value: string): { reservation: string; line: string } {
  if (!value) return { reservation: '', line: '' };
  
  const parts = value.split('-');
  if (parts.length < 2) return { reservation: value, line: '' };
  
  return {
    reservation: parts[0],
    line: parts[1]
  };
}

function extractAssetCode(value: string): string {
  if (!value) return '';
  
  const parts = value.split('|');
  return parts[0].trim();
}

// More permissive schema that accepts any value and converts it to the right type
const PeggingReportRowSchema = z.object({
  'Plant': z.any().transform(val => String(val || '')),
  'Geo-Unit': z.any().transform(val => String(val || '')),
  'Material': z.any().transform(val => String(val || '')),
  'Reservation -Line': z.any().transform(val => String(val || '')),
  'Requirements Date': z.any(),
  'Creation Date': z.any(),
  'Stock On Hand - DDSC': z.any(),
  'Stock On Hand - HDSC': z.any(),
  'Last 3 Month Consumption': z.any(),
  'Last 6 Month Consumption': z.any(),
  'Last 12 Month Consumption': z.any(),
  'Material Stratification (Last 6 Month Consumption)': z.any().transform(val => String(val || '')),
  'Material Stratification (Last 12 Month Consumption)': z.any().transform(val => String(val || '')),
  'Open Qty - Reservation': z.any(),
  'Open Reservation Value': z.any(),
  'Material/Plant-SOH - Total': z.any(),
  'Primary Pegged PO-LN - Open Qty': z.any(),
  'Combined SOH & PO Pegging': z.any().transform(val => String(val || '')),
  'Main - PO to Peg to Reservation': z.any().transform(val => String(val || '')),
  'Additional PO - Line to Peg': z.any().transform(val => String(val || '')),
  'Primary Pegged PO-LN - Order Qty': z.any(),
  'Pegged Main PO Invoice Status': z.any().transform(val => String(val || '')),
  'Material Description': z.any().transform(val => String(val || '')),
  'MRP Parameters - Prime Status': z.any().transform(val => String(val || '')),
  'MRP Parameters - Safety Stock': z.any(),
  'Planned Order - Status': z.any().transform(val => String(val || '')),
  'Maximo Asset Num': z.any().transform(val => String(val || '')),
  'Maximo Serial No': z.any().transform(val => String(val || '')),
  'Goods recipient': z.any().transform(val => String(val || ''))
}).passthrough(); // Allow extra fields

function parseExcelDate(excelDate: any): Date | null {
  if (!excelDate) return null;
  
  // If it's already a Date object, return it.
  if (excelDate instanceof Date) {
    return excelDate;
  }
  
  // If it's a number (Excel serial date), convert it.
  if (typeof excelDate === 'number') {
    return new Date((excelDate - 25569) * 86400000);
  }
  
  if (typeof excelDate === 'string') {
    const parsedDate = new Date(excelDate);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  
  return null;
}

function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

async function importPeggingReport(filePath: string = DEFAULT_XLSX_PATH) {
  const records: any[] = [];
  const errors: any[] = [];
  let processed = 0;
  let successful = 0;

  try {
    console.log(`Starting import process from: ${filePath}`);

    // Clear all existing data from the PeggingReport table to avoid duplicates.
    await prisma.peggingReport.deleteMany({});
    console.log('Database cleared successfully');

    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(filePath, {
      // Remove cellDates:true so that numeric cells (even if formatted as dates) remain as numbers.
      cellDates: false,
      dateNF: 'yyyy-mm-dd',
      raw: true
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    type RawDataRow = {
      [key: string]: any;
    };
    
    const rawData = XLSX.utils.sheet_to_json<RawDataRow>(worksheet);

    // Log the first row to see the structure
    if (rawData.length > 0) {
      console.log('\nFirst row column names:', Object.keys(rawData[0]));
      console.log('\nFirst row data:', rawData[0]);
    }

    for (const row of rawData) {
      try {
        processed++;
        
        // Log raw data for debugging (first 2 rows)
        if (processed <= 2) {
          console.log(`\nProcessing row ${processed}:`);
          console.log('Raw data:', row);
        }

        const validRow = PeggingReportRowSchema.parse(row);
        
        if (processed <= 2) {
          console.log('Validated row:', validRow);
        }

        // Process reservation line
        const reservationInfo = splitReservationLine(validRow['Reservation -Line']);
        
        // Process asset code
        const assetCode = extractAssetCode(validRow['Maximo Asset Num']);

        const peggingData = {
          plant: validRow['Plant'],
          geoUnit: validRow['Geo-Unit'],
          material: validRow['Material'],
          reservation: reservationInfo.reservation,
          reservationLine: reservationInfo.line,
          reservationRequirementDate: parseExcelDate(validRow['Requirements Date']),
          reservationCreationDate: parseExcelDate(validRow['Creation Date']),
          stockOnHandDDSC: parseNumericValue(validRow['Stock On Hand - DDSC']),
          stockOnHandHDSC: parseNumericValue(validRow['Stock On Hand - HDSC']),
          last3MonthConsumption: parseNumericValue(validRow['Last 3 Month Consumption']),
          last6MonthConsumption: parseNumericValue(validRow['Last 6 Month Consumption']),
          last12MonthConsumption: parseNumericValue(validRow['Last 12 Month Consumption']),
          materialStratification6Month: validRow['Material Stratification (Last 6 Month Consumption)'],
          materialStratification12Month: validRow['Material Stratification (Last 12 Month Consumption)'],
          reservationOpenQty: parseNumericValue(validRow['Open Qty - Reservation']),
          reservationOpenValue: parseNumericValue(validRow['Open Reservation Value']),
          stockOnHandPlant: parseNumericValue(validRow['Material/Plant-SOH - Total']),
          peggedPOLine: parseNumericValue(validRow['Primary Pegged PO-LN - Open Qty']),
          peggingStatus: validRow['Combined SOH & PO Pegging'],
          peggedPONumber: validRow['Main - PO to Peg to Reservation'],
          peggedPONumberAdditional: validRow['Additional PO - Line to Peg'],
          peggedPOQty: parseNumericValue(validRow['Primary Pegged PO-LN - Order Qty']),
          peggedPOInvoiceStatus: validRow['Pegged Main PO Invoice Status'],
          materialDescription: validRow['Material Description'],
          materialPrimeStatus: validRow['MRP Parameters - Prime Status'],
          materialSafetyStock: parseNumericValue(validRow['MRP Parameters - Safety Stock']),
          plannedOrderStatus: validRow['Planned Order - Status'],
          assetCodeLevel4: assetCode,
          assetSerialNumber: validRow['Maximo Serial No'],
          requester: validRow['Goods recipient']
        };

        if (processed <= 2) {
          console.log('Processed data:', peggingData);
        }

        records.push(peggingData);

        if (processed % 1000 === 0) {
          console.log(`Processed ${processed} records...`);
        }
      } catch (error) {
        console.error(`\nError processing row ${processed}:`);
        if (error instanceof z.ZodError) {
          console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        } else {
          console.error('Error:', error);
        }
        errors.push({
          row: processed,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: row
        });
      }
    }

    // Insert records into the database in batches.
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await prisma.$transaction(async (tx) => {
          for (const record of batch) {
            await tx.peggingReport.create({ data: record });
            successful++;
          }
        });
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      } catch (error) {
        console.error(`\nError processing batch starting at record ${i}:`, error);
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
      const errorLogPath = path.join(process.cwd(), 'data', 'extracts', 'import_pegging_errors.json');
      fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(`\nErrors have been logged to: ${errorLogPath}`);
      
      // Log the first few errors in detail
      console.log('\nFirst few error details:');
      errors.slice(0, 3).forEach((error, index) => {
        console.log(`\nError ${index + 1}:`);
        console.log(JSON.stringify(error, null, 2));
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importPeggingReport().catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
}
