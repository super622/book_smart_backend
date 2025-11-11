const db = require("../models");
const DJob = db.Djobs;
const Admin = db.admins;

const Facility = db.facilities;
const Clinician = db.clinical;
const Degree = db.degree;
const mailTrans = require("./mailTrans.controller");
const { pushNotification } = require('./twilio');
const { sendNotification } = require('../utils/firebaseService');


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

        // Get the clinician's userRole (RN, CNA, LPN, etc.)
        const clinician = await Clinician.findOne({ aic });
        if (!clinician) {
            return res.status(404).json({ message: "Clinician not found" });
        }
        const clinicianRole = clinician.userRole || clinician.title;

        // Find degrees that match the clinician's userRole
        const matchingDegrees = await Degree.find({ 
            degreeName: { $regex: new RegExp(`^${clinicianRole}$`, 'i') } 
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

    const status = clinicianId == 0 ? "NotSelect" : "assigned-pending";

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

    // Get facility and degree info for notifications
    const facility = await Facility.findOne({ aic: facilitiesId }, { companyName: 1 });
    const facilityName = facility?.companyName || "Your Facility";
    
    const degreeDoc = await Degree.findOne({ Did: degree });
    const degreeName = degreeDoc?.degreeName || "Staff";

    if (clinicianId != 0) {
      // Shift assigned to specific clinician - notify that person only
      const clinician = await Clinician.findOne(
        { aic: clinicianId },
        { email: 1, firstName: 1, lastName: 1, phoneNumber: 1, fcmToken: 1 }
      );

      if (clinician) {
        const clinicianName = `${clinician.firstName || ""} ${clinician.lastName || ""}`.trim();

        // Email notification
        const emailSubject = `Shift Assigned by ${facilityName}`;
        const emailContent = `
          <p>Dear ${clinicianName || "Clinician"},</p>
          <p>You have been assigned to a new shift on <strong>${normShift.date}</strong> at <strong>${normShift.time}</strong> by <strong>${facilityName}</strong>.</p>
          <p>Please review and respond in the app.</p>
        `;
        await mailTrans.sendMail(clinician.email, emailSubject, emailContent);

        // SMS notification
        if (clinician.phoneNumber) {
          const smsMessage = `BookSmart: You've been assigned a ${degreeName} shift on ${normShift.date} at ${normShift.time} by ${facilityName}. Check the app to respond.`;
          await pushNotification(smsMessage, clinician.phoneNumber);
        }

        // FCM push notification
        if (clinician.fcmToken) {
          await sendNotification(
            clinician.fcmToken,
            `New Shift Assignment`,
            `${facilityName} assigned you a shift on ${normShift.date}`
          );
        }
      }
    } else {
      // Shift created with no staff (NOTSELECT) - notify all eligible clinicians
      const eligibleClinicians = await Clinician.find(
        { 
          userRole: { $regex: new RegExp(`^${degreeName}$`, 'i') },
          userStatus: 'active'
        },
        { email: 1, firstName: 1, lastName: 1, phoneNumber: 1, fcmToken: 1, userRole: 1 }
      );

      if (eligibleClinicians.length > 0) {
        // Send notifications to all eligible clinicians
        await Promise.all(
          eligibleClinicians.map(async (clinician) => {
            const clinicianName = `${clinician.firstName || ""} ${clinician.lastName || ""}`.trim();

            // Email
            const emailSubject = `New ${degreeName} Shift Available`;
            const emailContent = `
              <p>Dear ${clinicianName || "Clinician"},</p>
              <p>A new ${degreeName} shift is available on <strong>${normShift.date}</strong> at <strong>${normShift.time}</strong> from <strong>${facilityName}</strong>.</p>
              <p>Login to the app to apply for this shift before someone else does!</p>
            `;
            await mailTrans.sendMail(clinician.email, emailSubject, emailContent);

            // FCM Push
            if (clinician.fcmToken) {
              await sendNotification(
                clinician.fcmToken,
                `New ${degreeName} Shift Available`,
                `${facilityName} posted a shift on ${normShift.date}. Apply now!`
              );
            }
          })
        );
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
        
        // Handle status transitions
        // When clinician accepts assigned shift: assigned-pending → assigned-approved
        if (s === 'accept' || s === 'approved') {
          const currentJob = await DJob.findOne({ DJobId: id });
          if (currentJob?.status === 'assigned-pending') {
            update.status = 'assigned-approved';
          } else {
            update.status = 'approved';
          }
        }
        // When clinician declines assigned shift: assigned-pending → NotSelect (back to pool)
        else if (s === 'reject' || s === 'rejected') {
          const currentJob = await DJob.findOne({ DJobId: id });
          if (currentJob?.status === 'assigned-pending') {
            update.status = 'NotSelect';
            update.clinicianId = 0;
          } else {
            update.status = 'rejected';
          }
        } else {
          update.status = s;
        }
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

    // Get facility and degree info for notifications
    const facility = await Facility.findOne({ aic: job.facilitiesId }, { companyName: 1 });
    const facilityName = facility?.companyName || "Your Facility";
    
    const degreeDoc = await Degree.findOne({ Did: job.degree });
    const degreeName = degreeDoc?.degreeName || "Staff";

    const shiftDate = job.shift?.date || 'your shift';
    const shiftTime = job.shift?.time || '';

    if (action === 'accept') {
      // Accept this applicant
      applicant.status = 'accepted';
      job.clinicianId = Number(clinicianId);
      job.status = 'assigned-pending';
      
      // Get accepted clinician info
      const acceptedClinician = await Clinician.findOne(
        { aic: clinicianId },
        { email: 1, firstName: 1, lastName: 1, phoneNumber: 1, fcmToken: 1 }
      );

      if (acceptedClinician) {
        const clinicianName = `${acceptedClinician.firstName || ""} ${acceptedClinician.lastName || ""}`.trim();

        // Notify accepted clinician
        const emailSubject = `Shift Application Accepted!`;
        const emailContent = `
          <p>Dear ${clinicianName || "Clinician"},</p>
          <p>Congratulations! Your application for the ${degreeName} shift on <strong>${shiftDate}</strong> at <strong>${shiftTime}</strong> has been <strong>accepted</strong> by <strong>${facilityName}</strong>.</p>
          <p>Please check the app for more details.</p>
        `;
        await mailTrans.sendMail(acceptedClinician.email, emailSubject, emailContent);

        // FCM Push
        if (acceptedClinician.fcmToken) {
          await sendNotification(
            acceptedClinician.fcmToken,
            `Shift Application Accepted!`,
            `${facilityName} accepted your application for ${shiftDate}`
          );
        }
      }
      
      // Reject all other applicants and notify them
      const rejectedApplicants = job.applicants.filter(a => a.clinicianId !== Number(clinicianId));
      
      await Promise.all(
        rejectedApplicants.map(async (otherApplicant) => {
          otherApplicant.status = 'rejected';
          
          const rejectedClinician = await Clinician.findOne(
            { aic: otherApplicant.clinicianId },
            { email: 1, firstName: 1, lastName: 1, phoneNumber: 1, fcmToken: 1 }
          );

          if (rejectedClinician) {
            const clinicianName = `${rejectedClinician.firstName || ""} ${rejectedClinician.lastName || ""}`.trim();

            // Notify rejected clinician
            const emailSubject = `Shift Application Update`;
            const emailContent = `
              <p>Dear ${clinicianName || "Clinician"},</p>
              <p>Thank you for your interest in the ${degreeName} shift on <strong>${shiftDate}</strong> at <strong>${shiftTime}</strong> with <strong>${facilityName}</strong>.</p>
              <p>Unfortunately, this position has been filled. Please check the app for other available shifts.</p>
            `;
            await mailTrans.sendMail(rejectedClinician.email, emailSubject, emailContent);

            // FCM Push
            if (rejectedClinician.fcmToken) {
              await sendNotification(
                rejectedClinician.fcmToken,
                `Shift Application Update`,
                `The shift on ${shiftDate} has been filled`
              );
            }
          }
        })
      );
    } else {
      // Reject this applicant
      applicant.status = 'rejected';
      
      const rejectedClinician = await Clinician.findOne(
        { aic: clinicianId },
        { email: 1, firstName: 1, lastName: 1, phoneNumber: 1, fcmToken: 1 }
      );

      if (rejectedClinician) {
        const clinicianName = `${rejectedClinician.firstName || ""} ${rejectedClinician.lastName || ""}`.trim();

        // Notify rejected clinician
        const emailSubject = `Shift Application Update`;
        const emailContent = `
          <p>Dear ${clinicianName || "Clinician"},</p>
          <p>Thank you for your interest in the ${degreeName} shift on <strong>${shiftDate}</strong> at <strong>${shiftTime}</strong> with <strong>${facilityName}</strong>.</p>
          <p>Your application has been declined. Please check the app for other available shifts.</p>
        `;
        await mailTrans.sendMail(rejectedClinician.email, emailSubject, emailContent);

        // FCM Push
        if (rejectedClinician.fcmToken) {
          await sendNotification(
            rejectedClinician.fcmToken,
            `Shift Application Update`,
            `Your application for ${shiftDate} was declined`
          );
        }
      }
      
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