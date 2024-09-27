const jwtEncode = require('jwt-encode')
const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const { set } = require('mongoose');
const Clinical = db.clinical;
const Bid = db.bids;
const Job = db.jobs;
const nodemailer = require('nodemailer');
const mailTrans = require("../controllers/mailTrans.controller.js");
const { verify } = require('jsonwebtoken');
const moment = require('moment');
const twilios = require('../controllers/twilio.js');
const phoneSms = require('../controllers/twilio.js');

const limitAccNum = 100;
const expirationTime = 10000000;
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
                <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
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
                const content = Buffer.from(response.photoImage.content, 'base64');
                response.photoImage.content = content;
            }
            
            const auth = new Clinical(response);
            let sendResult = mailTrans.sendMail(response.email, subject, content);
            const subject2 = `BookSmart™ - Enrollment & Insurance Forms`
            const content2 = `<div id=":18t" class="a3s aiL ">
                <p>Please click the following link to fill out the enrollment forms.</p>
                <p><a href="https://med-cor.na4.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhC7jj-Qqg1kETpx-qVqvryaiJrzPVomGSSnCFCPPc_Q_VSbdCEZnNvPS7PPD1499Gg*" target="_blank">BookSmart™ Enrollment Packet</a></p>
            </div>`
            let sendResult2 = mailTrans.sendMail(response.email, subject2, content2);

            const subject1 = `A New Caregiver ${response.firstName} ${response.lastName} - Has Registered with BookSmart™`
            const content1 = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: The caregivers will not be able to view shifts until approved by the "Administrator"<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
                <p><strong>Nurse-ID</strong>: ${newClinicianId}</p>
                <p><strong>Name</strong>: ${response.firstName} ${response.lastName}</p>
                <p><strong>Email / Login</strong><strong>:</strong> <a href="mailto:${response.email}" target="_blank">${response.email}</a></p>
                <p><strong>Phone</strong>: <a href="tel:${response.phoneNumber || ''}" target="_blank">${response.phoneNumber || ''}</a></p>
                <p>-----------------------</p>
                <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
            </div>`
            let adminMail1 = mailTrans.sendMail('support@whybookdumb.com', subject1, content1);
            let adminMail12 = mailTrans.sendMail('info@whybookdumb.com', subject1, content1);
            let adminMail = mailTrans.sendMail('techableteam@gmail.com', subject1, content1);

            if (sendResult) {
                // const delay = Math.floor(Math.random() * (300000 - 180000 + 1)) + 180000; // Random delay between 3-5 minutes
                // console.log(`Next action will be performed in ${delay / 1000} seconds`);
                // setTimeout(async () => {
                // // Your next action here
                // console.log('Next action is being performed now');
                // let approveResult = mailTrans.sendMail(response.email, verifySubject, verifiedContent);
                // if (approveResult) {
                    await auth.save();
                // }
                // }, delay)
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
    console.log('start backend')
    try {
        const { email, password, userRole, device } = req.body;
        let userData = await Clinical.findOne({ email: email.toLowerCase(), password: password });

        if (userData) {
            if (userData.userStatus === 'activate') {
                const payload = {
                    email: userData.email,
                    userRole: userData.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                let devices = userData.device || [];
                let phoneAuth = true;
                if (!devices.includes(device)) {
                    devices.push(device); // Only push if it's not already present
                    phoneAuth = true;
                } else {
                    phoneAuth = false;
                    const updateUser = await Clinical.updateOne({ email: email.toLowerCase() }, { $set: { logined: true } });
                }

                if (token) {
                    res.status(200).json({ message: "Successfully Logined!", token: token, user: userData, phoneAuth: phoneAuth, device: device });
                } else {
                    res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                res.status(402).json({message: "You are not approved! Please wait."})
            }
        } else {
            const isExist = await Clinical.findOne({ email: email.toLowerCase() });
            console.log('isExist => ', typeof isExist);

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

function extractNonJobId(job) {
    const keys = Object.keys(job);
    // console.log(keys);
    
    // Filter out the key 'email'
    const nonJobIdKeys = keys.filter(key => key !== 'email');
    // console.log(nonJobIdKeys);
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        if (key == 'photoImage' || key == 'driverLicense' || key == 'socialCard' || key == 'physicalExam' || key == 'ppd' || key == 'mmr' || key == 'healthcareLicense' || key == 'resume' || key == 'covidCard' || key == 'bls' || key == 'hepB' || key == 'flu' || key == 'cna' || key == 'taxForm' || key == 'chrc102' || key == 'chrc103' || key == 'drug' || key == 'ssc' || key == 'copyOfTB') {
            let file = job[key];
            if (file.content) {
                file.content = Buffer.from(file.content, 'base64');
            } 
            newObject[key] = file;
        } else if (key == 'driverLicenseStatus' || key == 'socialCardStatus' || key == 'physicalExamStatus' || key == 'ppdStatus' || key == 'mmrStatus' || key == 'healthcareLicenseStatus' || key == 'resumeStatus' || key == 'covidCardStatus' || key == 'blsStatus' || key == 'hepBStatus' || key == 'fluStatus' || key == 'cnaStatus' || key == 'taxFormStatus' || key == 'chrc102Status' || key == 'chrc103Status' || key == 'drugStatus' || key == 'sscStatus' || key == 'copyOfTBStatus') {
            newObject[key] = job[key] == 1 ? true : false;
        } else {
            newObject[key] = job[key];
        }
    });
    
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
        const { verifyCode } = req.body;
        console.log(verifyCode);
        const isUser = await Clinical.findOne({ verifyCode: verifyCode });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyTime) {
                res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"})
            }
            else {
                res.status(200).json({message: "Success to verify code."})
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
    // try {
    //     console.log("forgotPassword");
    //     const { phoneNumber } = req.body;
    //     console.log(phoneNumber);
    //     const verifyPhone = convertToInternationalFormat(phoneNumber);
    //     console.log(verifyPhone);
    //     console.log(device, 'dddd');
    //     let verify = await twilios.createVerification(verifyPhone);
    //     res.status(200).json({ message: "Sucess" });
    // } catch (e) {
    //     console.log(e);
    //     return res.status(500).json({ message: "An Error Occured!" })
    // }    
    try {
        console.log("phoneNumber");
        const { phoneNumber, email } = req.body;
        // console.log(device, 'dddd');
        const verifyPhone = convertToInternationalFormat(phoneNumber);
        const isUser = await Clinical.findOne({ email: email });
        if (isUser) {
            const verifyPhoneCode = generateVerificationCode();
            const verifyPhoneTime = Math.floor(Date.now() / 1000) + 600;
            if (verifyPhoneCode && verifyPhoneTime) {
                const verifiedContent = `${isUser.firstName},Your verifyPhoneCode is here: \n ${verifyPhoneCode}`
                
                let approveResult = phoneSms.pushNotification(verifiedContent, verifyPhone);
                const updateUser = await Clinical.updateOne({ email: email }, { $set: { verifyPhoneCode: verifyPhoneCode, verifyPhoneTime: verifyPhoneTime } });
                console.log(updateUser);
                res.status(200).json({ message: "Sucess" });
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

// const testVerifyCode = '123156'
exports.verifyPhone = async (req, res) => {
    // try {
    //     console.log("verfyCode");
    //     const { verifyCode, phoneNumber, device, email } = req.body;
    //     console.log(verifyCode);
    //     console.log(phoneNumber);
    //     const verifyPhone = convertToInternationalFormat(phoneNumber);
    //     console.log(verifyPhone);
    //     let checkVerify = await twilios.createVerificationCheck(verifyPhone, verifyCode);
        
    //     // if (verifyCode === testVerifyCode) {
    //         res.status(200).json({message: 'success'})
    //         const isUser = await Clinical.findOne({ email: email, userRole: 'Clinician' });
    //         if (isUser) {
    //             const devices = isUser.device;
                // devices.push(device);
    //             const updateUser = await Clinical.updateOne({ email: email, userRole: userRole }, { $set: { logined: true, device: devices } });
    //             
    //         }
    //     // }
    // } catch (e) {
    //     console.log(e);
    //     return res.status(500).json({ message: "An Error Occured!" })
    // }    
    try {
        console.log("verfyCode");
        const { verifyCode, phoneNumber, device, email } = req.body;
        console.log(verifyCode);
        const isUser = await Clinical.findOne({ verifyPhoneCode: verifyCode, email: email });
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
                
                const devices = isUser.device;
                devices.push(device)
                const updateUser = await Clinical.updateOne({ email: email }, { $set: { logined: true, device: devices } });
                res.status(200).json({message: "Success to verify code.", token: token})
            }
        } else {
            res.status(500).json({ message: "Verification code is not correct." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.resetPassword = async (req, res) => {
    try {
        console.log("verfyCode");
        const { email, password } = req.body;
        const isUser = await Clinical.findOne({ email: email });
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
        const isUser = await Clinical.findOne({ aic: userId });
        if (isUser) {
            await Clinical.updateOne({ aic: userId }, { $set: { userStatus: status } });
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${isUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                    <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
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

//Update Account
exports.Update = async (req, res) => {
    console.log('updateSignal');
    const request = req.body;
    // console.log(request, req.headers, req.headers.userrole);
    const user = req.user;
    const role = req.headers.userrole ? req.headers.userrole : user.userRole;
    const extracted = extractNonJobId(request);
    // console.log(extracted)
    if (extracted.updateEmail) {
       extracted.email =extracted.updateEmail; // Create the new property
       delete extracted.updateEmail;
    }

    const existUser = await Clinical.findOne(role == "Admin" ? { email: request.email } : { email: user.email });

    if (user) {
        console.log("items", user.email + ",   role = " + role);
        Clinical.findOneAndUpdate(role=="Admin" ? { email: request.email, userRole: 'Clinician' } : { email: user.email }, role == "Admin" ? { $set: extracted } : { $set: request }, { new: false }, (err, updatedDocument) => {
            if (err) {
                return res.status(500).json({ error: err });
            } else {
                let updatedData = updatedDocument;

                if (role == "Admin" && extracted.userStatus == "activate" && extracted.userStatus != existUser.userStatus) {
                    console.log('Activated .........');
                    const verifySubject = "BookSmart™ - Your Account Approval"
                    const verifiedContent = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${updatedData.firstName},</p>
                        <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                        <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                    </div>`
                    let approveResult = mailTrans.sendMail(updatedData.email, verifySubject, verifiedContent);
                }
                if (role == "Admin" && extracted.userStatus == "inactivate" && extracted.userStatus != existUser.userStatus) {
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
                if (role != 'Admin') {
                    const token = setToken(payload);
                    if (updatedData) {
                        res.status(200).json({ message: 'Responded Successfully!', token: token, user: updatedData });
                    }
                } else {
                    if (updatedData) {
                        res.status(200).json({ message: 'Responded Successfully!', user: updatedData });
                    }
                }
            }
        })
    }
};

exports.getClientInfo = async (req, res) => {
    const bidId = req.body.bidId;
    const bidder = await Bid.findOne({ bidId });

    if (bidder) {
        const [firstName, lastName] = bidder.caregiver.split(' ');
        const UserInfo = await Clinical.findOne({ firstName, lastName });
        console.log(UserInfo);
        return res.status(200).json({ message: "success", userData: UserInfo });
    } else {
        return res.status(500).json({ message: "Not exist" });
    }
};

exports.getUserInfo = async (req, res) => {
    try {
        const { userId } = req.body;
        const isUser = await Clinical.findOne({ aic: userId });
        if (isUser) {
            res.status(200).json({message: "Successfully get", userData: isUser });
        } else {
            res.status(500).json({ message: "Not exist", userData: [] });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.body;
        const isUser = await Clinical.findOne({ aic: userId });
        if (isUser) {
            let awardedData = await Bid.find({ bidStatus: 'Awarded', caregiver: isUser.firstName + ' ' + isUser.lastName });
            let appliedData = await Bid.find({ caregiver: isUser.firstName + ' ' + isUser.lastName });

            let awardedCnt = await Bid.find({ bidStatus: 'Awarded', caregiver: isUser.firstName + ' ' + isUser.lastName }).count();
            let appliedCnt = await Bid.find({ caregiver: isUser.firstName + ' ' + isUser.lastName }).count();
            let ratio = '';
            let totalJobRating = 0;
            let avgJobRating = 0;
            let awardedList = [];
            let appliedList = [];

            for (const item of appliedData) {
                let rating = await Job.findOne({ jobId: item.jobId });
                totalJobRating += rating.jobRating;
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
                avgJobRating,
                ratio
            };

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
        const { search = '', page = 1 } = req.body;
        const limit = 5;
        const skip = (page - 1) * limit;
        const query = {};

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const data = await Clinical.find(query)
            .skip(skip)
            .limit(limit)
            .lean();
  
        // Count total number of documents matching the query
        const totalRecords = await Clinical.countDocuments(query);
        const totalPageCnt = Math.ceil(totalRecords / limit);
      
        let dataArray = [];

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
        };
        const token = setToken(payload);

        if (token) {
            res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt, token });
        } else {
            res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
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
