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
const Job = db.jobs;
const mailTrans = require("../controllers/mailTrans.controller.js");

const limitAccNum = 100;
const expirationTime = 10000000;
//Register Account
exports.signup = async (req, res) => {
    try {
        const lastFacility = await Facility.find().sort({ aic: -1 }).limit(1); // Retrieve the last jobId
        const lastFacilityId = lastFacility.length > 0 ? lastFacility[0].aic : 0; // Get the last jobId value or default to 0
        const newFacilityId = lastFacilityId + 1; // Increment the last jobId by 1 to set the new jobId for the next data entry
        let response = req.body;
        const isUser = await Facility.findOne({ contactEmail: response.contactEmail.toLowerCase() });

        if (!isUser) {
            const subject = `Welcome to BookSmart™`
            const content = `<div id=":18t" class="a3s aiL ">
                <p>Thank you for registering as a Facility User!</p>
                <p>Your request has been submitted and you will be notified as soon as your access is approved.</p>
            </div>`
            response.entryDate = new Date();
            response.aic = newFacilityId;
            response.userStatus = "pending approval";
            response.contactEmail = response.contactEmail.toLowerCase();

            if (response.avatar.name != "") {
                const content = Buffer.from(response.avatar.content, 'base64');
                response.avatar.content = content;
            }

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
        const isUser = await Facility.findOne({ contactEmail: contactEmail.toLowerCase(), password: password, userRole: userRole }, 
                                                { aic: 1, userStatus: 1, userRole: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, contactEmail: 1, contactPhone: 1, password: 1, contactPassword: 1, facilityAcknowledgeTerm: 1, address: 1, avatar: 1 });
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
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        if (key == 'avatar') {
            let file = job[key];
            if (file.content) {
                file.content = Buffer.from(file.content, 'base64');
            } 
            newObject[key] = file;
        } else {
            newObject[key] = job[key];
        }
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
                    return res.status(200).json({ message: 'Responded Successfully!', user: updatedDocument });
                }
            }
        } catch (err) {
            return res.status(500).json({ error: err });
        }
    }
};

exports.getAllFacilities = async (req, res) => {
    try {
        const user = req.user;
        const { search = '', page = 1, filters = [] } = req.body;
        const limit = 5;
        const skip = (page - 1) * limit;
        const query = {};
        console.log(search, page, filters);

        // filters.forEach(filter => {
        //     const { logic = 'and', field, condition, value } = filter;
        
        //     let fieldNames = [];
        
        //     if (field === 'Contact Name') {
        //         fieldNames = ['firstName', 'lastName']; 
        //     } else if (field === 'AIC-ID') {
        //         fieldNames = ['aic']; 
        //     } else if (field === 'User Roles') {
        //         fieldNames = ['userRole'];
        //     } else if (field === 'User Status') {
        //         fieldNames = ['userStatus'];
        //     } else if (field === 'Company Name') {
        //         fieldNames = ['companyName'];
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
        //     if (field === 'Contact Name') {
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

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { contactEmail: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { contactPhone: { $regex: search, $options: 'i' } }
            ];
        }

        const data = await Facility.find(query, { aic: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, userStatus: 1, userRole: 1, contactEmail: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        console.log('got data');
        const totalRecords = await Facility.countDocuments(query);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        let dataArray = [];
        data.map((item, index) => {
            dataArray.push([
                item.aic,
                moment(item.entryDate).format("MM/DD/YYYY"),
                item.companyName,
                item.firstName + " " + item.lastName,
                item.userStatus,
                item.userRole,
                "view_shift",
                "pw",
                item.contactEmail
            ]);
        });

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };
        const token = setToken(payload);

        if (token) {
            return res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt, token });
        } else {
            return res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};

exports.getFacilityList = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;
        const data = await Facility.find({});
        let dataArray = [];

        if (role === 'Admin') {
            data.map((item, index) => {
                dataArray.push([
                    item.aic,
                    moment(item.entryDate).format("MM/DD/YYYY"),
                    item.companyName,
                    item.firstName + " " + item.lastName,
                    item.userStatus,
                    item.userRole,
                    "view_shift",
                    "pw",
                    item.contactEmail
                ]);
            });

            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            };
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

exports.getFacilityInfo = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.body;
        const userData = await Facility.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, aic: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1, contactPhone: 1, address: 1 });
        const jobList = await Job.find({ facilityId: userId }, { jobId: 1, entryDate: 1, jobNum: 1, jobStatus: 1, shiftDate: 1, shiftTime: 1 });
        let jobData = [];
        jobList.map((item, index) => {
            jobData.push([
                item.jobId,
                item.entryDate,
                item.jobNum,
                item.jobStatus,
                item.shiftDate + " " + item.shiftTime
            ]);
        });

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };
        const token = setToken(payload);

        if (token) {
            res.status(200).json({ message: "Successfully Get!", userData, jobData, token: token });
        } else {
            res.status(500).json({ message: "Cannot logined User!" })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
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
