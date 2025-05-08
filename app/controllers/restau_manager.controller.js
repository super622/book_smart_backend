const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const Restau_manager = db.restau_manager;
const Job = db.restau_job;
const mailTrans = require("../controllers/mailTrans.controller.js");
const moment = require('moment-timezone');
var dotenv = require('dotenv');
dotenv.config()

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

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

exports.signup = async (req, res) => {
    try {
        const lastUser = await Restau_manager.find().sort({ aic: -1 }).limit(1);
        const lastUserId = lastUser.length > 0 ? lastUser[0].aic : 0;
        const newUserId = lastUserId + 1;
        let response = req.body;
        response.contactEmail = response.contactEmail.toLowerCase();
        const isUser = await Restau_manager.findOne({ contactEmail: response.contactEmail });

        if (!isUser) {
            const subject = `Welcome to BookSmart™`;
            const content = `<div id=":18t" class="a3s aiL ">
                <p>Thank you for registering as a Hospitality Independent Contractor!</p>
                <p>Your request has been submitted and you will be notified as soon as your access is approved.</p>
            </div>`;
            response.entryDate = new Date();
            response.aic = newUserId;
            response.userStatus = "pending approval";

            if (response.avatar.name != "") {
                const s3FileUrl = await uploadToS3(response.avatar);
                response.avatar.content = s3FileUrl;
            }

            const auth = new Restau_manager(response);

            let sendResult = mailTrans.sendMail(response.contactEmail, subject, content);

            const subject1 = `A New Hospitality Independent Contractor ${response.firstName} ${response.lastName} - Has Registered with BookSmart™`
            const content1 = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: The Hospitality Independent Contractor will not be able to view shifts until approved by the "Administrator"<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
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

exports.login = async (req, res) => {
    try {
        const { contactEmail, password, userRole } = req.body;
        const isUser = await Restau_manager.findOne({ contactEmail: contactEmail.toLowerCase(), password: password, userRole: userRole }, 
                                                { aic: 1, userStatus: 1, userRole: 1, AcknowledgeTerm: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, contactEmail: 1, contactPhone: 1, password: 1, contactPassword: 1, address: 1, avatar: 1 });
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
                    return res.status(200).json({ message: "Successfully Logined!", token: token, user: isUser });
                } else {
                    return res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                return res.status(402).json({message: "You are not approved! Please wait until the admin accept you."})
            }
        } else {
            const isExist = await Restau_manager.findOne({ contactEmail: contactEmail.toLowerCase(), userRole: userRole });
      
            if (isExist) {
                return res.status(401).json({ message: "Login information is incorrect." })
            } else {
                return res.status(404).json({ message: "User Not Found! Please Register First." })
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
        code += Math.floor(Math.random() * 10);
    }
    return code;
}

exports.forgotPassword = async (req, res) => {
    try {
        const { contactEmail } = req.body;
        const isUser = await Restau_manager.findOne({ contactEmail: contactEmail });
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
                const updateUser = await Restau_manager.updateOne({ contactEmail: contactEmail }, { $set: { verifyCode: verifyCode, verifyTime: verifyTime } });
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

exports.verifyCode = async (req, res) => {
    try {
        const { verifyCode, email } = req.body;
        const isUser = await Restau_manager.findOne({ contactEmail: email });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyTime) {
                return res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"});
            } else {
                if (isUser.verifyCode == verifyCode) {
                    return res.status(200).json({message: "Success to verify code."});
                } else {
                    return res.status(402).json({message: "Invalid verification code."});
                }
            }
        } else {
            return res.status(404).json({ message: "User Not Found! Please Register First." });
        }
    } catch (e) {
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const { contactEmail, password } = req.body;
        const isUser = await Restau_manager.findOne({ contactEmail: contactEmail });
        if (isUser) {
            const updateUser = await Restau_manager.updateOne({ contactEmail: contactEmail }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
            return res.status(200).json({message: "Password changed successfully."});
        } else {
            return res.status(404).json({ message: "Password change failed." });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

async function extractNonJobId(job) {
    const newObject = {};
    for (const [key, value] of Object.entries(job)) {
        if (key === 'contactEmail') continue;

        if (key == 'avatar') {
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
        } else {
            newObject[key] = value;
        }
    }
    return newObject;
}

exports.Update = async (req, res) => {
    const request = req.body;
    const user = req.user;
    const role = request.userRole || user.userRole;
    const extracted = await extractNonJobId(request);

    if (extracted.updateEmail) {
       extracted.contactEmail =extracted.updateEmail;
       delete extracted.updateEmail;
    }
    console.log(user);
    if (user) {
        try {
            const query = { contactEmail: user.contactEmail };
        
            const updateFields = { $set: extracted };
            const updatedDocument = await Restau_manager.findOneAndUpdate(query, updateFields, { new: true });
            const payload = {
                contactEmail: user.contactEmail,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            };

            if (role != 'Admin') {
                const token = setToken(payload);
                const users = await Restau_manager.findOne({contactEmail: user.contactEmail}, { signature: 0 });
                const verifySubject = "BookSmart™ - New Account signed";
                const verifySubject1 = "BookSmart™ Terms of Service";
                const verifiedContent = `
                <div>
                    <p>Hello Admin,</p>
                    <p>${updatedDocument.firstName} has selected this Term: 
                        ${updatedDocument.selectedoption === 'first' ? 
                        'Paying Net 7 with a Fee of $7/hour for CNAs, $10/hour for LPNs, or $15/hour for RNs for designated access to and use of BOOKSMART™ and processing of payments and insurances (“Service Fee”).' : 
                        'Paying Net 30 Bill rates set as: $35/hour for CNAs, $55/hour for LPNs, and $75/hour for RNs.'}
                    </p>
                    <p>His signature is below:</p>
                     <img src="cid:signatureImage" style="width: 300px; height: 200px;" />
                </div>`;
                const facilityverifiedContent = `
                <div>
                    <p>Dear ${updatedDocument.firstName},</p>
                    <p>Please find a copy of the Terms of Service agreed upon by and between your organization and BookSmart Technologies LLC.</p>
                    <p>It's most important to save these Terms as our relationship is built on them. We will do our part to provide exceptional service, and we stress the importance of on time payments. We look forward to our glowing review which we will begin earning now.</p>
                    <p>Your signature:</p>
                    <img src="cid:signatureImage" style="width: 300px; height: 200px;" />
                    <p>Here's the link of a copy of the BOOKSMART™ TERMS OF SERVICE:</p>
                    <p> ${updatedDocument.selectedoption==='first' ? 'https://drive.google.com/file/d/1NFjODJEvbSG8-Q1bTXUPfmHNDb5872of/view?usp=sharing' : 'https://drive.google.com/file/d/1NFjODJEvbSG8-Q1bTXUPfmHNDb5872of/view?usp=sharing'}</p>
                    <p>Thanks, and have a great day!</p>
                </div>`;

                const attachments = 
                    {                  
                        content: updatedDocument.signature,
                        name: "signature.png",
                        type: "png",
                        cid : "signatureImage"
                    };
                let approveResult = mailTrans.sendMail("support@whybookdumb.com", verifySubject, verifiedContent, attachments);
                let approveResult1 = mailTrans.sendMail("techableteam@gmail.com", verifySubject, verifiedContent, attachments);
                let approveResult2 = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject1, facilityverifiedContent, attachments);
                return res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
            } else {
                if (updatedDocument) {
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>You have selected this Term : ${updatedDocument.selectedoption=='first'?' Paying Net 7 with a Fee of $7/hour for CNAs, $10/hour for LPNs or $15/hour for RNs for designated access to and use of BOOKSMART™ and processing of payments and insurances (“Service Fee”).':' Paying Net 30 Bill rates set as: $35/hour for CNAs, $55/hour for LPNs, and $75/hour for RNs.'}</p>
                            <p>Your BookSmart™ account has been approved.</p>
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
        const limit = 25;
        const skip = (page - 1) * limit;
        const query = {};

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { contactEmail: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { contactPhone: { $regex: search, $options: 'i' } }
            ];
        }

        const data = await Restau_manager.find(query, { aic: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, userStatus: 1, selectedoption: 1, signature: 1, userRole: 1, contactEmail: 1 })
            .sort({ entryDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const totalRecords = await Restau_manager.countDocuments(query);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        let dataArray = [];
        data.map((item, index) => {
            dataArray.push([
                item.aic,
                moment(item.entryDate).format("MM/DD/YYYY"),
                item.companyName,
                item.firstName + " " + item.lastName,
                item.userStatus,
                item.selectedoption,
                item.signature,
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

exports.getRestau_managerList = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;
        const data = await Restau_manager.find({});
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
                return res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
            } else {
                return res.status(400).json({ message: "Cannot logined User!" })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getRestau_managerInfo = async (req, res) => {
    try {
        const user = req.user;
        const { userId } = req.body;
        const userData = await Restau_manager.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, aic: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1, contactPhone: 1, address: 1 });
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
            return res.status(200).json({ message: "Successfully Get!", userData, jobData, token: token });
        } else {
            return res.status(500).json({ message: "Cannot logined User!" })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.managers = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;
        const data = await Restau_manager.find({});
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
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            }
            const token = setToken(payload);
            if (token) {
                return res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
            } else {
                return res.status(400).json({ message: "Cannot logined User!" })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}
