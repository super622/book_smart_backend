const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const Admin = db.admins;
const Clinical = db.clinical;
const Bid = db.bids;
const Facility = db.facilities;
const mailTrans = require("../controllers/mailTrans.controller.js");
const expirationTime = 10000000;

var dotenv = require('dotenv');
dotenv.config()

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { sendNotification } = require("../utils/firebaseService.js");

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function uploadToS3(file) {
    const { content, name, type } = file;
  
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${uuidv4()}_${name}`,
        Body: Buffer.from(content, 'base64'),
        ContentType: type
    };
  
    const command = new PutObjectCommand(params);
    const upload = await s3.send(command);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
}

exports.updateAdminsWithAId = async () => {
    try {
      const admins = await Admin.find().sort({_id: 1});
      let counter = 1;
  
      for (let admin of admins) {
        const result = await Admin.updateOne({ _id: admin._id }, { $set: { AId: counter } });
        counter++;
      }
      return res.status(200).json({ message: "Done", modified: result.modifiedCount });
    } catch (error) {
      console.log('Error adding AId:', error);
    }
};
  

exports.addShiftTypeFieldToAll = async (req, res) => {
    try {
      const result = await Admin.updateMany(
        { shiftType: { $exists: false } },
        { $set: { shiftType: [] } }
      );
      return res.status(200).json({ message: "Done", modified: result.modifiedCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
};

exports.addStaffInfoFieldToAll = async (req, res) => {
    try {
      const result = await Admin.updateMany(
        { staffInfo: { $exists: false } },         
        { $set: { staffInfo: [] } }                
      );
      return res.status(200).json({ message: "Done", modified: result.modifiedCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
};

exports.clearShiftTypeForAll = async (req, res) => {
    try {
      const filter = { shiftType: { $exists: true, $type: 'array', $ne: [] } };
  
      const result = await Admin.updateMany(filter, { $set: { shiftType: [] } });
  
      return res.status(200).json({
        message: "Done",
        matched: result.matchedCount ?? result.n,
        modified: result.modifiedCount ?? result.nModified
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
};

exports.addShiftType = async (req, res) => {
    try {
      const { AId, name, start, end } = req.body;
  
      const user = await Admin.findOne({ AId });
      if (!user) return res.status(404).json({ message: "User not found" });
  
      user.shiftType = user.shiftType || [];
  
      let maxId = 0;
      for (const shift of user.shiftType) {
        const numericId = parseInt(shift.id, 10);
        if (!isNaN(numericId) && numericId > maxId) {
          maxId = numericId;
        }
      }
  
      const newShift = {
        id: (maxId + 1).toString(),
        name,
        start,
        end
      };
  
      user.shiftType.push(newShift);
      await user.save();
  
      return res.status(200).json({ message: "Shift added", shiftType: user.shiftType });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error adding shift" });
    }
}


exports.getShiftTypes = async (req, res) => {
    try {
      const { AId } = req.body;
  
      const user = await Admin.findOne({ AId });
      if (!user) return res.status(404).json({ message: "User not found" });
  
      return res.status(200).json({ shiftType: user.shiftType || [] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching shifts" });
    }
};

exports.updateShiftType = async (req, res) => {
    try {
      const { AId, shiftId, updatedShift } = req.body;
  
      const user = await Admin.findOne({ AId });
      if (!user) return res.status(404).json({ message: "User not found" });
  
      const index = user.shiftType.findIndex(s => s.id === shiftId);
      if (index === -1) return res.status(404).json({ message: "Shift not found" });
  
      user.shiftType[index] = { ...user.shiftType[index], ...updatedShift };
      await user.save();
  
      return res.status(200).json({ message: "Shift updated", shiftType: user.shiftType });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error updating shift" });
    }
};

exports.deleteShiftType = async (req, res) => {
    try {
      const { AId, shiftId } = req.body;
  
      const user = await Admin.findOne({ AId });
      if (!user) return res.status(404).json({ message: "User not found" });
  
      user.shiftType = user.shiftType.filter(s => s.id !== shiftId);
      await user.save();
  
      return res.status(200).json({ message: "Shift deleted", shiftType: user.shiftType });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error deleting shift" });
    }
};


exports.getAcknowledgedUsers = async (req, res) => {
    try {
      const users = await Clinical.find(
        { 
            clinicalAcknowledgeTerm: true },
        {
          _id: 0,
          aic: 1,
          firstName: 1,
          lastName: 1,
          userRole: 1,
          email: 1,
          phoneNumber: 1,
          title: 1,
        }
      );
  
      return res.status(200).json({ message: "Success", users });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "An error occurred." });
    }
};

exports.addStaffToManager = async (req, res) => {
    try {
      const { managerAic, staffList } = req.body;
  
      const manager = await Admin.findOne({ AId: managerAic });
      if (!manager) return res.status(404).json({ message: "Manager not found" });
  
      manager.staffInfo = manager.staffInfo || [];
  
      // Get existing staff AICs
      const existingAics = new Set(manager.staffInfo.map(s => s.aic));
  
      // Determine current max ID
      let maxId = 0;
      for (const staff of manager.staffInfo) {
        const numericId = parseInt(staff.id, 10);
        if (!isNaN(numericId) && numericId > maxId) maxId = numericId;
      }
  
      // Only add new staff with unique AICs
      const newStaffEntries = [];
      let idCounter = maxId + 1;
  
      for (const staff of staffList) {
        if (!existingAics.has(staff.aic)) {
          newStaffEntries.push({
            id: idCounter.toString(),
            aic: staff.aic,
            firstName: staff.firstName,
            lastName: staff.lastName,
            userRole: staff.title,
            email: staff.email,
            phoneNumber: staff.phoneNumber,
            shifts: []
          });
          existingAics.add(staff.aic);
          idCounter++;
        }
      }
  
      if (newStaffEntries.length === 0) {
        return res.status(409).json({ message: "All selected staff already exist in staffInfo" });
      }
  
      manager.staffInfo.push(...newStaffEntries);
      await manager.save();
  
      return res.status(200).json({ message: "Staff added", staffInfo: manager.staffInfo });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error adding staff", error: err.message });
    }
};

exports.deleteStaffFromManager = async (req, res) => {
    try {
      const { managerAic, staffId } = req.body;
  
      const manager = await Admin.findOne({ AId: managerAic });
      if (!manager) return res.status(404).json({ message: "Manager not found" });
  
      const originalLength = manager.staffInfo.length;
  
      manager.staffInfo = manager.staffInfo.filter(s => s.id !== staffId);
      if (manager.staffInfo.length === originalLength) {
        return res.status(404).json({ message: "Staff member not found in staffInfo" });
      }
  
      await manager.save();
  
      return res.status(200).json({ message: "Staff deleted", staffInfo: manager.staffInfo });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error deleting staff", error: err.message });
    }
};

exports.getAllStaffShiftInfo = async (req, res) => {
    try {
      const { managerAic } = req.body;
  
      const manager = await Admin.findOne({ AId: managerAic });
      if (!manager) return res.status(404).json({ message: "Manager not found" });
  
      const staffInfo = manager.staffInfo || [];
  
      return res.status(200).json({
        message: "Success",
        staffInfo
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error retrieving staff info", error: err.message });
    }
};


exports.addShiftToStaff = async (req, res) => {
    try {
      const { managerAic, staffId, shifts } = req.body;
  
      // 1) Manager doc
      const manager = await Admin.findOne({ AId: managerAic });
      if (!manager) return res.status(404).json({ message: 'Manager not found' });
  
      // 2) Target staff under manager
      const staff = manager.staffInfo?.find(s => String(s.id) === String(staffId));
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
  
      // Ensure arrays exist
      staff.shifts = staff.shifts || [];
  
      // 3) Find the user by staff AIC
      const staffAic = staff.aic;
      if (staffAic == null) {
        return res.status(400).json({ message: 'Staff AIC not set in manager.staffInfo' });
      }
  
      const user = await Clinical.findOne({ aic: staffAic });
      if (!user) return res.status(404).json({ message: 'User (Clinical) not found for this staff AIC' });
  
      user.assignedShift = user.assignedShift || [];
  
      // 4) Compute current max IDs on both sides
      let adminMaxId = staff.shifts.reduce((m, sh) => Math.max(m, sh?.id || 0), 0);
      let userMaxId  = user.assignedShift.reduce((m, as) => Math.max(m, as?.id || 0), 0);
  
      const addedSummaries = [];
      let addedCount = 0;
  
      for (const raw of (shifts || [])) {
        const date = String(raw.date || '').trim();
        const time = String(raw.time || '').trim();
        if (!date || !time) continue;
  
        // De-dupe by (date, time) for this staff/manager and the same user/manager
        const existsAdmin = staff.shifts.some(
          sh => String(sh.date).trim() === date && String(sh.time).trim() === time
        );
        const existsUser = user.assignedShift.some(
          as =>
            String(as.date).trim() === date &&
            String(as.time).trim() === time &&
            String(as.managerAic) === String(managerAic)
        );
        if (existsAdmin || existsUser) continue;
  
        // Generate new IDs
        adminMaxId += 1;         // admin side shift id
        userMaxId  += 1;         // user side assignedShift id
  
        // 4a) Create admin shift (includes usershiftid + status)
        const adminShift = {
          id: adminMaxId,
          date,
          time,
          status: 'pending',
          usershiftid: userMaxId, // link to user's assignedShift id
        };
        staff.shifts.push(adminShift);
  
        // 4b) Create user assignedShift (includes admin shift id and status)
        const userAssigned = {
          id: userMaxId,
          date,
          time,
          companyName: String(manager.companyName || '').trim(),
          managerAic,
          status: 'pending',
          adminShiftIds: adminShift.id, // link back to admin shift
        };
        user.assignedShift.push(userAssigned);
  
        addedCount += 1;
        addedSummaries.push({
          date, time,
          adminShiftId: adminShift.id,
          userShiftId: userAssigned.id,
          status: 'pending',
        });
      }
  
      if (addedCount === 0) {
        return res.status(200).json({ message: 'No new shifts to add', staffInfo: manager.staffInfo });
      }
  
      // 5) Persist both docs
      manager.markModified('staffInfo');
      await manager.save();
  
      user.markModified('assignedShift');
      await user.save();
  
      return res.status(200).json({
        message: `${addedCount} shift(s) added`,
        added: addedSummaries,
        staffInfo: manager.staffInfo,
        assignedShiftCount: user.assignedShift.length,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error adding shifts' });
    }
};


exports.editShiftFromStaff = async (req, res) => {
    try {
      const { managerAic, staffId, shiftId, newDate, newTime } = req.body;
  
      const manager = await Admin.findOne({ aic: managerAic });
      if (!manager) return res.status(404).json({ message: 'Manager not found' });
  
      const staff = manager.staffInfo?.find(s => String(s.id) === String(staffId));
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
  
      staff.shifts = staff.shifts || [];
      const shift = staff.shifts.find(sh => Number(sh.id) === Number(shiftId));
      if (!shift) return res.status(404).json({ message: 'Shift not found' });
  
      const date = String(newDate || '').trim();
      const time = String(newTime || '').trim();
      if (!date || !time) return res.status(400).json({ message: 'newDate/newTime required' });
  
      // Optional: prevent duplicates after edit on admin side
      const conflict = staff.shifts.some(
        sh =>
          Number(sh.id) !== Number(shiftId) &&
          String(sh.date).trim() === date &&
          String(sh.time).trim() === time
      );
      if (conflict) return res.status(409).json({ message: 'Another shift with same date/time already exists' });
  
      // 1) Update admin side (status stays as-is)
      shift.date = date;
      shift.time = time;
      manager.markModified('staffInfo');
  
      // 2) Update user side assignedShift
      let userUpdated = false;
      let userAction = 'none';
  
      const staffAic = staff.aic;
      if (staffAic != null) {
        const user = await Clinical.findOne({ aic: staffAic });
        if (user) {
          user.assignedShift = user.assignedShift || [];
  
          // Prefer explicit backref via usershiftid
          let as =
            shift.usershiftid != null
              ? user.assignedShift.find(a => Number(a.id) === Number(shift.usershiftid))
              : null;
  
          // Fallback: match by adminShiftIds + managerAic
          if (!as) {
            as = user.assignedShift.find(
              a =>
                Array.isArray(a.adminShiftIds) &&
                a.adminShiftIds.map(Number).includes(Number(shiftId)) &&
                String(a.managerAic) === String(managerAic)
            );
          }
  
          if (as) {
            as.date = date;
            as.time = time;
            user.markModified('assignedShift');
            await user.save();
            userUpdated = true;
            userAction = 'updated assignedShift';
          }
        }
      }
  
      await manager.save();
  
      return res.status(200).json({
        message: 'Shift updated',
        staffInfo: manager.staffInfo,
        userUpdated,
        userAction,
      });
    } catch (err) {
      console.error('editShiftFromStaff error:', err);
      return res.status(500).json({ message: 'Error updating shift' });
    }
};
  

exports.deleteShiftFromStaff = async (req, res) => {
    try {
      const { managerAic, staffId, shiftId } = req.body;
  
      // 1) Manager & staff
      const manager = await Admin.findOne({ AId: managerAic });
      if (!manager) return res.status(404).json({ message: 'Manager not found' });
  
      const staff = manager.staffInfo?.find(s => String(s.id) === String(staffId));
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
  
      staff.shifts = staff.shifts || [];
      const adminIdx = staff.shifts.findIndex(sh => Number(sh.id) === Number(shiftId));
      if (adminIdx === -1) return res.status(404).json({ message: 'Shift not found or already deleted' });
  
      const shift = staff.shifts[adminIdx];          // the admin-side shift to delete
      const staffAic = staff.aic;
  
      // 2) Delete/unlink on user side
      let userUpdated = false;
      let userAction  = 'none';
  
      if (staffAic != null) {
        const user = await Clinical.findOne({ aic: staffAic });
        if (user) {
          user.assignedShift = user.assignedShift || [];
  
          // Prefer the explicit backref first
          let asIndex = -1;
          if (shift.usershiftid != null) {
            asIndex = user.assignedShift.findIndex(a => Number(a.id) === Number(shift.usershiftid));
          }
          // Fallback: find by adminShiftIds + managerAic
          if (asIndex === -1) {
            asIndex = user.assignedShift.findIndex(
              a =>
                Array.isArray(a.adminShiftIds) &&
                a.adminShiftIds.map(Number).includes(Number(shiftId)) &&
                String(a.managerAic) === String(managerAic)
            );
          }
  
          if (asIndex > -1) {
            const as = user.assignedShift[asIndex];
  
            // If this user entry links multiple admin shifts, just unlink this one.
            if (Array.isArray(as.adminShiftIds) &&
                as.adminShiftIds.map(Number).includes(Number(shiftId)) &&
                as.adminShiftIds.length > 1) {
              as.adminShiftIds = as.adminShiftIds.filter(id => Number(id) !== Number(shiftId));
              user.markModified('assignedShift');
              await user.save();
              userUpdated = true;
              userAction = 'unlinked adminShiftId from assignedShift';
            } else {
              // Otherwise remove the whole assignedShift item.
              user.assignedShift.splice(asIndex, 1);
              user.markModified('assignedShift');
              await user.save();
              userUpdated = true;
              userAction = 'deleted assignedShift';
            }
          }
        }
      }
  
      // 3) Delete on admin side
      staff.shifts.splice(adminIdx, 1);
      manager.markModified('staffInfo');
      await manager.save();
  
      return res.status(200).json({
        message: 'Shift deleted',
        staffInfo: manager.staffInfo,
        userUpdated,
        userAction,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error deleting shift' });
    }
};
  

// exports.signup = async (req, res) => {
//     try {
//         console.log("register");
//         let response = req.body;
//         const isUser = await Admin.findOne({ email: response.email.toLowerCase() });

//         if (!isUser) {
//             response.email = response.email.toLowerCase();
//             response.entryDate = new Date();
//             if (response.photoImage.name != "") {
//                 const content = Buffer.from(response.photoImage.content, 'base64');
//                 response.photoImage.content = content;
//             }
//             const auth = new Admin(response);
//             await auth.save();
//             const payload = {
//                 email: response.email,
//                 userRole: response.userRole,
//                 iat: Math.floor(Date.now() / 1000), 
//                 exp: Math.floor(Date.now() / 1000) + expirationTime
//             }
//             const token = setToken(payload);
//             res.status(201).json({ message: "Successfully Regisetered", token: token });
//         } else {
//             res.status(409).json({ message: "The Email is already registered" })
//         }
//     } catch (e) {
//         console.log(e);
//         return res.status(500).json({ message: "An Error Occured!" });
//     }
// }

exports.signup = async (req, res) => {
    try {
        console.log("register");
        let response = req.body;
        const isUser = await Admin.findOne({ email: response.email.toLowerCase() });

        if (!isUser) {
            response.email = response.email.toLowerCase();
            response.entryDate = new Date();

            // Assign the next AId
            const lastAdmin = await Admin.findOne().sort({ AId: -1 }).limit(1);
            const newAId = lastAdmin ? lastAdmin.AId + 1 : 1; // Set AId to 1 if no admin exists
            response.AId = newAId;

            if (response.photoImage.name != "") {
                const content = Buffer.from(response.photoImage.content, 'base64');
                response.photoImage.content = content;
            }
            const auth = new Admin(response);
            await auth.save();
            
            const payload = {
                email: response.email,
                userRole: response.userRole,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            }
            const token = setToken(payload);
            res.status(201).json({ message: "Successfully Registered", token: token });
        } else {
            res.status(409).json({ message: "The Email is already registered" })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};


exports.login = async (req, res) => {
    try {

        const { email, password, userRole } = req.body;
        const isUser = await Admin.findOne(
            { email: email.toLowerCase(), password: password, userRole: userRole }, 
            { email: 1, userRole: 1, firstName: 1, lastName: 1, userStatus: 1, password: 1, AId: 1 });

        if (isUser) {
            if (isUser.userStatus === 'activate') {
                const payload = {
                    email: isUser.email,
                    userRole: isUser.userRole,
                    iat: Math.floor(Date.now() / 1000), 
                    exp: Math.floor(Date.now() / 1000) + expirationTime
                }
                const token = setToken(payload);
                console.log(token);
                if (token) {
                    const updateUser = await Admin.updateOne({ email: email.toLowerCase(), userRole: userRole }, { $set: { logined: true } });
                    res.status(200).json({ message: "Successfully Logined!", token: token, user: isUser });
                } else {
                    res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                res.status(402).json({message: "You are not approved! Please wait."})
            }
        } else {
            const isExist = await Admin.findOne({ email: email.toLowerCase(), userRole: userRole });

            if (isExist) {
                res.status(401).json({ message: "Login information is incorrect." })
            } else {
                res.status(404).json({ message: "User Not Found! Please Register First." })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.getAdminInfo = async (req, res) => {
    try {
        const user = req.user;
        console.log('started');
        const { email } = req.body;

        const users = await Admin.findOne({ email });
        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        }
        const token = setToken(payload);
        if (users) {
            return res.status(200).json({ message: 'Updated', token: token, user: users });
        } else {
            return res.status(500).json({ message: 'Not Exist', token: token, user: users });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};

function generateVerificationCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
    }
    return code;
}
  
exports.forgotPassword = async (req, res) => {
    try {
        console.log("forgotPassword");
        const { email } = req.body;
        // console.log(device, 'dddd');
        const isUser = await Admin.findOne({ email: email });
        if (isUser) {
            const verifyCode = generateVerificationCode();
            const verifyTime = Math.floor(Date.now() / 1000) + 600;
            if (verifyCode && verifyTime) {
                const verifySubject = "BookSmart™ - Your verifyCode here"
                const verifiedContent = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${isUser.firstName},</p>
                    <p>Someone want to change your BookSmart™ account password.</p>
                    <p>Your verifyCode is here: ${verifyCode}</p>
                    <p>For security reasons, do not share this code with anyone.</p>
                </div>`
                
                let approveResult = mailTrans.sendMail(isUser.email, verifySubject, verifiedContent);
                if (approveResult) {
                    const updateUser = await Admin.updateOne({ email: email }, { $set: { verifyCode: verifyCode, verifyTime: verifyTime } });
                    console.log(updateUser);
                    return res.status(200).json({ message: "Sucess" });
                }
            }
            else {
                return res.status(400).json({message: "Failde to generate VerifyCode. Please try again!"})
            }
        }
        else {
            return res.status(404).json({ message: "User Not Found! Please Register First." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.verifyCode = async (req, res) => {
    try {
        console.log("verfyCode");
        const { verifyCode, email } = req.body;
        console.log(verifyCode);
        const isUser = await Admin.findOne({ email: email });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyTime) {
                return res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"})
            } else {
                if (isUser.verifyCode == verifyCode) {
                    return res.status(200).json({message: "Success to verify code."})
                } else {
                    return res.status(402).json({message: "Invalid verification code."})
                }
            }
        } else {
            res.status(404).json({ message: "User Not Found! Please Register First." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.updatePassword = async (req, res) => {
    try {
        const { userId, password, tmpPassword, userRole } = req.body;

        if (userRole == 'Clinician') {
            const isUser = await Clinical.findOne({ aic: userId });
            if (isUser) {
                const updateUser = await Clinical.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${isUser.firstName} ${isUser.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${isUser.email}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(isUser.email, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        } else if (userRole == 'Facilities') {
            const facility = await Facility.findOne({ aic: userId });
            if (facility) {
                const updateUser = await Facility.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${facility.firstName} ${facility.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${facility.contactEmail}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(facility.contactEmail, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        }

    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.resetPassword = async (req, res) => {
    try {
        console.log("verfyCode");
        const { email, password } = req.body;
        const isUser = await Admin.findOne({ email: email });
        if (isUser) {
            const updateUser = await Admin.updateOne({ email: email }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
            console.log(updateUser);
            res.status(200).json({message: "Password changed successfully."})
        }
        else {
            res.status(404).json({ message: "Password change failed." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

function extractNonJobId(job) {
    const keys = Object.keys(job);
    console.log(keys);
    
    // Filter out the key 'email'
    const nonJobIdKeys = keys.filter(key => key !== 'contactEmail');
    console.log(nonJobIdKeys);
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        newObject[key] = job[key]; // Copy each property except 'email'
    });
    
    return newObject;
}

exports.Update = async (req, res) => {
    let request = req.body;
    const user = req.user;

    if (request?.photoImage?.name) {
        const s2FileUrl = await uploadToS3(request?.photoImage);
        request.photoImage.content = s2FileUrl;
    }
    console.log(request);

    if (user) {
        Admin.findOneAndUpdate({ email: user.email } ,{ $set: request }, { new: true }, async (err, updatedDocument) => {
            console.log(err);
            if (err) {
                return res.status(500).json({ error: err });
            } else {
                console.log(updatedDocument);
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                const users = await Admin.findOne({email: request.email})
                console.log(users);
                if (users) {
                    return res.status(200).json({ message: 'Updated', token: token, user: users });
                } else {
                    return res.status(500).json({ message: 'Not Exist', token: token, user: users });
                }
            }
        })
    }
}

exports.getAllUsersList = async (req, res) => {
    try {
        const user = req.user;
        let adminDataArr = [];
        let facilityDataArr = [];
        let clinicalDataArr = [];

        const { search = '', page = 1, filters = [] } = req.body;
        const limit = 25;
        const skip = (page - 1) * limit;
        const query = {};
        const fQuery = {};

        console.log(filters);

        // filters.forEach(filter => {
        //     const { logic = 'and', field, condition, value } = filter;
        
        //     let fieldNames = [];
        
        //     // For Name, use both firstName and lastName in an OR condition
        //     if (field === 'Name') {
        //         fieldNames = ['firstName', 'lastName']; 
        //     } else if (field === 'Email') {
        //         fieldNames = ['email']; 
        //     } else if (field === 'User Roles') {
        //         fieldNames = ['userRole'];
        //     } else if (field === 'User Status') {
        //         fieldNames = ['userStatus'];
        //     }
        
        //     const conditions = [];
        
        //     fieldNames.forEach(fieldName => {
        //         let conditionObj = {};
        //         switch (condition) {
        //             case 'is':
        //                 conditionObj[fieldName] = value;
        //                 break;
        //             case 'is not':
        //                 conditionObj[fieldName] = { $ne: value };
        //                 break;
        //             case 'contains':
        //                 conditionObj[fieldName] = { $regex: value, $options: 'i' };
        //                 break;
        //             case 'does not contain':
        //                 conditionObj[fieldName] = { $not: { $regex: value, $options: 'i' } };
        //                 break;
        //             case 'starts with':
        //                 conditionObj[fieldName] = { $regex: '^' + value, $options: 'i' };
        //                 break;
        //             case 'ends with':
        //                 conditionObj[fieldName] = { $regex: value + '$', $options: 'i' };
        //                 break;
        //             case 'is blank':
        //                 conditionObj[fieldName] = { $exists: false };
        //                 break;
        //             case 'is not blank':
        //                 conditionObj[fieldName] = { $exists: true, $ne: null };
        //                 break;
        //             default:
        //                 break;
        //         }
        //         conditions.push(conditionObj); // Collect conditions for the field
        //     });
        
        //     // If the field is Name, apply OR logic between firstName and lastName
        //     if (field === 'Name') {
        //         query.$or = query.$or ? [...query.$or, ...conditions] : conditions;
        //     } else {
        //         // Apply AND or OR logic for other fields based on the `logic` parameter
        //         if (logic === 'or') {
        //             query.$or = query.$or ? [...query.$or, ...conditions] : conditions;
        //         } else {
        //             query.$and = query.$and ? [...query.$and, ...conditions] : conditions;
        //         }
        //     }
        // });
        
        // filters.forEach(filter => {
        //     const { logic = 'and', field, condition, value } = filter;
        
        //     let fieldNames = [];
        
        //     // For Name, use both firstName and lastName in an OR condition
        //     if (field === 'Name') {
        //         fieldNames = ['firstName', 'lastName'];
        //     } else if (field === 'Email') {
        //         fieldNames = ['contactEmail']; // For contactEmail
        //     } else if (field === 'User Roles') {
        //         fieldNames = ['userRole'];
        //     } else if (field === 'User Status') {
        //         fieldNames = ['userStatus'];
        //     }
        
        //     const conditions = [];
        
        //     fieldNames.forEach(fieldName => {
        //         let conditionObj = {};
        //         switch (condition) {
        //             case 'is':
        //                 conditionObj[fieldName] = value;
        //                 break;
        //             case 'is not':
        //                 conditionObj[fieldName] = { $ne: value };
        //                 break;
        //             case 'contains':
        //                 conditionObj[fieldName] = { $regex: value, $options: 'i' };
        //                 break;
        //             case 'does not contain':
        //                 conditionObj[fieldName] = { $not: { $regex: value, $options: 'i' } };
        //                 break;
        //             case 'starts with':
        //                 conditionObj[fieldName] = { $regex: '^' + value, $options: 'i' };
        //                 break;
        //             case 'ends with':
        //                 conditionObj[fieldName] = { $regex: value + '$', $options: 'i' };
        //                 break;
        //             case 'is blank':
        //                 conditionObj[fieldName] = { $exists: false };
        //                 break;
        //             case 'is not blank':
        //                 conditionObj[fieldName] = { $exists: true, $ne: null };
        //                 break;
        //             default:
        //                 break;
        //         }
        //         conditions.push(conditionObj);
        //     });
        
        //     // If the field is Name, apply OR logic between firstName and lastName
        //     if (field === 'Name') {
        //         fQuery.$or = fQuery.$or ? [...fQuery.$or, ...conditions] : conditions;
        //     } else {
        //         // Apply AND or OR logic for other fields based on the `logic` parameter
        //         if (logic === 'or') {
        //             fQuery.$or = fQuery.$or ? [...fQuery.$or, ...conditions] : conditions;
        //         } else {
        //             fQuery.$and = fQuery.$and ? [...fQuery.$and, ...conditions] : conditions;
        //         }
        //     }
        // });
        
        // Check the final queries
        console.log(query);
        console.log(fQuery);
        

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { userRole: { $regex: search, $options: 'i' } }
            ];
            fQuery.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { contactEmail: { $regex: search, $options: 'i' } },
                { userRole: { $regex: search, $options: 'i' } }
            ];
        }

        const adminData = await Admin.find(query, { firstName: 1, lastName: 1, email: 1, userRole: 1, userStatus: 1 });
        const facilityData = await Facility.find(fQuery, { firstName: 1, lastName: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1 });
        const clinicalData = await Clinical.find(query, { firstName: 1, lastName: 1, email: 1, userRole: 1, userStatus: 1 });

        console.log('got all list');

        adminData.forEach(item => {
            adminDataArr.push([
                `${item.firstName} ${item.lastName}`,
                item.email,
                item.userRole,
                "",
                item.userStatus,
                "delete"
            ]);
        });

        facilityData.forEach(item => {
            facilityDataArr.push([
                `${item.firstName} ${item.lastName}`,
                item.contactEmail,
                item.userRole,
                item.companyName,
                item.userStatus,
                "delete"
            ]);
        });

        clinicalData.forEach(item => {
            clinicalDataArr.push([
                `${item.firstName} ${item.lastName}`,
                item.email,
                item.userRole,
                "",
                item.userStatus,
                "delete"
            ]);
        });

        const combinedList = [...adminDataArr, ...facilityDataArr, ...clinicalDataArr];
        const totalRecords = combinedList.length;
        const userList = combinedList.slice(skip, skip + limit);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };
        const token = setToken(payload);

        if (token) {
            res.status(200).json({ message: "Successfully Get!", userList, totalPageCnt, token });
        } else {
            res.status(400).json({ message: "Cannot log in User!" });
        }
    } catch (e) {
        res.status(500).json({ message: "An error occurred", error: e.message });
    }
};

//Get All Data
exports.admin = async (req, res) => {
    try {
        // console.log("shifts");
        const user = req.user;
        const role = req.headers.role;
        // console.log('role------', req.headers.role);
        const data = await Admin.find({});
        // console.log("data---++++++++++++++++++++++++>", data)
        let dataArray = [];
        if (role === 'Admin') {
            data.map((item, index) => {
                dataArray.push([
                item.phone,
                item.firstName,
                item.lastName,
                item.companyName,
                item.email,
                item.userStatus,
                item.userRole])
            })
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
        // console.log('token----------------------------------------------------->',token);
        if (token) {
            // const updateUser = await Job.updateOne({email: email, userRole: userRole}, {$set: {logined: true}});
            res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
        }
        else {
            res.status(400).json({ message: "Cannot logined User!" })
        }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

function extractNonJobId(job, mail) {
    const keys = Object.keys(job);
    console.log(keys);
    
    // Filter out the key 'email'
    const nonJobIdKeys = keys.filter(key => key !== mail);
    console.log(nonJobIdKeys);
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        newObject[key] = job[key]; // Copy each property except 'email'
    });
    
    return newObject;
}

exports.updateUserInfo = async (req, res) => {
    const email = req.body.userEmail;
    const userRole = req.body.userRole;
    const status = req.body.status;
    const password = req.body.password;

    if (userRole === 'Admin') {
        const adminUser = await Admin.findOne({ email });

        await Admin.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await Admin.updateOne({ email }, {$set: { password }});
            const verifySubject7 = "BookSmart™ - Your password has been changed"
            const verifiedContent7 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${adminUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult7 = mailTrans.sendMail(updatedDocument.email, verifySubject7, verifiedContent7);
        }

        if (adminUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject8 = "BookSmart™ - Your Account Approval"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${adminUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(adminUser.email, verifySubject8, verifiedContent8);
            } else {
                const verifySubject9 = "BookSmart™ - Your Account Restricted"
                const verifiedContent9 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${adminUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult9 = mailTrans.sendMail(adminUser.email, verifySubject9, verifiedContent9);
            }
        }
    } else if (userRole === 'Clinician') {
        const clientUser = await Clinical.findOne({ email });

        await Clinical.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await Clinical.updateOne({ email }, {$set: { password }});

            console.log(email, password, clientUser);
            const verifySubject1 = "BookSmart™ - Your password has been changed"
            const verifiedContent1 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${clientUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult1 = mailTrans.sendMail(clientUser.email, verifySubject1, verifiedContent1);
        }

        if (clientUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${clientUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult2 = mailTrans.sendMail(clientUser.email, verifySubject2, verifiedContent2);
            } else {
                const verifySubject3 = "BookSmart™ - Your Account Restricted"
                const verifiedContent3 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${clientUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult3 = mailTrans.sendMail(clientUser.email, verifySubject3, verifiedContent3);
            }
        }
    } else if (userRole === 'Facilities') {
        const facilityUser = await Facility.findOne({ contactEmail: email });

        await Facility.updateOne({ contactEmail: email }, {$set: { userStatus: status }});

        if (password != '') {
            await Facility.updateOne({ contactEmail: email }, {$set: { password }});
            const verifySubject4 = "BookSmart™ - Your password has been changed"
            const verifiedContent4 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${facilityUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult4 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject4, verifiedContent4);
        }

        if (facilityUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject5 = "BookSmart™ - Your Account Approval"
                const verifiedContent5 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${facilityUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult5 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject5, verifiedContent5);
            } else {
                const verifySubject6 = "BookSmart™ - Your Account Restricted"
                const verifiedContent6 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${facilityUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult6 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject6, verifiedContent6);
            }
        }
    }
    return res.status(200).json({ message: 'User information has been updated' });
};

//Update Users Account
exports.UpdateUser = async (req, res) => {
    console.log('updateSignalUser');
    const request = req.body;
    const user = req.user;
    console.log("user", request);
    const userRole = request.updateData.userRole;
    const fakeUserRole = request.userRole;
    if (userRole === fakeUserRole) {
        if (userRole === 'Admin') {
            const extracted = extractNonJobId(request.updateData, 'email');
            console.log(extracted, "Extracted")
            if (extracted.updateEmail) {
               extracted.email =extracted.updateEmail; // Create the new property
               delete extracted.updateEmail;
            }
            Admin.findOneAndUpdate({ email: request.updateData.email, userRole: 'Admin' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    console.log(token);
                    const users = await Admin.findOne({email: extracted.email})
                    console.log(users);
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        } else if (userRole === 'Facilities') {
            const extracted = extractNonJobId(request.updateData, 'contactEmail');
            if (extracted.updateEmail) {
                extracted.contactEmail =extracted.updateEmail; // Create the new property
                delete extracted.updateEmail;
             }
            console.log(extracted, userRole)
            Facility.findOneAndUpdate({ contactEmail: request.updateData.contactEmail, userRole: 'Facilities' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    // console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    const users = await Facility.findOne({email: extracted.email})
                    console.log('success');
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        } else if (userRole === 'Clinician') {
            const extracted = extractNonJobId(request.updateData, 'email');
            if (extracted.updateEmail) {
               extracted.email =extracted.updateEmail; // Create the new property
               delete extracted.updateEmail;
            }
            console.log(extracted, userRole)
            Clinical.findOneAndUpdate({ email: request.updateData.email, userRole: 'Clinician' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    // console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    const users = await Admin.findOne({email: extracted.email})
                    console.log(token);
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        }
    } 
    else {
        if (userRole === 'Admin') {
            const auth = new Admin(request.updateData);
            console.log(auth, userRole)
            let phone = '';
            let password = '';
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.findOne({ contactEmail: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.contactPhone;
                }
            } else {
                const result = await Clinical.findOne({ email: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.phoneNumber;
                    console.log('++++++++++++++++++', password, phone);
                }
            }
            auth.phone=phone;
            auth.password = password;
            auth.save();
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.deleteOne({ contactEmail: auth.email });
            } else {
                const result = await Clinical.deleteOne({ email: auth.email });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        } else if (userRole === 'Facilities') {
            console.log('Facility-------------------------------');
            const auth = new Facility(request.updateData);
            let contactPhone = '';
            let password = '';
            if (fakeUserRole === 'Admin') {
                const result = await Admin.findOne({ email: auth.contactEmail });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    contactPhone = result.phone;
                }
            } else {
                const result = await Clinical.findOne({ email: auth.contactEmail });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    contactPhone = result.phoneNumber;
                    console.log('++++++++++++++++++', password, contactPhone);
                }
            }
            // auth.email=auth.contactEmail
            auth.contactPhone=contactPhone;
            auth.password = password;

            console.log(auth, userRole)
            await auth.save();
            if (fakeUserRole === 'Admin') {
                const result = await Admin.deleteOne({ email: auth.contactEmail });
            } else {
                const result = await Clinical.deleteOne({ email: auth.contactEmail });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        } else if (userRole === 'Clinician') {
            let auth = new Clinical(request.updateData);
            let phone = '';
            let password = '';
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.findOne({ contactEmail: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.contactPhone;
                }
                // auth.email=auth.contactEmail
                console.log('++++++++++++++++++', password, phone);
            } else {
                const result = await Admin.findOne({ email: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.phone;
                }
            }
            auth.phoneNumber=phone;
            auth.password = password;
            console.log(auth, userRole)
            await auth.save();
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.deleteOne({ contactEmail: auth.email });
            } else {
                const result = await Admin.deleteOne({ email: auth.email });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        }
        else {
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        }

    }
}

exports.getBidIDs = async (req, res) => {
    try {
        // Find clinical and facility data
        const bidders = await Bid.find({}, { bidId: 1 });
    
        // Combine the names into one array
        const bidList = [
            ...bidders.map(item => item.bidId),
        ];

        return res.status(200).json({ message: "success", bidList });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

exports.getAllUsersName = async (req, res) => {
    try {
        // Find clinical and facility data
        const clinicals = await Clinical.find({}, { firstName: 1, lastName: 1 });
        const facilities = await Facility.find({}, { firstName: 1, lastName: 1 });
    
        // Combine the names into one array
        const combinedNames = [
            ...clinicals.map(clinical => `${clinical.firstName} ${clinical.lastName}`),
            ...facilities.map(facility => `${facility.firstName} ${facility.lastName}`)
        ];
    
        // Sort the combined names alphabetically
        combinedNames.sort((a, b) => a.localeCompare(b));
        return res.status(200).json({ message: "success", userList: combinedNames });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

//Logout Account
exports.logout = async (req, res) => {
    try {
        console.log('Logout');
        const email = req.body;
        const logoutUser = await Auth.updateOne({ accountId: accountId }, { $set: { logined: false } });
        res.status(200).json({ email: email, logined: logined })
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}


exports.removeAccount = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (role == 'Admin') {
            await Admin.deleteOne({ email: email });
        } else if (role == 'Clinician') {
            await Clinical.deleteOne({ email: email });
        } else if(role == 'Facilities') {
            await Facility.deleteOne({ contactEmail: email });
        }
        return res.status(200).json({ message: "Success" });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { caregiverIds = [], message, type = "" } = req.body;
        
        if (caregiverIds.length == 0) {
            return res.status(400).json({ message: "Caregiver is required" });
        }

        let caregivers = [];

        if (type === "All") {
            caregivers = await db.clinical.find({}, { fcmToken: 1, aic: 1 });
        } else if (type !== "") {
            caregivers = await db.clinical.find({ title: type }, { fcmToken: 1, aic: 1 });
        } else {
            caregivers = await db.clinical.find(
                { aic: { $in: caregiverIds } },
                { fcmToken: 1, aic: 1 }
            );
        }

        const includedAICs = new Set(caregivers.map(c => c.aic));
        const missingIds = caregiverIds.filter(id => !includedAICs.has(id));

        if (missingIds.length > 0) {
            const missingCaregivers = await db.clinical.find(
                { aic: { $in: missingIds } },
                { fcmToken: 1, aic: 1 }
            );
            caregivers = caregivers.concat(missingCaregivers);
        }

        await Promise.all(
            caregivers.map(async (caregiver) => {
                await sendNotification(caregiver.fcmToken, "Notice!", message);
            })
        );
        return res.status(200).json({ message: "Sent!" });
    } catch (e) {
        res.status(500).json({
            message: "Server error",
            error: e.message,
        });
    }
};