const db = require("../models");
const Terms = db.terms;
const Admin = db.admins;

// Helper function to get appropriate database models based on test mode
function getTermsDbModels(req) {
  const isTest = req.user?.isTest === true;
  const { getDbModels } = require('../utils/testMode');
  return getDbModels(isTest);
}

// Get current published Terms (for public/clinician or facility view)
exports.getPublishedTerms = async (req, res) => {
  try {
    const { type, email } = req.query; // 'clinician' or 'facility', and optional email
    
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type parameter is required and must be "clinician" or "facility"' });
    }

    // Check if user is in test mode
    // Priority: 1. Token's isTest flag (if authenticated), 2. Email parameter check, 3. Default to false
    let isTest = false;
    
    // First check if authenticated user has isTest flag in token
    if (req.user?.isTest === true) {
      isTest = true;
      console.log('Test mode detected from token');
    } 
    // If not authenticated or no isTest in token, check email parameter
    else if (email) {
      const { isTestUser } = require('../utils/testMode');
      isTest = await isTestUser(email.toLowerCase(), type === 'clinician' ? 'clinical' : 'facility');
      console.log(`Test mode check for email ${email}: ${isTest}`);
    }
    
    // Use test database if user is in test mode
    const { getDbModels } = require('../utils/testMode');
    const models = getDbModels(isTest);
    const TermsModel = models.terms;
    
    console.log(`Fetching ${type} terms from ${isTest ? 'test' : 'production'} database`);

    const terms = await TermsModel.findOne({ 
      status: 'published',
      type: type
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    if (!terms) {
      return res.status(404).json({ error: `No published ${type} terms found` });
    }

    return res.status(200).json({ terms });
  } catch (error) {
    console.error('Error getting published terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all Terms (for admin - includes drafts)
exports.getAllTerms = async (req, res) => {
  try {
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const terms = await TermsModel.find()
      .sort({ createdAt: -1 })
      .exec();
    
    return res.status(200).json({ terms });
  } catch (error) {
    console.error('Error getting all terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Helper function to compare version numbers (semantic versioning)
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
};

// Get Terms overview for admin (published + drafts separately, grouped by type)
exports.getTermsOverview = async (req, res) => {
  try {
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const AdminModel = models.admins;
    
    // Get currently published terms for each type (most recent by publishedDate, then by version)
    const publishedClinicianTerms = await TermsModel.findOne({ 
      status: 'published',
      type: 'clinician'
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    const publishedFacilityTerms = await TermsModel.findOne({ 
      status: 'published',
      type: 'facility'
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    // Get all draft terms grouped by type
    const draftClinicianTerms = await TermsModel.find({ 
      status: 'draft',
      type: 'clinician'
    })
      .sort({ updatedAt: -1 })
      .exec();
    
    const draftFacilityTerms = await TermsModel.find({ 
      status: 'draft',
      type: 'facility'
    })
      .sort({ updatedAt: -1 })
      .exec();
    
    // Populate admin info for published terms
    const enrichTerms = async (terms) => {
      if (!terms) return null;
      const admin = await AdminModel.findOne({ AId: terms.createdBy }, { firstName: 1, lastName: 1 });
      return {
        ...terms.toObject(),
        createdByName: admin ? `${admin.firstName} ${admin.lastName}` : 'Unknown'
      };
    };
    
    const enrichedPublishedClinician = await enrichTerms(publishedClinicianTerms);
    const enrichedPublishedFacility = await enrichTerms(publishedFacilityTerms);
    
    return res.status(200).json({ 
      publishedClinicianTerms: enrichedPublishedClinician,
      publishedFacilityTerms: enrichedPublishedFacility,
      draftClinicianTerms: draftClinicianTerms || [],
      draftFacilityTerms: draftFacilityTerms || []
    });
  } catch (error) {
    console.error('Error getting terms overview:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get current draft Terms (for admin editing)
exports.getDraftTerms = async (req, res) => {
  try {
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const terms = await TermsModel.findOne({ status: 'draft' })
      .sort({ updatedAt: -1 })
      .exec();
    
    return res.status(200).json({ terms });
  } catch (error) {
    console.error('Error getting draft terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get Terms by ID
exports.getTermsById = async (req, res) => {
  try {
    const { id } = req.params;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const terms = await TermsModel.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }
    
    return res.status(200).json({ terms });
  } catch (error) {
    console.error('Error getting terms by ID:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Save Terms as Draft (create or update)
exports.saveDraftTerms = async (req, res) => {
  try {
    const { content, version, type, adminId: bodyAdminId } = req.body;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const AdminModel = models.admins;
    
    // Validate type
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type is required and must be "clinician" or "facility"' });
    }
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId ? Number(bodyAdminId) : null;
    
    // Always get AId from Admin document to ensure it's a Number, not MongoDB _id
    if (!adminId && req.user?.email) {
      const adminDoc = await AdminModel.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc && adminDoc.AId) {
        adminId = Number(adminDoc.AId);
      }
    }
    
    // Fallback: try req.user.AId if available
    if (!adminId && req.user?.AId) {
      adminId = Number(req.user.AId);
    }
    
    // If still no adminId, return error
    if (!adminId) {
      return res.status(400).json({ error: 'Unable to determine admin ID. Please ensure you are logged in as an admin.' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validate version - must not be lower than latest published version of the same type
    if (version) {
      const latestPublished = await TermsModel.findOne({ 
        status: 'published',
        type: type
      })
        .sort({ publishedDate: -1, version: -1 })
        .exec();
      
      if (latestPublished) {
        const versionComparison = compareVersions(version, latestPublished.version);
        if (versionComparison < 0) {
          return res.status(400).json({ 
            error: `Version ${version} is lower than the latest published ${type} version ${latestPublished.version}. Please use a higher version number.` 
          });
        }
      }
    }

    // Find existing draft of the same type
    let draftTerms = await TermsModel.findOne({ 
      status: 'draft',
      type: type
    })
      .sort({ updatedAt: -1 })
      .exec();

    if (draftTerms) {
      // Update existing draft
      draftTerms.content = content;
      if (version) draftTerms.version = version;
      draftTerms.lastModifiedBy = adminId;
      draftTerms.lastModifiedDate = new Date();
      await draftTerms.save();
      
      return res.status(200).json({ 
        message: 'Draft saved successfully',
        terms: draftTerms 
      });
    } else {
      // Create new draft
      const newTerms = new TermsModel({
        type,
        content,
        version: version || '1.0.0',
        status: 'draft',
        createdBy: adminId,
        lastModifiedBy: adminId
      });
      
      await newTerms.save();
      
      return res.status(201).json({ 
        message: 'Draft created successfully',
        terms: newTerms 
      });
    }
  } catch (error) {
    console.error('Error saving draft terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Publish Terms (update draft to published)
exports.publishTerms = async (req, res) => {
  try {
    const { id, content, version, type, adminId: bodyAdminId } = req.body;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const ClinicalModel = models.clinical;
    const FacilitiesModel = models.facilities;
    const AdminModel = models.admins;
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId ? Number(bodyAdminId) : null;
    
    // Always get AId from Admin document to ensure it's a Number, not MongoDB _id
    if (!adminId && req.user?.email) {
      const adminDoc = await AdminModel.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc && adminDoc.AId) {
        adminId = Number(adminDoc.AId);
      }
    }
    
    // Fallback: try req.user.AId if available
    if (!adminId && req.user?.AId) {
      adminId = Number(req.user.AId);
    }
    
    // If still no adminId, return error
    if (!adminId) {
      return res.status(400).json({ error: 'Unable to determine admin ID. Please ensure you are logged in as an admin.' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Terms ID is required' });
    }

    const terms = await TermsModel.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }

    // Update content and version if provided (ensures latest content is saved before publishing)
    if (content !== undefined) {
      terms.content = content;
    }
    if (version !== undefined) {
      terms.version = version;
    }
    if (type !== undefined) {
      terms.type = type;
    }

    // Validate version - must not be lower than latest published version of the same type
    // Use the updated version if provided, otherwise use existing version
    const versionToValidate = version || terms.version;
    const typeToValidate = type || terms.type;
    
    const latestPublished = await TermsModel.findOne({ 
      status: 'published',
      type: typeToValidate,
      _id: { $ne: id } // Exclude current terms being published
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    if (latestPublished) {
      const versionComparison = compareVersions(versionToValidate, latestPublished.version);
      if (versionComparison < 0) {
        return res.status(400).json({ 
          error: `Version ${versionToValidate} is lower than the latest published ${typeToValidate} version ${latestPublished.version}. Please use a higher version number.` 
        });
      }
    }

    // DO NOT change previous published terms to draft - keep them as published
    // The app will show the most recent published version first based on publishedDate sorting

    // Publish the selected terms
    terms.status = 'published';
    terms.publishedDate = new Date();
    terms.lastModifiedBy = adminId;
    terms.lastModifiedDate = new Date();
    
    // Save the terms
    const savedTerms = await terms.save();
    console.log('Terms published successfully. Status:', savedTerms.status, 'ID:', savedTerms._id);

    // Automatically reset acknowledge flags when new terms are published
    try {
      if (savedTerms.type === 'clinician') {
        // Reset clinicalAcknowledgeTerm to false for all clinicians
        // Users will see new terms on next login (no auto-logout)
        const updateResult = await ClinicalModel.updateMany(
          {},
          { 
            $set: { 
              clinicalAcknowledgeTerm: false
            } 
          }
        );
        console.log(`Reset clinicalAcknowledgeTerm for ${updateResult.modifiedCount} clinicians`);
      } else if (savedTerms.type === 'facility') {
        // Reset facilityAcknowledgeTerm to false for all facilities
        const updateResult = await FacilitiesModel.updateMany(
          {},
          { 
            $set: { 
              facilityAcknowledgeTerm: false
            } 
          }
        );
        console.log(`Reset facilityAcknowledgeTerm for ${updateResult.modifiedCount} facilities`);
      }
    } catch (acknowledgeError) {
      console.error('Error resetting acknowledge flags:', acknowledgeError);
      // Don't fail the publish if this fails, but log it
    }

    // Send notifications to users based on terms type
    const { sendNotificationToMultipleUsers } = require('../utils/firebaseService');
    
    try {
      if (savedTerms.type === 'clinician') {
        // Notify all active clinicians (only test users if in test mode)
        const clinicians = await ClinicalModel.find(
          { userStatus: 'activate', fcmToken: { $exists: true, $ne: null, $ne: '' } },
          { fcmToken: 1 }
        );
        
        const tokens = clinicians
          .map(c => c.fcmToken)
          .filter(token => token && token.trim() !== '');
        
        console.log(`Found ${tokens.length} clinicians with FCM tokens to notify`);
        if (tokens.length > 0) {
          console.log('Sample token (first 30 chars):', tokens[0]?.substring(0, 30) + '...');
        }
        
        if (tokens.length > 0) {
          // FCM data must have all values as strings
          const notificationData = {
            type: 'new_terms',
            termsType: 'clinician',
            version: savedTerms.version.toString(),
            termsId: savedTerms._id.toString()
          };
          
          try {
            const result = await sendNotificationToMultipleUsers(
              tokens,
              'New Terms of Service Available',
              `A new version (${savedTerms.version}) of the Clinician Terms of Service has been released. Please review and accept the new terms.`,
              notificationData
            );
            console.log(`Notification result - Success: ${result?.successCount || 0}, Failed: ${result?.failureCount || 0}`);
            if (result?.failureCount > 0) {
              console.log('Some notifications failed. Check logs above for details.');
            }
          } catch (notifError) {
            console.error('Error sending FCM notifications to clinicians:', notifError);
            console.error('Error details:', notifError.message);
            // Try sending individually if batch fails
            const { sendNotification } = require('../utils/firebaseService');
            let successCount = 0;
            let failureCount = 0;
            for (const token of tokens.slice(0, 10)) { // Limit to first 10 to avoid too many calls
              try {
                const individualResult = await sendNotification(
                  token,
                  'New Terms of Service Available',
                  `A new version (${savedTerms.version}) of the Clinician Terms of Service has been released. Please review and accept the new terms.`,
                  notificationData
                );
                if (individualResult?.success) {
                  successCount++;
                } else {
                  failureCount++;
                  console.error(`Failed to send to token ${token.substring(0, 20)}...:`, individualResult?.error || 'Unknown error');
                }
              } catch (individualError) {
                failureCount++;
                console.error(`Failed to send to token ${token.substring(0, 20)}...:`, individualError.message);
              }
            }
            console.log(`Individual notifications - Success: ${successCount}, Failed: ${failureCount}`);
          }
        } else {
          console.log('No clinicians with FCM tokens found');
        }
      } else if (savedTerms.type === 'facility') {
        // Notify all facilities (only test users if in test mode)
        const facilities = await FacilitiesModel.find(
          { fcmToken: { $exists: true, $ne: null, $ne: '' } },
          { fcmToken: 1 }
        );
        
        const tokens = facilities
          .map(f => f.fcmToken)
          .filter(token => token && token.trim() !== '');
        
        console.log(`Found ${tokens.length} facilities with FCM tokens to notify`);
        if (tokens.length > 0) {
          console.log('Sample token (first 30 chars):', tokens[0]?.substring(0, 30) + '...');
        }
        
        if (tokens.length > 0) {
          // FCM data must have all values as strings
          const notificationData = {
            type: 'new_terms',
            termsType: 'facility',
            version: savedTerms.version.toString(),
            termsId: savedTerms._id.toString()
          };
          
          try {
            const result = await sendNotificationToMultipleUsers(
              tokens,
              'New Terms of Service Available',
              `A new version (${savedTerms.version}) of the Facility Terms of Service has been released. Please review and accept the new terms.`,
              notificationData
            );
            console.log(`Notification result - Success: ${result?.successCount || 0}, Failed: ${result?.failureCount || 0}`);
            if (result?.failureCount > 0) {
              console.log('Some notifications failed. Check logs above for details.');
            }
          } catch (notifError) {
            console.error('Error sending FCM notifications to facilities:', notifError);
            console.error('Error details:', notifError.message);
            // Try sending individually if batch fails
            const { sendNotification } = require('../utils/firebaseService');
            let successCount = 0;
            let failureCount = 0;
            for (const token of tokens.slice(0, 10)) { // Limit to first 10 to avoid too many calls
              try {
                const individualResult = await sendNotification(
                  token,
                  'New Terms of Service Available',
                  `A new version (${savedTerms.version}) of the Facility Terms of Service has been released. Please review and accept the new terms.`,
                  notificationData
                );
                if (individualResult?.success) {
                  successCount++;
                } else {
                  failureCount++;
                  console.error(`Failed to send to token ${token.substring(0, 20)}...:`, individualResult?.error || 'Unknown error');
                }
              } catch (individualError) {
                failureCount++;
                console.error(`Failed to send to token ${token.substring(0, 20)}...:`, individualError.message);
              }
            }
            console.log(`Individual notifications - Success: ${successCount}, Failed: ${failureCount}`);
          }
        } else {
          console.log('No facilities with FCM tokens found');
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the publish if notifications fail
    }

    // Reload terms to ensure we have the latest data
    const publishedTerms = await TermsModel.findById(id);
    
    return res.status(200).json({ 
      message: 'Terms published successfully',
      terms: publishedTerms 
    });
  } catch (error) {
    console.error('Error publishing terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Create new Terms (creates a new draft)
exports.createTerms = async (req, res) => {
  try {
    const { content, version, type, adminId } = req.body;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const AdminModel = models.admins;
    
    // Validate type
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type is required and must be "clinician" or "facility"' });
    }
    
    // Get adminId from body, req.user, or query Admin document
    let finalAdminId = adminId ? Number(adminId) : null;
    
    // Always get AId from Admin document to ensure it's a Number, not MongoDB _id
    if (!finalAdminId && req.user?.email) {
      const adminDoc = await AdminModel.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc && adminDoc.AId) {
        finalAdminId = Number(adminDoc.AId);
      }
    }
    
    // Fallback: try req.user.AId if available
    if (!finalAdminId && req.user?.AId) {
      finalAdminId = Number(req.user.AId);
    }
    
    // If still no adminId, return error
    if (!finalAdminId) {
      return res.status(400).json({ error: 'Unable to determine admin ID. Please ensure you are logged in as an admin.' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const termsVersion = version || '1.0.0';

    // Validate version - must not be lower than latest published version of the same type
    const latestPublished = await TermsModel.findOne({ 
      status: 'published',
      type: type
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    if (latestPublished) {
      const versionComparison = compareVersions(termsVersion, latestPublished.version);
      if (versionComparison < 0) {
        return res.status(400).json({ 
          error: `Version ${termsVersion} is lower than the latest published ${type} version ${latestPublished.version}. Please use a higher version number.` 
        });
      }
    }

    const newTerms = new TermsModel({
      type,
      content,
      version: termsVersion,
      status: 'draft',
      createdBy: finalAdminId,
      lastModifiedBy: finalAdminId
    });

    await newTerms.save();

    return res.status(201).json({ 
      message: 'Terms created successfully',
      terms: newTerms 
    });
  } catch (error) {
    console.error('Error creating terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Update Terms
exports.updateTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, version, adminId: bodyAdminId } = req.body;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;
    const AdminModel = models.admins;
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId ? Number(bodyAdminId) : null;
    
    // Always get AId from Admin document to ensure it's a Number, not MongoDB _id
    if (!adminId && req.user?.email) {
      const adminDoc = await AdminModel.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc && adminDoc.AId) {
        adminId = Number(adminDoc.AId);
      }
    }
    
    // Fallback: try req.user.AId if available
    if (!adminId && req.user?.AId) {
      adminId = Number(req.user.AId);
    }
    
    // If still no adminId, return error
    if (!adminId) {
      return res.status(400).json({ error: 'Unable to determine admin ID. Please ensure you are logged in as an admin.' });
    }

    const terms = await TermsModel.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }

    if (content !== undefined) terms.content = content;
    if (version !== undefined) terms.version = version;
    terms.lastModifiedBy = adminId;
    terms.lastModifiedDate = new Date();

    await terms.save();

    return res.status(200).json({ 
      message: 'Terms updated successfully',
      terms 
    });
  } catch (error) {
    console.error('Error updating terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete Terms
exports.deleteTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const models = getTermsDbModels(req);
    const TermsModel = models.terms;

    const terms = await TermsModel.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }

    // Don't allow deleting published terms
    if (terms.status === 'published') {
      return res.status(400).json({ error: 'Cannot delete published terms. Unpublish first.' });
    }

    await TermsModel.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Terms deleted successfully' });
  } catch (error) {
    console.error('Error deleting terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Handle new terms acknowledgment - reset flags and logout users
exports.acknowledgeNewTerms = async (req, res) => {
  try {
    const { termsType } = req.body; // 'clinician' or 'facility'
    
    if (!termsType || !['clinician', 'facility'].includes(termsType)) {
      return res.status(400).json({ error: 'Terms type is required and must be "clinician" or "facility"' });
    }

    const db = require('../models');

    if (termsType === 'clinician') {
      // Reset clinicalAcknowledgeTerm to false for all clinicians
      // Set logined to false to logout all clinicians
      await db.clinical.updateMany(
        {},
        { 
          $set: { 
            clinicalAcknowledgeTerm: false,
            logined: false
          } 
        }
      );
      
      console.log('Reset clinicalAcknowledgeTerm and logged out all clinicians');
    } else if (termsType === 'facility') {
      // Reset facilityAcknowledgeTerm to false for all facilities
      await db.facilities.updateMany(
        {},
        { 
          $set: { 
            facilityAcknowledgeTerm: false
          } 
        }
      );
      
      console.log('Reset facilityAcknowledgeTerm for all facilities');
    }

    return res.status(200).json({ 
      message: `Successfully reset ${termsType} terms acknowledgment. All ${termsType}s will be required to accept new terms on next login.` 
    });
  } catch (error) {
    console.error('Error acknowledging new terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get terms status for all users (admin only)
exports.getTermsStatus = async (req, res) => {
  try {
    const models = getTermsDbModels(req);
    
    // Get latest published terms versions
    const clinicianTermsList = await models.terms
      .find({ type: 'clinician', status: 'published' })
      .sort({ publishedDate: -1 })
      .limit(1)
      .select('version publishedDate')
      .lean();
    const latestClinicianTerms = clinicianTermsList.length > 0 ? clinicianTermsList[0] : null;
    
    const facilityTermsList = await models.terms
      .find({ type: 'facility', status: 'published' })
      .sort({ publishedDate: -1 })
      .limit(1)
      .select('version publishedDate')
      .lean();
    const latestFacilityTerms = facilityTermsList.length > 0 ? facilityTermsList[0] : null;
    
    // Get all clinicians with terms info
    const clinicians = await models.clinical
      .find({})
      .select('aic firstName lastName email phoneNumber userRole title clinicalAcknowledgeTerm clinicalTermsVersion clinicalTermsSignedDate userStatus')
      .sort({ lastName: 1, firstName: 1 })
      .lean();
    
    // Get all facilities with terms info
    const facilities = await models.facilities
      .find({})
      .select('aic firstName lastName companyName contactEmail contactPhone facilityAcknowledgeTerm facilityTermsVersion facilityTermsSignedDate userStatus')
      .sort({ companyName: 1, lastName: 1, firstName: 1 })
      .lean();
    
    return res.status(200).json({
      latestClinicianTerms: latestClinicianTerms ? {
        version: latestClinicianTerms.version,
        publishedDate: latestClinicianTerms.publishedDate
      } : null,
      latestFacilityTerms: latestFacilityTerms ? {
        version: latestFacilityTerms.version,
        publishedDate: latestFacilityTerms.publishedDate
      } : null,
      clinicians: clinicians.map(c => ({
        aic: c.aic,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phoneNumber: c.phoneNumber,
        userRole: c.userRole,
        title: c.title,
        hasAccepted: c.clinicalAcknowledgeTerm || false,
        termsVersion: c.clinicalTermsVersion || '',
        termsSignedDate: c.clinicalTermsSignedDate || null,
        userStatus: c.userStatus || 'inactive',
        isUpToDate: latestClinicianTerms ? (c.clinicalTermsVersion === latestClinicianTerms.version) : false
      })),
      facilities: facilities.map(f => ({
        aic: f.aic,
        firstName: f.firstName,
        lastName: f.lastName,
        companyName: f.companyName || '',
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        hasAccepted: f.facilityAcknowledgeTerm || false,
        termsVersion: f.facilityTermsVersion || '',
        termsSignedDate: f.facilityTermsSignedDate || null,
        userStatus: f.userStatus || 'inactive',
        isUpToDate: latestFacilityTerms ? (f.facilityTermsVersion === latestFacilityTerms.version) : false
      }))
    });
  } catch (error) {
    console.error('Error fetching terms status:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Test FCM notification (for debugging)
exports.testFCMNotification = async (req, res) => {
    console.log('Test FCM Notification');
  try {
    const { token, type } = req.body; // type: 'clinician' or 'facility'
    
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    const { sendNotification } = require('../utils/firebaseService');
    
    const notificationData = {
      type: 'new_terms',
      termsType: type || 'clinician',
      version: '1.0.0',
      termsId: 'test'
    };
    
    const result = await sendNotification(
      token,
      'Test Notification',
      'This is a test notification from BookSmart',
      notificationData
    );
    
    if (result.success) {
      return res.status(200).json({ 
        message: 'Test notification sent successfully',
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to send test notification',
        details: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error in testFCMNotification:', error);
    return res.status(500).json({ error: error.message });
  }
};

