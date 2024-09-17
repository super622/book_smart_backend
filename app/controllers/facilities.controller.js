const jwtEncode = require('jwt-encode')
const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const { set } = require('mongoose');
const { generateInvoice } = require('../utils/pdfGenerator');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const path = require('path');
const { generatePDF } = require('../utils/pdf');
const Facility = db.facilities;
const mailTrans = require("../controllers/mailTrans.controller.js");

const limitAccNum = 100;
const expirationTime = 10000000;
//Register Account
exports.signup = async (req, res) => {
    try {
        console.log("register");
        let response = req.body;
        const isUser = await Facility.findOne({ contactEmail: response.contactEmail.toLowerCase() });

        if (!isUser) {
            const subject = `Welcome to BookSmart™`
            const content = `<div id=":18t" class="a3s aiL ">
                <p>Thank you for registering as a Facility User!</p>
                <p>Your request has been submitted and you will be notified as soon as your access is approved.</p>
            </div>`
            response.entryDate = new Date();
            response.userStatus = "pending approval";
            response.contactEmail = response.contactEmail.toLowerCase();
            const auth = new Facility(response);

            let sendResult = mailTrans.sendMail(response.contactEmail, subject, content);

            const subject1 = `A New Facility ${response.firstName} ${response.lastName} - Has Registered with BookSmart™`
            const content1 = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: The facility will not be able to view shifts until approved by the "Administrator"<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
                <p><strong>Name</strong>: ${response.firstName} ${response.lastName}</p>
                <p><strong>Email / Login</strong><strong>:</strong> <a href="mailto:${response.contactEmail}" target="_blank">${response.contactEmail}</a></p>
                <p><strong>Phone</strong>: <a href="tel:${response.contactPhone || ''}" target="_blank">${response.contactPhone || ''}</a></p>
                <p>-----------------------</p>
                <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
            </div>`
            let adminMail1 = mailTrans.sendMail('support@whybookdumb.com', subject1, content1);
            let adminMail = mailTrans.sendMail('techableteam@gmail.com', subject1, content1);

            if (sendResult) {
                await auth.save();
                const payload = {
                    email: response.contactEmail,
                    userRole: response.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                return res.status(200).json({ msg: "Successfully Registered", token: token });
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
        console.log("LogIn");
        const { contactEmail, password, userRole } = req.body;
        const isUser = await Facility.findOne({ contactEmail: contactEmail.toLowerCase(), password: password, userRole: userRole });
        console.log(isUser);
        if (isUser) {
            if (isUser.userStatus === 'activate') {
                const payload = {
                    contactEmail: isUser.contactEmail,
                    userRole: isUser.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                if (token) {
                    res.status(200).json({ message: "Successfully Logined!", token: token, user: isUser });
                } else {
                    res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                res.status(402).json({message: "You are not approved! Please wait until the admin accept you."})
            }
        } else {
            const isExist = await Facility.findOne({ contactEmail: contactEmail.toLowerCase(), userRole: userRole });
      
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
        const { contactEmail } = req.body;
        // console.log(device, 'dddd');
        const isUser = await Facility.findOne({ contactEmail: contactEmail });
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
                
                let approveResult = mailTrans.sendMail(isUser.contactEmail, verifySubject, verifiedContent);
                const updateUser = await Facility.updateOne({ contactEmail: contactEmail }, { $set: { verifyCode: verifyCode, verifyTime: verifyTime } });
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


exports.verifyCode = async (req, res) => {
    try {
        console.log("verfyCode");
        const { verifyCode } = req.body;
        console.log(verifyCode);
        const isUser = await Facility.findOne({ verifyCode: verifyCode });
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


exports.resetPassword = async (req, res) => {
    try {
        console.log("verfyCodeEmail");
        const { contactEmail, password } = req.body;
        console.log(contactEmail, '-------');
        const isUser = await Facility.findOne({ contactEmail: contactEmail });
        if (isUser) {
            const updateUser = await Facility.updateOne({ contactEmail: contactEmail }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
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
//Update Account
exports.Update = async (req, res) => {
    console.log('updateSignal');
    const request = req.body;
    const user = req.user;
    const role = request.userRole || user.userRole;
    const extracted = extractNonJobId(request);

    if (extracted.updateEmail) {
       extracted.contactEmail =extracted.updateEmail; // Create the new property
       delete extracted.updateEmail;
    }
    
    if (user) {
        try {
            const updatedDocument = await Facility.findOneAndUpdate(role=="Admin" ? { contactEmail: request.contactEmail, userRole: 'Facilities' } : {contactEmail: req.user.contactEmail, userRole: req.user.userRole}, role=="Admin" ? { $set: extracted } : { $set: request }, { new: false });
            const payload = {
                contactEmail: user.contactEmail,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            };

            if (role != 'Admin') {
                const token = setToken(payload);
                const users = await Facility.findOne({contactEmail: user.contactEmail});

                return res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
            } else {
                if (updatedDocument) {
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                            <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    } else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    }
                    return res.status(200).json({ message: 'Trading Signals saved Successfully', user: updatedDocument });
                }
            }
        } catch (err) {
            return res.status(500).json({ error: err });
        }
    }
};

//Get All Data
exports.facility = async (req, res) => {
    try {
        // console.log("shifts");
        const user = req.user;
        const role = req.headers.role;
        console.log('role------', req.headers.role);
        const data = await Facility.find({});
        // console.log("data---++++++++++++++++++++++++>", data)
        let dataArray = [];
        if (role === 'Admin') {
            data.map((item, index) => {
                dataArray.push([
                item.entryDate,
                item.firstName,
                item.lastName,
                item.companyName,
                item.contactEmail,
                item.userStatus,
                item.userRole,])
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
