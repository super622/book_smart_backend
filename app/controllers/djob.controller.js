const db = require("../models");
const DJob = db.Djobs;
const Admin = db.admins;

const Facility = db.facilities;
const Clinician = db.clinical;
const Degree = db.degree;
const mailTrans = require("./mailTrans.controller");


async function nextDJobId() {
  const last = await DJob.findOne().sort({ DJobId: -1 }).select('DJobId').lean();
  return last ? last.DJobId + 1 : 1;
}

function normalizeShift(input) {
  if (Array.isArray(input)) {
    if (input.length === 0) return null;
    return normalizeShift(input[0]);
  }
  if (!input || !String(input.date||"").trim() || !String(input.time||"").trim()) return null;
  return { date: String(input.date).trim(), time: String(input.time).trim() };
}

exports.getDJobs = async (req, res) => {
    try {
        const adminId = req.params.adminId;

        if (!adminId) {
            return res.status(400).json({ message: "Admin AId is required" });
        }

        const docs = await DJob.find({ adminId }).sort({ DJobId: 1 });

        const enrichedDocs = await Promise.all(docs.map(async (dJob) => {
            const admin = await Admin.findOne({ AId: dJob.adminId });
            const companyName = admin ? admin.companyName : null;

            const facility = await Facility.findOne({ aic: dJob.facilitiesId });
            const facilityCompanyName = facility ? facility.companyName : null;

            const clinician = await Clinician.findOne({ aic: dJob.clinicianId });
            const clinicianNames = clinician ? `${clinician.firstName} ${clinician.lastName}` : null;

            const degree = await Degree.findOne({ Did: dJob.degree });
            const degreeName = degree ? degree.degreeName : null;

            return {
                ...dJob.toObject(),
                companyName,
                facilityCompanyName,
                clinicianNames,
                degreeName
            };
        }));

        return res.status(200).json({ message: "Success", data: enrichedDocs });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Error fetching DJobs" });
    }
};

exports.getClinicianDJobs = async (req, res) => {
    try {
        const { aic } = req.body;  
        if (!aic) {
            return res.status(400).json({ message: "Clinician AIC is required" });
        }

        // Get the clinician's title (RN, CNA, LPN, etc.)
        const clinician = await Clinician.findOne({ aic });
        if (!clinician) {
            return res.status(404).json({ message: "Clinician not found" });
        }
        const clinicianTitle = clinician.title;

        // Find degrees that match the clinician's title
        const matchingDegrees = await Degree.find({ 
            degreeName: { $regex: new RegExp(`^${clinicianTitle}$`, 'i') } 
        });
        const matchingDegreeIds = matchingDegrees.map(d => d.Did);

        if (matchingDegreeIds.length === 0) {
            return res.status(200).json({ message: "Success", data: [] });
        }

        
        const docsNotSelected = await DJob.find({ 
            clinicianId: 0,
            status: 'NotSelect',
            degree: { $in: matchingDegreeIds }
        }).sort({ DJobId: 1 });
        
        const docsWithClinicianAic = await DJob.find({ 
            clinicianId: aic,
            degree: { $in: matchingDegreeIds }
        }).sort({ DJobId: 1 });

        const seenIds = new Set();
        const combinedDocs = [...docsNotSelected, ...docsWithClinicianAic]
          .filter(doc => {
            if (seenIds.has(doc.DJobId)) return false;
            seenIds.add(doc.DJobId);
            return true;
          });

        const enrichedDocs = await Promise.all(combinedDocs.map(async (dJob) => {
            const admin = await Admin.findOne({ AId: dJob.adminId });
            const companyName = admin ? admin.companyName : null;

            const facility = await Facility.findOne({ aic: dJob.facilitiesId });
            const facilityCompanyName = facility ? facility.companyName : null;

            const assignedClinician = await Clinician.findOne({ aic: dJob.clinicianId });
            const clinicianNames = assignedClinician ? `${assignedClinician.firstName} ${assignedClinician.lastName}` : null;

            const degree = await Degree.findOne({ Did: dJob.degree });
            const degreeName = degree ? degree.degreeName : null;

            const enrichedApplicants = await Promise.all(
              (dJob.applicants || []).map(async (applicant) => {
                const appClinician = await Clinician.findOne({ aic: applicant.clinicianId });
                return {
                  ...applicant.toObject(),
                  firstName: appClinician?.firstName || '',
                  lastName: appClinician?.lastName || '',
                  email: appClinician?.email || '',
                  title: appClinician?.title || '',
                };
              })
            );

            return {
                ...dJob.toObject(),
                companyName,
                facilityCompanyName,
                clinicianNames,
                degreeName,
                applicants: enrichedApplicants,
            };
        }));

        return res.status(200).json({ message: "Success", data: enrichedDocs });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Error fetching clinician-specific DJobs" });
    }
};

exports.getFacilitiesDJobs = async (req, res) => {
  try {
    const { aic } = req.body; 

    if (!aic) {
      return res.status(400).json({ message: "Facility AIC is required" });
    }

    const docsWithFacilitiesAic = await DJob.find({ facilitiesId: aic }).sort({ DJobId: 1 });

    const enrichedDocs = await Promise.all(
      docsWithFacilitiesAic.map(async (dJob) => {
        const admin = await Admin.findOne({ AId: dJob.adminId });
        const companyName = admin ? admin.companyName : null;

        const facility = await Facility.findOne({ aic: aic });
        const facilityCompanyName = facility ? facility.companyName : null;

        const clinician = await Clinician.findOne({ aic: dJob.clinicianId });
        const clinicianNames = clinician ? `${clinician.firstName} ${clinician.lastName}` : null;

        const degree = await Degree.findOne({ Did: dJob.degree });
        const degreeName = degree ? degree.degreeName : null;

        // Enrich applicants with clinician details
        const enrichedApplicants = await Promise.all(
          (dJob.applicants || []).map(async (applicant) => {
            const appClinician = await Clinician.findOne({ aic: applicant.clinicianId });
            return {
              ...applicant.toObject(),
              firstName: appClinician?.firstName || '',
              lastName: appClinician?.lastName || '',
              email: appClinician?.email || '',
              title: appClinician?.title || '',
            };
          })
        );

        return {
          ...dJob.toObject(),
          companyName,
          facilityCompanyName,
          clinicianNames,
          degreeName,
          applicants: enrichedApplicants,
        };
      })
    );

    return res.status(200).json({
      message: "Success",
      data: enrichedDocs,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error fetching facility-specific DJobs" });
  }
};
  

exports.getDJobById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const doc = await DJob.findOne({ DJobId: id });
        if (!doc) return res.status(404).json({ message: "DJob not found" });
        return res.status(200).json({ message: "Success", data: doc });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Error fetching DJob" });
    }
};


exports.createDJob = async (req, res) => {
  try {
    const { shift, degree, adminId, adminMade = false, facilitiesId = null, clinicianId = null } = req.body;

    const normShift = normalizeShift(shift);
    if (!normShift) return res.status(400).json({ message: "shift must be an object with date and time" });
    if (degree == null)  return res.status(400).json({ message: "degree is required" });
    if (adminId == null) return res.status(400).json({ message: "adminId is required" });

    const DJobId = await nextDJobId();

    const status = clinicianId == 0 ? "NotSelect" : "applied";

    const doc = await DJob.create({
      DJobId,
      shift: normShift,
      degree,
      adminId,
      adminMade: Boolean(adminMade),
      facilitiesId: facilitiesId ?? 0,
      clinicianId:  clinicianId ?? 0,
      status: status,
    });

    if (clinicianId != 0) {
      const clinician = await Clinician.findOne(
        { aic: clinicianId },
        { email: 1, firstName: 1, lastName: 1 }
      );

      const facility = await Facility.findOne(
        { aic: facilitiesId },
        { companyName: 1 }
      );

      if (clinician && facility) {
        const clinicianEmail = clinician.email;
        const companyName = facility.companyName || "Your Facility";
        const clinicianName = `${clinician.firstName || ""} ${clinician.lastName || ""}`.trim();

        const emailSubject = `Shift Assigned by ${companyName}`;
        const emailContent = `
          <p>Dear ${clinicianName || "Clinician"},</p>
          <p>You have been assigned to a new shift on <strong>${shift.date}</strong> by <strong>${companyName}</strong>.</p>
          <p>Please review and approve the shift assignment.</p>
        `;

        await mailTrans.sendMail(clinicianEmail, emailSubject, emailContent);
      }
    }

    return res.status(201).json({ message: "DJob created", data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error creating DJob", error: e.message });
  }
};


exports.updateDJob = async (req, res) => {
  try {
    const id = Number(req.body.DJobId ?? req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid or missing DJobId" });

    const allowed = ["shift", "degree", "adminId", "adminMade", "facilitiesId", "clinicianId", "status", "applicants"];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];

    if (update.shift !== undefined) {
      const ns = normalizeShift(update.shift);
      if (!ns) return res.status(400).json({ message: "shift must be an object with date and time" });
      update.shift = ns;
    }

    if (update.status !== undefined) {
        const s = String(update.status).trim().toLowerCase();
        if (!s.length) {
          return res.status(400).json({ message: "Invalid status value" });
        }
        update.status = s;
    }

    const doc = await DJob.findOneAndUpdate(
      { DJobId: id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: "DJob not found" });
    return res.status(200).json({ message: "Updated", data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error updating DJob" });
  }
};

// Add clinician as applicant to a shift
exports.applyForShift = async (req, res) => {
  try {
    const { DJobId, clinicianId } = req.body;
    
    if (!DJobId || !clinicianId) {
      return res.status(400).json({ message: "DJobId and clinicianId are required" });
    }

    const job = await DJob.findOne({ DJobId: Number(DJobId) });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if already applied
    const alreadyApplied = job.applicants.some(a => a.clinicianId === Number(clinicianId));
    if (alreadyApplied) {
      return res.status(400).json({ message: "Already applied for this shift" });
    }

    // Add to applicants array
    job.applicants.push({
      clinicianId: Number(clinicianId),
      appliedAt: new Date(),
      status: 'pending'
    });

    // DO NOT change the DJob status - it should remain "NotSelect"
    // so other clinicians can still apply
    // Status only changes when admin accepts/rejects someone

    await job.save();

    return res.status(200).json({ message: "Applied successfully", data: job });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error applying for shift", error: e.message });
  }
};

// Accept/Reject a specific applicant
exports.reviewApplicant = async (req, res) => {
  try {
    const { DJobId, clinicianId, action } = req.body;
    
    if (!DJobId || !clinicianId || !action) {
      return res.status(400).json({ message: "DJobId, clinicianId, and action are required" });
    }

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'accept' or 'reject'" });
    }

    const job = await DJob.findOne({ DJobId: Number(DJobId) });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const applicant = job.applicants.find(a => a.clinicianId === Number(clinicianId));
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (action === 'accept') {
      // Accept this applicant
      applicant.status = 'accepted';
      job.clinicianId = Number(clinicianId);
      job.status = 'approved';
      
      // Reject all other applicants
      job.applicants.forEach(a => {
        if (a.clinicianId !== Number(clinicianId)) {
          a.status = 'rejected';
        }
      });
    } else {
      // Reject this applicant
      applicant.status = 'rejected';
      
      // If no applicants are left pending, set job back to NotSelect
      const hasPendingApplicants = job.applicants.some(a => a.status === 'pending');
      if (!hasPendingApplicants) {
        job.status = 'NotSelect';
        job.clinicianId = 0;
      }
    }

    await job.save();

    return res.status(200).json({ message: `Applicant ${action}ed`, data: job });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error reviewing applicant", error: e.message });
  }
};

// DELETE
exports.deleteDJob = async (req, res) => {
    try {
      const idRaw = req.body?.DJobId ?? req.params?.id;
      const id = Number(idRaw);
  
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid or missing DJobId" });
      }
  
      const result = await DJob.deleteOne({ DJobId: id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "DJob not found" });
      }
  
      return res.status(200).json({ message: "Deleted" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Error deleting DJob", error: e.message });
    }
};