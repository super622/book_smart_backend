/**
 * Test Mode Utility
 * 
 * This utility detects if a user is a test user and provides the appropriate
 * database context. Test users are stored in separate collections:
 * - test_clinicals
 * - test_facilities  
 * - test_admins
 * - test_terms
 */

const db = require('../models');

/**
 * Check if an email exists in test database
 * @param {string} email - User email
 * @param {string} type - 'clinical', 'facility', or 'admin'
 * @returns {Promise<boolean>} - True if user exists in test database
 */
async function isTestUser(email, type) {
  try {
    email = email.toLowerCase();
    
    if (type === 'clinical') {
      const testUser = await db.test_clinical.findOne({ email });
      return !!testUser;
    } else if (type === 'facility') {
      const testUser = await db.test_facilities.findOne({ contactEmail: email });
      return !!testUser;
    } else if (type === 'admin') {
      const testUser = await db.test_admins.findOne({ email });
      return !!testUser;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking test user:', error);
    return false;
  }
}

/**
 * Get the appropriate database models based on test mode
 * @param {boolean} isTest - Whether user is in test mode
 * @returns {object} - Database models (test or production)
 */
function getDbModels(isTest) {
  if (isTest) {
    return {
      clinical: db.test_clinical,
      facilities: db.test_facilities,
      admins: db.test_admins,
      terms: db.test_terms
    };
  } else {
    return {
      clinical: db.clinical,
      facilities: db.facilities,
      admins: db.admins,
      terms: db.terms
    };
  }
}

/**
 * Check if user is test user and get database context
 * @param {string} email - User email
 * @param {string} type - 'clinical', 'facility', or 'admin'
 * @returns {Promise<{isTest: boolean, models: object}>}
 */
async function getTestModeContext(email, type) {
  const isTest = await isTestUser(email, type);
  const models = getDbModels(isTest);
  
  return {
    isTest,
    models
  };
}

module.exports = {
  isTestUser,
  getDbModels,
  getTestModeContext
};


