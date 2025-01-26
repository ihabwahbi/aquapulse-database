// src/import-assets.ts
import { PrismaClient } from '@prisma/client'
import { parse, Options } from 'csv-parse'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'

const prisma = new PrismaClient()

// Default paths
const DEFAULT_CSV_PATH = path.join(process.cwd(), 'data', 'extracts', 'asset_extract.csv')

// Updated CSV row validation schema
const RowSchema = z.object({
  RPF_TOOL_GROUP: z.string().default(''),
  RPF_SUB_TOOL_GROUP: z.string().default(''),
  RPF_SUB_SUB_TOOL_GROUP: z.string().default(''),
  Assettype: z.string(),
  TDA2RASSET_SerialNum: z.string(),
  SLB_GEOUNIT: z.string(),
  SLB_COUNTRY: z.string(),
  SLB_DISTRICT: z.string(),
  LOCATION: z.string(),
  REPAIR_STATUS: z.string()
})

async function importAssets(filePath: string = DEFAULT_CSV_PATH) {
  const records: any[] = []
  const errors: any[] = []
  let processed = 0
  let successful = 0

  console.log(`Starting import process from: ${filePath}`)

  // Create parser with correct types
  const parserOptions: Options = {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(parse(parserOptions))
      .on('data', (row) => {
        try {
          // Ensure empty strings for null/undefined values
          Object.keys(row).forEach(key => {
            row[key] = row[key] ?? ''
          })

          // Validate row data
          const validRow = RowSchema.parse(row)
          
          // Transform to database schema
          const assetData = {
            assetCodeLevel1: validRow.RPF_TOOL_GROUP,
            assetCodeLevel2: validRow.RPF_SUB_TOOL_GROUP,
            assetCodeLevel3: validRow.RPF_SUB_SUB_TOOL_GROUP,
            assetCodeLevel4: validRow.Assettype,
            assetSerialNumber: validRow.TDA2RASSET_SerialNum,
            geoUnit: validRow.SLB_GEOUNIT,
            countryCode: validRow.SLB_COUNTRY,
            locationCode: validRow.SLB_DISTRICT,
            assetStatus: validRow.REPAIR_STATUS
          }

          records.push(assetData)
        } catch (error) {
          errors.push({
            row: processed + 2, // +2 for header row and 0-based index
            error: error instanceof Error ? error.message : 'Unknown error',
            data: row
          })
        }
        processed++

        // Log progress every 1000 records
        if (processed % 1000 === 0) {
          console.log(`Processed ${processed} records...`)
        }
      })
      .on('end', async () => {
        console.log(`\nProcessed ${processed} rows from CSV`)
        console.log(`Found ${records.length} valid records`)
        console.log(`Found ${errors.length} invalid records`)

        // Process valid records in batches
        const batchSize = 100
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize)
          try {
            await Promise.all(
              batch.map(async (record) => {
                await prisma.assetInformation.upsert({
                  where: {
                    assetCodeLevel4_assetSerialNumber: {
                      assetCodeLevel4: record.assetCodeLevel4,
                      assetSerialNumber: record.assetSerialNumber
                    }
                  },
                  update: record,
                  create: record
                })
                successful++
              })
            )
            console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`)
          } catch (error) {
            console.error(`Error processing batch starting at record ${i}:`, error)
            errors.push({
              row: `Batch starting at ${i}`,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: batch
            })
          }
        }

        // Print summary
        console.log('\nImport Summary:')
        console.log(`Total records processed: ${processed}`)
        console.log(`Successfully imported: ${successful}`)
        console.log(`Failed validation: ${errors.length}`)

        // Log errors if any
        if (errors.length > 0) {
          const errorLogPath = path.join(process.cwd(), 'data', 'extracts', 'import_errors.json')
          fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2))
          console.log(`\nErrors have been logged to: ${errorLogPath}`)
          console.log('\nFirst few errors:')
          errors.slice(0, 5).forEach(({ row, error, data }) => {
            console.log(`Row ${row}:`)
            console.log(`  Error: ${error}`)
            console.log(`  Data: ${JSON.stringify(data)}\n`)
          })
        }

        await prisma.$disconnect()
        resolve('Import completed')
      })
      .on('error', async (error) => {
        console.error('Error reading CSV:', error)
        await prisma.$disconnect()
        reject(error)
      })
  })
}

// Run the import if called directly
if (require.main === module) {
  const filePath = process.argv[2] || DEFAULT_CSV_PATH

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    console.error(`Please ensure the CSV file exists at: ${DEFAULT_CSV_PATH}`)
    console.error('Or provide a custom path: npm run import -- path/to/your/file.csv')
    process.exit(1)
  }

  importAssets(filePath)
    .catch((error) => {
      console.error('Import failed:', error)
      process.exit(1)
    })
}