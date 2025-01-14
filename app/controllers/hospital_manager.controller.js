const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const Hospital_manager = db.hospital_manager;
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

//Regiseter Account
exports.signup = async (req, res) => {
    try {
        const lastUser = await Hospital_manager.find().sort({ aic: -1 }).limit(1);
        const lastUserId = lastUser.length > 0 ? lastUser[0].aic : 0;
        const newUserId = lastUserId + 1;
        let response = req.body;
        response.email = response.email.toLowerCase();
        const isUser = await Hospital_manager.findOne({ email: response.email });

        if (!isUser) {
            const subject = `Welcome to BookSmart™ - ${response.firstName} ${response.lastName}`
            const content = `<div id=":18t" class="a3s aiL ">
                <p>
                <strong>Note: Once you are "APPROVED" you will be notified via email and can view shifts<br></strong>
                </p>
                <p><strong>-----------------------<br></strong></p>
                <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                <p><strong>Nurse-ID</strong>: ${newUserId}</p>
                <p><strong>Name</strong>: ${response.firstName} ${response.lastName}</p>
                <p><strong>Email / Login</strong><strong>:</strong> <a href="mailto:${response.email}" target="_blank">${response.email}</a></p>
                <p><strong>Password</strong>: <br></p>
                <p><strong>Phone</strong>: <a href="tel:${response.phoneNumber || ''}" target="_blank">${response.phoneNumber || ''}</a></p>
                <p>-----------------------</p>
                <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
            </div>`
            response.entryDate = new Date();
            response.aic = newUserId;
            response.userStatus = "pending approval";
            response.AcknowledgeTerm = false;

            if (response?.photoImage?.name != "") {
                const s3FileUrl = await uploadToS3(response.photoImage);
                response.photoImage.content = s3FileUrl;
            }

            const auth = new Hospital_manager(response);
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
                <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                <p><strong>Nurse-ID</strong>: ${newUserId}</p>
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
                await auth.save();
                const payload = {
                    email: response.email.toLowerCase(),
                    userRole: response.userRole,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + expirationTime
                }
                const token = setToken(payload);
                return res.status(200).json({ message: "Successfully Regisetered", token: token });
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
        const { email, password, device } = req.body;
        
        if (!email || !password || !device) {
            return res.status(401).json({ message: "Incorrect Data !" });
        }

        let userData = await Hospital_manager.findOne({ email: email.toLowerCase(), password: password }, 
                                            { aic: 1, firstName: 1, lastName: 1, userRole: 1, userStatus: 1, device: 1, email: 1, phoneNumber: 1, title: 1, AcknowledgeTerm: 1, password: 1 });

        if (userData) {
            if (userData.userStatus === 'activate') {
                let devices = userData.device || [];
                let phoneAuth = true;

                if (!devices.includes(device)) {
                    phoneAuth = true;
                } else {
                    phoneAuth = false;
                    await Hospital_manager.updateOne({ email: email.toLowerCase() }, { $set: { logined: true } });
                }
                
                const payload = {
                    email: userData.email,
                    userRole: userData.userRole,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + expirationTime
                }
                const token = setToken(payload);
                if (token) {
                    return res.status(200).json({ message: "Successfully Logined!", token: token, user: userData, phoneAuth: phoneAuth });
                } else {
                    return res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                return res.status(402).json({message: "You are not approved! Please wait."})
            }
        } else {
            const isExist = await Hospital_manager.findOne({ email: email.toLowerCase() }, { email: 1 });

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
