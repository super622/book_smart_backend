const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const Clinical = db.clinical;
const Facilities = db.facilities;
const Bid = db.bids;
const Job = db.jobs;
const mailTrans = require("../controllers/mailTrans.controller.js");
const moment = require('moment-timezone');
const phoneSms = require('../controllers/twilio.js');
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

const expirationTime = 10000000;

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
    console.log(`https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
}

exports.addAssignedShiftFieldToAll = async (req, res) => {
    try {
      const result = await Clinical.updateMany(
        { assignedShift: { $exists: false } },
        { $set: { assignedShift: [] } }
      );
      return res.status(200).json({ message: "Done", modified: result.modifiedCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
};

exports.clearAssignedShiftForAll = async (req, res) => {
    try {
      const filter = {
        assignedShift: { $exists: true, $type: 'array' },
        $expr: { $gt: [ { $size: "$assignedShift" }, 0 ] }
      };
  
      const result = await Clinical.updateMany(filter, { $set: { assignedShift: [] } });
  
      return res.status(200).json({
        message: "Done",
        matched: result.matchedCount ?? result.n,
        modified: result.modifiedCount ?? result.nModified
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
};


exports.getAssignedShift = async (req, res) => {
    try {
      const { userId } = req.body; // or use req.query.userId if you prefer GET
      if (userId == null) {
        return res.status(400).json({ message: "userId (AIC) is required" });
      }
  
      const aic = isNaN(Number(userId)) ? String(userId) : Number(userId);
  
      const user = await Clinical.findOne(
        { aic },
        { aic: 1, assignedShift: 1, _id: 0 }
      ).lean();
  
      if (!user) {
        return res.status(404).json({ message: "User does not exist", assignedShift: [] });
      }
  
      return res.status(200).json({
        message: "OK",
        aic: user.aic,
        assignedShift: Array.isArray(user.assignedShift) ? user.assignedShift : [],
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "An Error Occured!" });
    }
  };

exports.setStatusFromUser = async (req, res) => {
  try {
    let { userAic, assignedShiftId, status } = req.body;

    status = String(status || '').toLowerCase();
    if (!['pending', 'accept', 'reject'].includes(status)) {
      return res.status(400).json({ message: 'status must be "pending", "accept", or "reject"' });
    }

    // 1) Load user and target assignedShift row
    const aic = isNaN(Number(userAic)) ? String(userAic) : Number(userAic);
    const user = await Clinical.findOne({ aic });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.assignedShift = user.assignedShift || [];
    const row = user.assignedShift.find(r => Number(r.id) === Number(assignedShiftId));
    if (!row) return res.status(404).json({ message: 'assignedShift row not found' });

    const prev = String(row.status || 'pending');
    // Update user side (even if same, we’ll still mirror to ensure consistency)
    row.status = status;
    user.markModified('assignedShift');
    await user.save();

    // 2) Mirror to admin side using your exact linkage:
    // managerAic -> staffInfo[].aic == userAic -> shifts by adminShiftIds
    const managerAic = row.managerAic;
    // adminShiftIds might be a number or an array; normalize to array
    const adminIdsRaw = row.adminShiftIds;
    const adminIds = Array.isArray(adminIdsRaw)
      ? adminIdsRaw.map(Number)
      : (adminIdsRaw === 0 || adminIdsRaw ? [Number(adminIdsRaw)] : []);

    let adminUpdated = 0;
    if (managerAic != null && adminIds.length) {
      const manager = await Facilities.findOne({ aic: managerAic });
      if (manager) {
        const staff = (manager.staffInfo || []).find(s => Number(s.aic) === Number(aic));
        if (staff) {
          staff.shifts = staff.shifts || [];
          let touched = false;

          for (const id of adminIds) {
            const sh = staff.shifts.find(s => Number(s.id) === Number(id));
            if (sh) {
              sh.status = status; // ← set exactly to new status
              touched = true;
              adminUpdated++;
            }
          }

          if (touched) {
            manager.markModified('staffInfo');
            await manager.save();
          }
        }
      }
    }

    return res.status(200).json({
      message: 'Status synchronized',
      user: { aic, assignedShiftId: Number(assignedShiftId), from: prev, to: status },
      adminRowsUpdated: adminUpdated
    });
  } catch (err) {
    console.error('setStatusFromUser error:', err);
    return res.status(500).json({ message: 'Error updating status' });
  }
};


exports.saveFCMToken = async (req, res) => {
    try {
        const { email, token } = req.body;
    
        if (!email || !token) {
            return res.status(400).json({ message: "Email and Token is required" });
        }
    
        const user = await Clinical.findOne({ email: email });
    
        if (user) {
            const updateUser = await Clinical.updateOne({ email: email }, { $set: { fcmToken: token } });
            return res.status(200).json({ message: "Token Updated!" });
        } else {
            return res.status(404).json({ message: "User does not exist" });
        }
    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};

exports.sendMSG = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }
        
        const message = `BookSmart Shift Reminder.\n\nWe'll see you in 2 hours at XXX!\n\nPlease be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`;
        await sendNotification(token, "Reminder", message);
        return res.status(200).json({ message: "Sent!" });
    } catch (e) {
        res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};

//Regiseter Account
exports.signup = async (req, res) => {
    try {
        const lastClinician = await Clinical.find().sort({ aic: -1 }).limit(1); // Retrieve the last jobId
        const lastClinicianId = lastClinician.length > 0 ? lastClinician[0].aic : 0; // Get the last jobId value or default to 0
        const newClinicianId = lastClinicianId + 1; // Increment the last jobId by 1 to set the new jobId for the next data entry
        let response = req.body;
        response.email = response.email.toLowerCase();
        const isUser = await Clinical.findOne({ email: response.email });

        if (!isUser) {
            const subject = `Welcome to BookSmart™ - ${response.firstName} ${response.lastName}`
            const content = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: Once you are "APPROVED" you will be notified via email and can view shifts<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                <p><strong>Nurse-ID</strong>: ${newClinicianId}</p>
                <p><strong>Name</strong>: ${response.firstName} ${response.lastName}</p>
                <p><strong>Email / Login</strong><strong>:</strong> <a href="mailto:${response.email}" target="_blank">${response.email}</a></p>
                <p><strong>Password</strong>: <br></p>
                <p><strong>Phone</strong>: <a href="tel:${response.phoneNumber || ''}" target="_blank">${response.phoneNumber || ''}</a></p>
                <p>-----------------------</p>
                <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
            </div>`
            response.entryDate = new Date();
            response.aic = newClinicianId;
            response.userStatus = "pending approval";
            response.clinicalAcknowledgeTerm = false;

            if (response.photoImage.name != "") {
                const s3FileUrl = await uploadToS3(response.photoImage);
                response.photoImage.content = s3FileUrl;
            }
            
            const auth = new Clinical(response);
            let sendResult = await mailTrans.sendMail(response.email, subject, content);

            const subject2 = `BookSmart™ - Enrollment & Insurance Forms`
            const content2 = `<div id=":18t" class="a3s aiL ">
                <p>Please click the following link to fill out the enrollment forms.</p>
                <p><a href="https://med-cor.na4.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhC7jj-Qqg1kETpx-qVqvryaiJrzPVomGSSnCFCPPc_Q_VSbdCEZnNvPS7PPD1499Gg*" target="_blank">BookSmart™ Enrollment Packet</a></p>
            </div>`
            let sendResult2 = await mailTrans.sendMail(response.email, subject2, content2);

            const subject1 = `A New Caregiver ${response.firstName} ${response.lastName} - Has Registered with BookSmart™`
            const content1 = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: The caregivers will not be able to view shifts until approved by the "Administrator"<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                <p><strong>Nurse-ID</strong>: ${newClinicianId}</p>
                <p><strong>Name</strong>: ${response.firstName} ${response.lastName}</p>
                <p><strong>Email / Login</strong><strong>:</strong> <a href="mailto:${response.email}" target="_blank">${response.email}</a></p>
                <p><strong>Phone</strong>: <a href="tel:${response.phoneNumber || ''}" target="_blank">${response.phoneNumber || ''}</a></p>
                <p>-----------------------</p>
                <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
            </div>`

            // let adminMail1 = mailTrans.sendMail('support@whybookdumb.com', subject1, content1);
            // let adminMail12 = mailTrans.sendMail('info@whybookdumb.com', subject1, content1);
            // let adminMail = mailTrans.sendMail('techableteam@gmail.com', subject1, content1);
            
            const adminRecipients = [
                'support@whybookdumb.com',
                'info@whybookdumb.com',
                'techableteam@gmail.com',
                'hirokihayashi585@gmail.com'
              ];
              
              for (const email of adminRecipients) {
                await mailTrans.sendMail(email, subject1, content1);
              }

            if (sendResult) {
                await auth.save();
                const payload = {
                    email: response.email.toLowerCase(),
                    userRole: response.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                res.status(200).json({ message: "Successfully Regisetered", token: token });
            } else {
                return res.status(500).json({ msg: "Can't Register Now" });
            }
        } else {
            if (isUser.userStatus === 'activate') {
                return res.status(409).json({ msg: "The Email is already registered" })
            } else {
                return res.status(405).json({ msg: 'User not approved.'})
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(404).json({ msg: "An Error Occured!" });
    }
}

//Login Account
exports.login = async (req, res) => {
    try {
        console.log('Clinical Login started');
        const { email, password, userRole, device } = req.body;
        console.log('Login attempt:', { email: email?.toLowerCase(), userRole, passwordLength: password?.length, device });
        
        let userData = await Clinical.findOne({ email: email.toLowerCase(), password: password }, 
                                            { aic: 1, firstName: 1, lastName: 1, userRole: 1, userStatus: 1, device: 1, email: 1, phoneNumber: 1, title: 1, clinicalAcknowledgeTerm: 1, password: 1 });
        console.log('got userdata:', userData ? "Yes" : "No");
        if (userData) {
            console.log('User status:', userData.userStatus);
            if (userData.userStatus === 'activate') {

                let devices = userData.device || [];
                let phoneAuth = true;
                if (!devices.includes(device)) {
                    phoneAuth = true;
                } else {
                    phoneAuth = false;
                    await Clinical.updateOne({ email: email.toLowerCase() }, { $set: { logined: true } });
                }
                console.log('check device');
                const payload = {
                    email: userData.email,
                    userRole: userData.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                if (token) {
                    res.status(200).json({ message: "Successfully Logined!", token: token, user: userData, phoneAuth: phoneAuth });
                } else {
                    res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                res.status(402).json({message: "You are not approved! Please wait."})
            }
        } else {
            // Check if email exists
            const isExist = await Clinical.findOne({ email: email.toLowerCase() }, { email: 1, userRole: 1, password: 1 });
            console.log('Email exists check:', isExist ? "Yes" : "No");
            if (isExist) {
                console.log('Email exists but login failed. DB userRole:', isExist.userRole, 'Requested userRole:', userRole);
                console.log('Password match:', isExist.password === password);
                res.status(401).json({ message: "Login information is incorrect." })
            } else {
                console.log('Email not found in database');
                res.status(404).json({ message: "User Not Found! Please Register First." })
            }
        }
    } catch (e) {
        console.error('Clinical login error:', e);
        console.error('Error stack:', e.stack);
        return res.status(500).json({ message: "An Error Occured!", error: e.message })
    }
}

async function extractNonJobId(job) {
    const newObject = {};
    for (const [key, value] of Object.entries(job)) {
        if (key === 'email') continue;

        if (key == 'photoImage' || key == 'driverLicense' || key == 'socialCard' || key == 'physicalExam' || key == 'ppd' || key == 'mmr' || key == 'healthcareLicense' || key == 'resume' || key == 'covidCard' || key == 'bls' || key == 'hepB' || key == 'flu' || key == 'cna' || key == 'taxForm' || key == 'chrc102' || key == 'chrc103' || key == 'drug' || key == 'ssc' || key == 'copyOfTB') {
            if (value.content) {
                const s3FileUrl = await uploadToS3(value);
                newObject[key] = {
                    name: value.name,
                    type: value.type,
                    content: s3FileUrl
                };
            } else if (!value.name) {
                newObject[key] = { content: '', type: '', name: '' };
            }
        } else if (key == 'driverLicenseStatus' || key == 'socialCardStatus' || key == 'physicalExamStatus' || key == 'ppdStatus' || key == 'mmrStatus' || key == 'healthcareLicenseStatus' || key == 'resumeStatus' || key == 'covidCardStatus' || key == 'blsStatus' || key == 'hepBStatus' || key == 'fluStatus' || key == 'cnaStatus' || key == 'taxFormStatus' || key == 'chrc102Status' || key == 'chrc103Status' || key == 'drugStatus' || key == 'sscStatus' || key == 'copyOfTBStatus') {
            newObject[key] = Boolean(value);
        } else {
            newObject[key] = value;
        }
    }
    return newObject;
}

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
        const isUser = await Clinical.findOne({ email: email });
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
                    const updateUser = await Clinical.updateOne({ email: email }, { $set: { verifyCode: verifyCode, verifyTime: verifyTime } });
                    console.log(updateUser);
                    res.status(200).json({ message: "Sucess" });
                }
            }
            else {
                res.status(400).json({message: "Failde to generate VerifyCode. Please try again!"})
            }
        }
        else {
            res.status(404).json({ message: "User Not Found! Please Register First." })
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
        const isUser = await Clinical.findOne({ email: email }, { verifyTime: 1, verifyCode: 1 });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyTime) {
                return res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"})
            } else {
                if (isUser.verifyCode == verifyCode) {
                    return res.status(200).json({message: "Success to verify code."});
                } else {
                    return res.status(401).json({message: "Invalid verification code."});
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

function convertToInternationalFormat(phoneNumber) {
    // Remove all non-digit characters
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    // Check if the cleaned number has the correct length
    if (cleanedNumber.length === 10) {
        // Prepend the country code (1 for the US)
        return `+1${cleanedNumber}`;
    } else {
        throw new Error('Invalid phone number format. Expected format: (123) 123-1234');
    }
}
  
exports.phoneSms = async (req, res) => {   
    try {
        console.log("phoneNumber");
        const { phoneNumber, email } = req.body;
        const verifyPhone = convertToInternationalFormat(phoneNumber);
        console.log(verifyPhone);
        const isUser = await Clinical.findOne({ email: email }, { firstName: 1 });
        if (isUser) {
            let verifyPhoneCode = generateVerificationCode();
            // if (verifyPhone == '+16505551234') {
            //     verifyPhoneCode = '123456';
            // }
            verifyPhoneCode = '123456';
            const verifyPhoneTime = Math.floor(Date.now() / 1000) + 600;
            console.log(verifyPhoneCode);
            if (verifyPhoneCode && verifyPhoneTime) {
                const verifiedContent = `${isUser.firstName}, your verification code is here: \n ${verifyPhoneCode}`
                
                let approveResult = phoneSms.pushNotification(verifiedContent, verifyPhone);
                const updateUser = await Clinical.updateOne({ email: email }, { $set: { verifyPhoneCode: verifyPhoneCode, verifyPhoneTime: verifyPhoneTime } });
                return res.status(200).json({ message: "Sucess" });
            } else {
                return res.status(400).json({message: "Failde to generate VerifyCode. Please try again!"})
            }
        } else {
            return res.status(404).json({ message: "User Not Found! Please Register First." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.verifyPhone = async (req, res) => {
    try {
        console.log("verfyCode");
        const { verifyCode, phoneNumber, device, email } = req.body;
        console.log(verifyCode);
        const isUser = await Clinical.findOne({ verifyPhoneCode: verifyCode, email: email }, { device: 1, verifyPhoneTime: 1 });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyPhoneTime) {
                res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"})
            } else { 
                const payload = {
                    email: email,
                    userRole: 'Clinician',
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                let devices = isUser.device || [];
                devices.push(device);
                const updateUser = await Clinical.updateOne({ email: email }, { $set: { logined: true, device: devices } });
                return res.status(200).json({message: "Success to verify code.", token: token});
            }
        } else {
            return res.status(500).json({ message: "Verification code is not correct." });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        console.log("verfyCode");
        const { email, password } = req.body;
        const isUser = await Clinical.findOne({ email: email }, { email: 1 });
        if (isUser) {
            const updateUser = await Clinical.updateOne({ email: email }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
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

exports.updateUserStatus = async (req, res) => {
    try {
        const { userId, status } = req.body;
        const isUser = await Clinical.findOne({ aic: userId }, { firstName: 1, lastName: 1, email: 1 });
        if (isUser) {
            await Clinical.updateOne({ aic: userId }, { $set: { userStatus: status } });
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${isUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult2 = mailTrans.sendMail(isUser.email, verifySubject2, verifiedContent2);
            } else {
                const verifySubject3 = "BookSmart™ - Your Account Restricted"
                const verifiedContent3 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${isUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult3 = mailTrans.sendMail(isUser.email, verifySubject3, verifiedContent3);
            }
            res.status(200).json({ message: "Status has been updated" });
        } else {
            res.status(404).json({ message: "Status change failed." });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.Update = async (req, res) => {
    const request = req.body;
    const user = req.user;
    const role = req.headers.userrole || user.userRole;
    console.log(user);

    const extracted = await extractNonJobId(request);

    if (extracted.updateEmail) {
       extracted.email = extracted.updateEmail;
       delete extracted.updateEmail;
    }

    if (user) {
console.log('updating....');
console.log(extracted);
console.log(request.email, user.email);
        
        // Get existing user before update for comparison
        const existUser = await Clinical.findOne(role == "Admin" ? { email: request.email } : { email: user.email });
        
        // If terms are being accepted, get the latest published terms version and set signed date
        if (extracted.clinicalAcknowledgeTerm === true) {
            try {
                const db = require('../models');
                const latestTerms = await db.terms.findOne(
                    { type: 'clinician', status: 'published' },
                    {},
                    { sort: { publishedDate: -1 } }
                );
                if (latestTerms) {
                    extracted.clinicalTermsVersion = latestTerms.version;
                    extracted.clinicalTermsSignedDate = new Date();
                }
            } catch (termsError) {
                console.error('Error fetching latest terms version:', termsError);
                // Continue without version if error occurs
            }
        }
        
        Clinical.findOneAndUpdate(role == "Admin" ? { email: request.email } : { email: user.email }, { $set: extracted }, { new: true }, (err, updatedDocument) => {
            console.log('updated');
            if (err) {
                console.log(err);
                return res.status(500).json({ error: err });
            } else {
                console.log('sending mail');
                let updatedData = updatedDocument;

                if (role == "Admin" && existUser && extracted.userStatus == "activate" && extracted.userStatus != existUser.userStatus) {
                    console.log('Activated .........');
                    const verifySubject = "BookSmart™ - Your Account Approval"
                    const verifiedContent = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${updatedData.firstName},</p>
                        <p>Your BookSmart™ account has been approved.</p>
                    </div>`
                    let approveResult = mailTrans.sendMail(updatedData.email, verifySubject, verifiedContent);
                }
                if (role == "Admin" && existUser && extracted.userStatus == "inactivate" && extracted.userStatus != existUser.userStatus) {
                    console.log('Activated .........');
                    const verifySubject = "BookSmart™ - Your Account Restricted"
                    const verifiedContent = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${updatedData.firstName},</p>
                        <p>Your BookSmart™ account has been restricted.</p>
                    </div>`
                    let approveResult = mailTrans.sendMail(updatedData.email, verifySubject, verifiedContent);
                }
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                console.log('end');
                const token = setToken(payload);
                if (updatedData) {
                    return res.status(200).json({ message: 'Responded Successfully!', token: token, user: updatedData });
                } else {
                    return res.status(200).json({ message: 'Responded Successfully!', token: token, user: [] });
                }
            }
        })
    }
};

exports.getUserImage = async (req, res) => {
    try {
        const { userId, filename } = req.body;
        const isUser = await Clinical.findOne({ aic: userId }, { [filename]: 1 });

        return res.status(200).json({ message: "Successfully Get!", data: isUser[filename] });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getClientInfo = async (req, res) => {
    const bidId = req.body.bidId;
    const bidder = await Bid.findOne({ bidId });

    if (bidder) {
        const userInfo = await Clinical.findOne({ aic: bidder.caregiverId },
            { aic: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, address: 1, photoImage: 1,
                driverLicense: {
                    content: '',
                    name: '$driverLicense.name',
                    type: '$driverLicense.type'
                }, ssc: {
                    content: '',
                    name: '$ssc.name',
                    type: '$ssc.type'
                }, physicalExam: {
                    content: '',
                    name: '$physicalExam.name',
                    type: '$physicalExam.type'
                }, ppd: {
                    content: '',
                    name: '$ppd.name',
                    type: '$ppd.type'
                }, mmr: {
                    content: '',
                    name: '$mmr.name',
                    type: '$mmr.type'
                }, healthcareLicense: {
                    content: '',
                    name: '$healthcareLicense.name',
                    type: '$healthcareLicense.type'
                }, flu: {
                    content: '',
                    name: '$flu.name',
                    type: '$flu.type'
                }, cna: {
                    content: '',
                    name: '$cna.name',
                    type: '$cna.type'
                }, hepB: {
                    content: '',
                    name: '$hepB.name',
                    type: '$hepB.type'
                }, covidCard: {
                    content: '',
                    name: '$covidCard.name',
                    type: '$covidCard.type'
                }, bls: {
                    content: '',
                    name: '$bls.name',
                    type: '$bls.type'
                } });

        let awardedCnt = await Bid.find({ bidStatus: 'Awarded', bidId: bidId }).count();
        let appliedCnt = await Bid.find({ bidId: bidId }).count();
        let ratio = '';
        if (awardedCnt > 0 && appliedCnt > 0) {
            ratio = (100 / appliedCnt) * awardedCnt;
            ratio += '%';
        }

        let userData = {
            ...userInfo._doc,
            totalBid: appliedCnt,
            totalAward: awardedCnt,
            AwardRatio: ratio
        };

        return res.status(200).json({ message: "success", userData: userData });
    } else {
        return res.status(500).json({ message: "Not exist" });
    }
};

exports.getUserInfo = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.body;
        let isUser = await Clinical.findOne({ aic: userId }, 
            { aic: 1, firstName: 1, lastName: 1, email: 1, userStatus: 1, userRole: 1, phoneNumber: 1, title: 1, birthday: 1, socialSecurityNumber: 1, verifiedSocialSecurityNumber: 1, address: 1, password: 1, entryDate: 1, device: 1, 
                photoImage: {
                    content: '',
                    name: '$photoImage.name',
                    type: '$photoImage.type'
                }, driverLicense: {
                    content: '',
                    name: '$driverLicense.name',
                    type: '$driverLicense.type'
                }, socialCard: {
                    content: '',
                    name: '$socialCard.name',
                    type: '$socialCard.type'
                }, physicalExam: {
                    content: '',
                    name: '$physicalExam.name',
                    type: '$physicalExam.type'
                }, ppd: {
                    content: '',
                    name: '$ppd.name',
                    type: '$ppd.type'
                }, mmr: {
                    content: '',
                    name: '$mmr.name',
                    type: '$mmr.type'
                }, healthcareLicense: {
                    content: '',
                    name: '$healthcareLicense.name',
                    type: '$healthcareLicense.type'
                }, resume: {
                    content: '',
                    name: '$resume.name',
                    type: '$resume.type'
                }, covidCard: {
                    content: '',
                    name: '$covidCard.name',
                    type: '$covidCard.type'
                }, bls: {
                    content: '',
                    name: '$bls.name',
                    type: '$bls.type'
                }, flu: {
                    content: '',
                    name: '$flu.name',
                    type: '$flu.type'
                }, cna: {
                    content: '',
                    name: '$cna.name',
                    type: '$cna.type'
                }, taxForm: {
                    content: '',
                    name: '$taxForm.name',
                    type: '$taxForm.type'
                }, chrc102: {
                    content: '',
                    name: '$chrc102.name',
                    type: '$chrc102.type'
                }, chrc103: {
                    content: '',
                    name: '$chrc103.name',
                    type: '$chrc103.type'
                }, drug: {
                    content: '',
                    name: '$drug.name',
                    type: '$drug.type'
                }, ssc: {
                    content: '',
                    name: '$ssc.name',
                    type: '$ssc.type'
                }, copyOfTB: {
                    content: '',
                    name: '$copyOfTB.name',
                    type: '$copyOfTB.type'
                }, hepB: {
                    content: '',
                    name: '$hepB.name',
                    type: '$hepB.type'
                },
                driverLicenseStatus: 1, socialCardStatus: 1, physicalExamStatus: 1, ppdStatus: 1, mmrStatus: 1, healthcareLicenseStatus: 1, resumeStatus: 1, covidCardStatus: 1, blsStatus: 1, hepBStatus: 1, fluStatus: 1, cnaStatus: 1, taxFormStatus: 1, chrc102Status: 1, chrc103Status: 1, drugStatus: 1, sscStatus: 1, copyOfTBStatus: 1
            });

        if (isUser) {
            const payload = {
                email: isUser.email,
                userRole: isUser.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            };
            const token = setToken(payload);
            console.log('result')
            return res.status(200).json({ message: "Successfully retrieved", userData: isUser, token: token });
        } else {
            return res.status(404).json({ message: "User does not exist", userData: [] });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.body;
        console.log('started', userId);
        const isUser = await Clinical.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, title: 1, address: 1, photoImage: {
            content: '',
            name: '$photoImage.name',
            type: '$photoImage.type'
        } });
        console.log('got user data');
        if (isUser) {
            let awardedData = await Bid.find({ bidStatus: 'Awarded', caregiverId: userId }, { jobId: 1, entryDate: 1, facility: 1, bidStatus: 1 });
            let appliedData = await Bid.find({ caregiverId: userId }, { bidId: 1, entryDate: 1, jobId: 1, message: 1 });
            console.log('got bid data');
            let awardedCnt = await Bid.countDocuments({ bidStatus: 'Awarded', caregiverId: userId });
            let appliedCnt = await Bid.countDocuments({ caregiverId: userId });
            console.log('got bid countdata')
            let ratio = '';
            let totalJobRating = 0;
            let avgJobRating = 0;
            let awardedList = [];
            let appliedList = [];

            const jobIds = appliedData.map(item => item.jobId);
            const jobRatings = await Job.find({ jobId: { $in: jobIds } }, { jobId: 1, jobRating: 1 });
            const jobRatingMap = jobRatings.reduce((acc, job) => {
                acc[job.jobId] = job.jobRating;
                return acc;
            }, {});

            for (const item of appliedData) {
                totalJobRating += jobRatingMap[item.jobId] || 0;
            }

            for (const item of awardedData) {
                awardedList.push([
                    item.jobId,
                    item.entryDate,
                    item.facility,
                    item.bidStatus
                ]);
            }

            for (const item of appliedData) {
                appliedList.push([
                    item.bidId,
                    item.entryDate,
                    item.jobId,
                    item.message
                ]);
            }

            avgJobRating = totalJobRating / appliedCnt;

            if (awardedCnt > 0 && appliedCnt > 0) {
                ratio = (100 / appliedCnt) * awardedCnt;
                ratio += '%';
            }
            userData = {
                photoImage: isUser.photoImage,
                entryDate: isUser.entryDate,
                firstName: isUser.firstName,
                lastName: isUser.lastName,
                email: isUser.email,
                phoneNumber: isUser.phoneNumber,
                title: isUser.title,
                address: isUser.address,
                awardedCnt,
                appliedCnt,
                avgJobRating: avgJobRating ? avgJobRating : 0,
                ratio
            };
            console.log('complete processing');

            res.status(200).json({message: "Successfully get", appliedList, awardedList, userData });
        } else {
            res.status(500).json({ message: "Not exist" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getAllList = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;
        const data = await Clinical.find({});
        let dataArray = [];

        if (role === 'Admin') {
            for (const item of data) {
                dataArray.push([
                    item.firstName + " " + item.lastName,
                    item.email,
                    "Clinician",
                    item.userStatus,
                    "delete"
                ]);
            };

            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);

            if (token) {
                res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
            } else {
                res.status(400).json({ message: "Cannot logined User!" })
            }
        } else if (role === 'Clinical') {
            for (const item of data) {
                dataArray.push(item.firstName + " " + item.lastName);
            };

            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);

            if (token) {
                res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
            } else {
                res.status(400).json({ message: "Cannot logined User!" })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.allCaregivers = async (req, res) => {
    try {
        const user = req.user;
        const { search = '', page = 1, filters = [] } = req.body;
        const limit = 25;
        let perPage = page;
        const query = {};

        if (search.trim()) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { entryDate: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
            perPage = 1;
        }

        const skip = (perPage - 1) * limit;

        console.log("Search Query:", search, "Page:", perPage, "Skip: ", skip, "Query Object:", JSON.stringify(query));

        // Fetching data with pagination and allowing disk use for sorting
        const data = await Clinical.find(query, { 
                firstName: 1, lastName: 1, aic: 1, entryDate: 1, phoneNumber: 1, title: 1, email: 1, userStatus: 1 
            })
            .sort({ aic: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalRecords = await Clinical.countDocuments(query);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        let dataArray = [];

        for (const item of data) {
            let awarded = await Bid.find({ bidStatus: 'Awarded', caregiverId: item.aic }).count();
            let applied = await Bid.find({ caregiverId: item.aic }).count();
            let ratio = '';

            if (awarded > 0 && applied > 0) {
                ratio = (100 / applied) * awarded;
                ratio += '%';
            }

            dataArray.push([
                item.entryDate,
                item.firstName,
                item.lastName,
                item.phoneNumber,
                item.title,
                item.email,
                'view_shift',
                'verification',
                item.userStatus,
                awarded === 0 ? '' : awarded,
                applied === 0 ? '' : applied,
                ratio,
                'pw',
                item.aic,
            ]);
        }

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        };
        const token = setToken(payload);

        if (token) {
            res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt, token });
        } else {
            res.status(400).json({ message: "Cannot log in User!" });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

exports.clinician = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;
        const data = await Clinical.find({});
        let dataArray = [];

        if (role === 'Admin') {
            for (const item of data) {
                let awarded = await Bid.find({ bidStatus: 'Awarded', caregiver: item.firstName + ' ' + item.lastName }).count();
                let applied = await Bid.find({ caregiver: item.firstName + ' ' + item.lastName }).count();
                let ratio = '';

                if (awarded > 0 && applied > 0) {
                    ratio = (100 / applied) * awarded;
                    ratio += '%';
                }

                dataArray.push([
                    item.entryDate,
                    item.firstName,
                    item.lastName,
                    item.phoneNumber,
                    item.title,
                    item.email,
                    'view_shift',
                    'verification',
                    item.userStatus,
                    awarded == 0 ? '' : awarded,
                    applied == 0 ? '' : applied,
                    ratio,
                    'pw',
                    item.aic,
                ]);
            };

            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);

            if (token) {
                res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
            } else {
                res.status(400).json({ message: "Cannot logined User!" })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

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
