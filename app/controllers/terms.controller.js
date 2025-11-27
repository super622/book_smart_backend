const db = require("../models");
const Terms = db.terms;
const Admin = db.admins;

// Get current published Terms (for public/clinician or facility view)
exports.getPublishedTerms = async (req, res) => {
  try {
    const { type } = req.query; // 'clinician' or 'facility'
    
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type parameter is required and must be "clinician" or "facility"' });
    }

    const terms = await Terms.findOne({ 
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
    const terms = await Terms.find()
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
    // Get currently published terms for each type (most recent by publishedDate, then by version)
    const publishedClinicianTerms = await Terms.findOne({ 
      status: 'published',
      type: 'clinician'
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    const publishedFacilityTerms = await Terms.findOne({ 
      status: 'published',
      type: 'facility'
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    // Get all draft terms grouped by type
    const draftClinicianTerms = await Terms.find({ 
      status: 'draft',
      type: 'clinician'
    })
      .sort({ updatedAt: -1 })
      .exec();
    
    const draftFacilityTerms = await Terms.find({ 
      status: 'draft',
      type: 'facility'
    })
      .sort({ updatedAt: -1 })
      .exec();
    
    // Populate admin info for published terms
    const enrichTerms = async (terms) => {
      if (!terms) return null;
      const admin = await Admin.findOne({ AId: terms.createdBy }, { firstName: 1, lastName: 1 });
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
    const terms = await Terms.findOne({ status: 'draft' })
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
    const terms = await Terms.findById(id);
    
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
    
    // Validate type
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type is required and must be "clinician" or "facility"' });
    }
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId;
    if (!adminId) {
      adminId = req.user?.AId || req.user?.id;
    }
    
    // If still no adminId, try to get it from Admin document
    if (!adminId && req.user?.email) {
      const adminDoc = await Admin.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc) {
        adminId = adminDoc.AId;
      }
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validate version - must not be lower than latest published version of the same type
    if (version) {
      const latestPublished = await Terms.findOne({ 
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
    let draftTerms = await Terms.findOne({ 
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
      const newTerms = new Terms({
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
    const { id, adminId: bodyAdminId } = req.body;
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId;
    if (!adminId) {
      adminId = req.user?.AId || req.user?.id;
    }
    
    // If still no adminId, try to get it from Admin document
    if (!adminId && req.user?.email) {
      const adminDoc = await Admin.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc) {
        adminId = adminDoc.AId;
      }
    }

    if (!id) {
      return res.status(400).json({ error: 'Terms ID is required' });
    }

    const terms = await Terms.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }

    // Validate version - must not be lower than latest published version of the same type
    const latestPublished = await Terms.findOne({ 
      status: 'published',
      type: terms.type,
      _id: { $ne: id } // Exclude current terms being published
    })
      .sort({ publishedDate: -1, version: -1 })
      .exec();
    
    if (latestPublished) {
      const versionComparison = compareVersions(terms.version, latestPublished.version);
      if (versionComparison < 0) {
        return res.status(400).json({ 
          error: `Version ${terms.version} is lower than the latest published ${terms.type} version ${latestPublished.version}. Please use a higher version number.` 
        });
      }
    }

    // Set all other published terms of the same type to draft (only one published at a time per type)
    await Terms.updateMany(
      { status: 'published', type: terms.type, _id: { $ne: id } },
      { status: 'draft' }
    );

    // Publish the selected terms
    terms.status = 'published';
    terms.publishedDate = new Date();
    terms.lastModifiedBy = adminId;
    terms.lastModifiedDate = new Date();
    await terms.save();

    return res.status(200).json({ 
      message: 'Terms published successfully',
      terms 
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
    
    // Validate type
    if (!type || !['clinician', 'facility'].includes(type)) {
      return res.status(400).json({ error: 'Type is required and must be "clinician" or "facility"' });
    }
    
    // Get adminId from body, req.user, or query Admin document
    let finalAdminId = adminId;
    if (!finalAdminId) {
      finalAdminId = req.user?.AId || req.user?.id;
    }
    
    // If still no adminId, try to get it from Admin document
    if (!finalAdminId && req.user?.email) {
      const adminDoc = await Admin.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc) {
        finalAdminId = adminDoc.AId;
      }
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const termsVersion = version || '1.0.0';

    // Validate version - must not be lower than latest published version of the same type
    const latestPublished = await Terms.findOne({ 
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

    const newTerms = new Terms({
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
    
    // Get adminId from body, req.user, or query Admin document
    let adminId = bodyAdminId;
    if (!adminId) {
      adminId = req.user?.AId || req.user?.id;
    }
    
    // If still no adminId, try to get it from Admin document
    if (!adminId && req.user?.email) {
      const adminDoc = await Admin.findOne({ email: req.user.email }, { AId: 1 });
      if (adminDoc) {
        adminId = adminDoc.AId;
      }
    }

    const terms = await Terms.findById(id);
    
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

    const terms = await Terms.findById(id);
    
    if (!terms) {
      return res.status(404).json({ error: 'Terms not found' });
    }

    // Don't allow deleting published terms
    if (terms.status === 'published') {
      return res.status(400).json({ error: 'Cannot delete published terms. Unpublish first.' });
    }

    await Terms.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Terms deleted successfully' });
  } catch (error) {
    console.error('Error deleting terms:', error);
    return res.status(500).json({ error: error.message });
  }
};

