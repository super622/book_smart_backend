const db = require("../models");
const DJob = db.Djobs;

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

// READ (all)
exports.getDJobs = async (_req, res) => {
    try {
        const docs = await DJob.find().sort({ DJobId: 1 });
        return res.status(200).json({ message: "Success", data: docs });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Error fetching DJobs" });
    }
};
  
// READ (single)
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

    const doc = await DJob.create({
      DJobId,
      shift: normShift,
      degree,
      adminId,
      adminMade: Boolean(adminMade),
      facilitiesId: facilitiesId ?? 0,
      clinicianId:  clinicianId ?? 0,
      status: "pending",
    });

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

    const allowed = ["shift", "degree", "adminId", "adminMade", "facilitiesId", "clinicianId", "status"];
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