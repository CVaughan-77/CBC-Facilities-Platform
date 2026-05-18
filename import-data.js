#!/usr/bin/env node

/**
 * CBC Facilities Data Import Script
 * Loads locations, vendors, and work orders into Supabase
 * 
 * Usage: node import-data.js
 * 
 * Prerequisites:
 * - .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * - Database tables created (see setup guide)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importLocations(data) {
  console.log('📍 Importing locations...');
  
  const locations = data.locations || [];
  const locationMap = {};

  for (const loc of locations) {
    const locationId = uuidv4();
    locationMap[loc.name] = locationId;

    const { error } = await supabase
      .from('locations')
      .insert([
        {
          id: locationId,
          name: loc.name,
          address: loc.address || '',
          city: loc.city || '',
          state: loc.state || '',
          zip: loc.zip || '',
          region: loc.region || 'Unknown',
          phone: loc.phone || '',
          active: true
        }
      ]);

    if (error) {
      console.error(`  ❌ Error importing location ${loc.name}:`, error.message);
    }
  }

  console.log(`  ✅ Imported ${Object.keys(locationMap).length} locations`);
  return locationMap;
}

async function importVendors(data) {
  console.log('🏢 Importing vendors...');
  
  const vendors = data.vendors || [];
  const vendorMap = {};

  for (const vendor of vendors) {
    const vendorId = uuidv4();
    vendorMap[vendor.name] = vendorId;

    const { error } = await supabase
      .from('vendors')
      .insert([
        {
          id: vendorId,
          name: vendor.name,
          contact_person: vendor.contact_person || '',
          email: vendor.email || '',
          phone: vendor.phone || '',
          service_types: vendor.service_types || [],
          rate_per_hour: vendor.rate_per_hour || 0,
          active: true,
          rating: 4.0
        }
      ]);

    if (error) {
      console.error(`  ❌ Error importing vendor ${vendor.name}:`, error.message);
    }
  }

  console.log(`  ✅ Imported ${Object.keys(vendorMap).length} vendors`);
  return vendorMap;
}

async function importWorkOrders(data, locationMap, vendorMap) {
  console.log('📋 Importing work orders...');
  
  const workOrders = data.workorders || {};
  let imported = 0;
  let errors = 0;

  // Get default user for created_by field
  const { data: adminUsers } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  const defaultUserId = adminUsers?.[0]?.id || uuidv4();

  const woArray = Array.isArray(workOrders) ? workOrders : Object.values(workOrders);

  for (const wo of woArray.slice(0, 1000)) { // Import first 1000 for demo
    const locationId = locationMap[wo.location] || Object.values(locationMap)[0];
    const vendorId = wo.vendor ? vendorMap[wo.vendor] : null;

    const { error } = await supabase
      .from('work_orders')
      .insert([
        {
          id: uuidv4(),
          wo_number: `WO-${wo.id || uuidv4()}`,
          location_id: locationId,
          equipment: wo.equipment || '',
          equipment_type: wo.category || wo.type || '',
          description: wo.description || '',
          priority: wo.priority || 'L4-Standard',
          status: wo.status || 'Open',
          vendor_id: vendorId,
          created_by: defaultUserId,
          estimated_cost: wo.estCost || 0,
          invoice_amount: wo.invoiceAmount || 0,
          created_at: wo.created || new Date().toISOString()
        }
      ]);

    if (error) {
      errors++;
      if (errors < 5) {
        console.error(`  ⚠️  Error importing WO: ${error.message}`);
      }
    } else {
      imported++;
    }

    if ((imported + errors) % 100 === 0) {
      console.log(`  ⏳ Processed ${imported + errors} work orders...`);
    }
  }

  console.log(`  ✅ Imported ${imported} work orders (${errors} errors)`);
}

async function main() {
  try {
    console.log('🚀 CBC Facilities Data Import\n');

    // Load sample data
    const data = {
      locations: [
        { name: 'Buckhead', city: 'Atlanta', state: 'GA', region: 'Northeast', address: '123 Main St' },
        { name: 'Downtown', city: 'Austin', state: 'TX', region: 'Texas', address: '456 Oak Ave' },
        { name: 'Marina', city: 'San Francisco', state: 'CA', region: 'California', address: '789 Bay St' },
        // Add more locations as needed
      ],
      vendors: [
        { name: 'Smart Facility Solutions', email: 'contact@smart.com', phone: '555-0001' },
        { name: 'Precision Air', email: 'info@precision.com', phone: '555-0002' },
        { name: 'Trushine Cleaning', email: 'clean@trushine.com', phone: '555-0003' },
        // Add more vendors as needed
      ],
      workorders: [] // Will be loaded from file if available
    };

    // Try to load from JSON file if available
    try {
      const dataFile = path.join(__dirname, 'all_workorders.json');
      if (fs.existsSync(dataFile)) {
        const fileData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        data.workorders = fileData;
        console.log('📂 Loaded work orders from file\n');
      }
    } catch (err) {
      console.log('ℹ️  No work orders file found - importing demo data only\n');
    }

    // Import data
    const locationMap = await importLocations(data);
    const vendorMap = await importVendors(data);
    
    if (Object.keys(data.workorders).length > 0) {
      await importWorkOrders(data, locationMap, vendorMap);
    }

    console.log('\n✅ Data import completed!');
    console.log('\nNext steps:');
    console.log('1. Create admin user: npm run create-admin');
    console.log('2. Start backend: npm start');
    console.log('3. Start frontend: cd frontend && npm start');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

main();
