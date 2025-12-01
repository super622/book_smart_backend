/**
 * Script to populate test databases with initial test data
 * 
 * This script creates:
 * - 1 test admin account
 * - 2 test facility accounts
 * - 2 test clinician accounts (1 RN, 1 LPN)
 * 
 * Run with: node scripts/populateTestDatabases.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

const connectDB = async () => {
  try {
    await db.mongoose.connect(db.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to the database!');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const populateTestDatabases = async () => {
  try {
    await connectDB();

    // Get the highest AIC numbers to create unique ones
    const lastClinician = await db.clinical.findOne().sort({ aic: -1 });
    const lastFacility = await db.facilities.findOne().sort({ aic: -1 });
    const lastAdmin = await db.admins.findOne().sort({ AId: -1 });
    
    const nextClinicianAIC = lastClinician ? lastClinician.aic + 1 : 10000;
    const nextFacilityAIC = lastFacility ? lastFacility.aic + 1 : 20000;
    const nextAdminAIC = lastAdmin ? lastAdmin.AId + 1 : 1000;

    // Check if test accounts already exist
    const existingTestAdmin = await db.test_admins.findOne({ email: 'test.admin@booksmart.test' });
    const existingTestClinician = await db.test_clinical.findOne({ email: 'test.rn@booksmart.test' });
    const existingTestFacility = await db.test_facilities.findOne({ contactEmail: 'test.facility1@booksmart.test' });

    if (existingTestAdmin || existingTestClinician || existingTestFacility) {
      console.log('⚠️  Test accounts already exist!');
      console.log('To recreate them, delete existing test accounts first.');
      console.log('Test admin email: test.admin@booksmart.test');
      console.log('Test clinician email: test.rn@booksmart.test');
      console.log('Test facility email: test.facility1@booksmart.test');
      process.exit(0);
    }

    // Create test admin
    console.log('Creating test admin...');
    try {
      const testAdmin = await db.test_admins.create({
        AId: nextAdminAIC,
        firstName: 'Test',
        lastName: 'Admin',
        email: 'test.admin@booksmart.test',
        phone: '555-0001',
        password: 'test123',
        userRole: 'Admin',
        userStatus: 'activate',
        companyName: 'Test Admin Company'
      });
      console.log(`✅ Created test admin: ${testAdmin.firstName} ${testAdmin.lastName} (${testAdmin.email}) - AId: ${testAdmin.AId}`);
    } catch (error) {
      console.error(`❌ Error creating test admin:`, error.message);
    }

    // Create test clinicians
    console.log('\nCreating test clinicians...');
    const testClinicians = [
      {
        aic: nextClinicianAIC,
        firstName: 'Test',
        lastName: 'RN',
        email: 'test.rn@booksmart.test',
        phoneNumber: '555-0101',
        userRole: 'RN',
        title: 'Registered Nurse',
        password: 'test123',
        userStatus: 'activate',
        clinicalAcknowledgeTerm: false,
        clinicalTermsVersion: '',
        clinicalTermsSignedDate: null
      },
      {
        aic: nextClinicianAIC + 1,
        firstName: 'Test',
        lastName: 'LPN',
        email: 'test.lpn@booksmart.test',
        phoneNumber: '555-0102',
        userRole: 'LPN',
        title: 'Licensed Practical Nurse',
        password: 'test123',
        userStatus: 'activate',
        clinicalAcknowledgeTerm: false,
        clinicalTermsVersion: '',
        clinicalTermsSignedDate: null
      }
    ];

    for (const clinician of testClinicians) {
      try {
        const created = await db.test_clinical.create(clinician);
        console.log(`✅ Created clinician: ${created.firstName} ${created.lastName} (${created.email}) - AIC: ${created.aic}`);
      } catch (error) {
        console.error(`❌ Error creating clinician ${clinician.email}:`, error.message);
      }
    }

    // Create test facilities
    console.log('\nCreating test facilities...');
    const testFacilities = [
      {
        aic: nextFacilityAIC,
        firstName: 'Test',
        lastName: 'Facility Manager 1',
        companyName: 'Test Healthcare Facility 1',
        contactEmail: 'test.facility1@booksmart.test',
        contactPhone: '555-0201',
        password: 'test123',
        userRole: 'Facility',
        userStatus: 'activate',
        facilityAcknowledgeTerm: false,
        facilityTermsVersion: '',
        facilityTermsSignedDate: null
      },
      {
        aic: nextFacilityAIC + 1,
        firstName: 'Test',
        lastName: 'Facility Manager 2',
        companyName: 'Test Healthcare Facility 2',
        contactEmail: 'test.facility2@booksmart.test',
        contactPhone: '555-0202',
        password: 'test123',
        userRole: 'Facility',
        userStatus: 'activate',
        facilityAcknowledgeTerm: false,
        facilityTermsVersion: '',
        facilityTermsSignedDate: null
      }
    ];

    for (const facility of testFacilities) {
      try {
        const created = await db.test_facilities.create(facility);
        console.log(`✅ Created facility: ${created.companyName} (${created.contactEmail}) - AIC: ${created.aic}`);
      } catch (error) {
        console.error(`❌ Error creating facility ${facility.contactEmail}:`, error.message);
      }
    }

    console.log('\n✅ Test databases populated successfully!');
    console.log('\n📋 Test Account Credentials:');
    console.log('\nAdmin:');
    console.log('  Email: test.admin@booksmart.test');
    console.log('  Password: test123');
    console.log('\nClinicians:');
    console.log('  RN: test.rn@booksmart.test / test123');
    console.log('  LPN: test.lpn@booksmart.test / test123');
    console.log('\nFacilities:');
    console.log('  Facility 1: test.facility1@booksmart.test / test123');
    console.log('  Facility 2: test.facility2@booksmart.test / test123');
    console.log('\n⚠️  These accounts use separate test databases and will NOT affect production data.');
    console.log('⚠️  Test notifications will only be sent to test users.');

    process.exit(0);
  } catch (error) {
    console.error('Error populating test databases:', error);
    process.exit(1);
  }
};

populateTestDatabases();

