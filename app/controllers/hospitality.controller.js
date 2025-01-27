const db = require("../models");
const mailTrans = require("../controllers/mailTrans.controller.js");
const { setToken } = require('../utils/verifyToken');
var dotenv = require('dotenv');

dotenv.config();

const RestaJob = db.restau_job;
const HotelJob = db.hotel_job;
const Admin = db.admins;
const RestauHire = db.restau_manager;
const RestauWork = db.restau_user;
const HoteLHire = db.hotel_manager;
const HotelWork = db.hotel_user;
const RestauBid = db.restau_bid;
const HotelBid = db.hotel_bid;

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// const limitAccNum = 100;
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
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
}

function calculateShiftHours(shiftStartTime, shiftEndTime) {
    let hours = 0;
    if (shiftStartTime && shiftEndTime) {
        const startTime = parseTime(shiftStartTime);
        const endTime = parseTime(shiftEndTime);
        const duration = endTime - startTime;
        hours = duration / (1000 * 60 * 60);
    }
    return hours;
}

function getTimeFromDate(timeString) {
    const [datePart, timePart] = timeString.split(' ');
    const [month, day, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return hours + ":" + minutes;
};

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

exports.getAllData = async (req, res) => {
    try {
        const user = req.user;
        const jobStatusCount = [
            { _id: "Available", count: 0 },
            { _id: "Awarded", count: 0 },
            { _id: "Cancelled", count: 0 },
            { _id: "Paid", count: 0 },
            { _id: "Pending Verification", count: 0 },
            { _id: "Verified", count: 0 },
            { _id: "Pending - Completed Verification", count: 0 },
            { _id: "Shift Verified", count: 0 },
        ];

        const RestaJobStatus = await RestaJob.aggregate([
            {
                $group: {
                    _id: "$jobStatus",
                    count: { $sum: 1 }
                }
            }
        ]);

        const HotelJobStatus = await HotelJob.aggregate([
            {
                $group: {
                    _id: "$jobStatus",
                    count: { $sum: 1 }
                }
            }
        ]);

        const RestaUpdatedCount = jobStatusCount.map(status => {
            const found = RestaJobStatus.find(item => item._id === status._id);
            return {
                ...status,
                count: found ? found.count : status.count,
            };
        });

        const HotelUpdateCount = jobStatusCount.map(status => {
            const found = HotelJobStatus.find(item => item._id === status._id);
            return {
                ...status,
                count: found ? found.count : status.count,
            };
        });

        // const nurseStatus = await Job.aggregate([
        //     {
        //         $group: {
        //             _id: "$nurse",
        //             count: { $sum: 1 }
        //         }
        //     },
        // ]);

        // const nurseStatus = await Job.aggregate([
        //     {
        //         $group: {
        //             _id: "$nurse",
        //             count: { $sum: 1 }
        //         }
        //     },
        // ]);

        const RestaResults = await RestaJob.aggregate([
            {
                $group: {
                _id: { $substr: ["$entryDate", 0, 2] },
                count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 }
            },
            {
                $project: {
                    _id: 0,
                    _id: { $concat: ["$_id", "/24"] },
                    count: 1
                }
            }
        ]);

        const HotelResults = await HotelJob.aggregate([
            {
                $group: {
                _id: { $substr: ["$entryDate", 0, 2] },
                count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 }
            },
            {
                $project: {
                    _id: 0,
                    _id: { $concat: ["$_id", "/24"] },
                    count: 1
                }
            }
        ]);

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };

        const token = setToken(payload);
        if (token) {
            res.status(200).json({ message: "Successfully Get!", jobData: { restauJob: RestaUpdatedCount, hotelJob: HotelUpdateCount, restauResult: RestaResults, hotelResult: HotelResults }, token: token });
        } else {
            res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.getCaregiverTimesheets = async (req, res) => {
    const user = req.user;
    const { restauSearch = '', restauPage = 1, hotelSearch = '', hotelPage } = req.body;
    const limit = 25;
    const restauSkip = (restauPage - 1) * limit;
    const hotelSkip = (hotelPage - 1) * limit;
  
    try {
        const restauQuery = {};
        const hotelQuery = {};
  
        if (restauSearch) {
            const isNumeric = !isNaN(restauSearch);
    
            restauQuery.$or = [
                ...(isNumeric ? [{ jobId: Number(restauSearch) }] : []), // Numeric restauSearch for jobId
                { nurse: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for nurse
                { shiftTime: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for shiftTime
                { shiftDate: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for shiftDate
                { lunch: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for lunch
                ...(isNumeric ? [{ lunchEquation: Number(restauSearch) }] : []), // Numeric restauSearch for lunchEquation
                ...(isNumeric ? [{ finalHoursEquation: Number(restauSearch) }] : []), // Numeric restauSearch for finalHoursEquation
                { preTime: { $regex: restauSearch, $options: 'i' } } // Text restauSearch for preTime
            ];
        }

        if (hotelSearch) {
            const isNumeric = !isNaN(restauSearch);
    
            hotelQuery.$or = [
                ...(isNumeric ? [{ jobId: Number(restauSearch) }] : []), // Numeric restauSearch for jobId
                { nurse: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for nurse
                { shiftTime: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for shiftTime
                { shiftDate: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for shiftDate
                { lunch: { $regex: restauSearch, $options: 'i' } }, // Text restauSearch for lunch
                ...(isNumeric ? [{ lunchEquation: Number(restauSearch) }] : []), // Numeric restauSearch for lunchEquation
                ...(isNumeric ? [{ finalHoursEquation: Number(restauSearch) }] : []), // Numeric restauSearch for finalHoursEquation
                { preTime: { $regex: restauSearch, $options: 'i' } } // Text restauSearch for preTime
            ];
        }
  
        const restauJob = await RestaJob.find(restauQuery, { shiftStartTime: 1, shiftEndTime: 1, jobId: 1, nurse: 1, shiftDate: 1, shiftTime: 1, jobStatus: 1, preTime: 1, lunch: 1, lunchEquation: 1, finalHoursEquation: 1 })
                                .skip(restauSkip)
                                .limit(limit)
                                .lean();

        const hotelJob = await HotelJob.find(hotelQuery, { shiftStartTime: 1, shiftEndTime: 1, jobId: 1, nurse: 1, shiftDate: 1, shiftTime: 1, jobStatus: 1, preTime: 1, lunch: 1, lunchEquation: 1, finalHoursEquation: 1 })
                                .skip(hotelSkip)
                                .limit(limit)
                                .lean();
  
        const totalRestauJobRecords = await RestaJob.countDocuments(restauQuery);
        const totalHotelJobRecords = await HotelJob.countDocuments(hotelQuery);

        const totalRestauPageCnt = Math.ceil(totalRestauJobRecords / limit);
        const totalHotelPageCnt = Math.ceil(totalHotelJobRecords / limit);
  
        let restauData = [];
        let hotelData = [];

        for (const job of restauJob) {
            const workedHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
            const startTime = job.shiftStartTime ? getTimeFromDate(job.shiftStartTime) : '';
            const endTime = job.shiftEndTime ? getTimeFromDate(job.shiftEndTime) : '';
            let workedHoursStr = '';
    
            if (startTime !== '' && endTime !== '') {
                workedHoursStr = `${startTime} to ${endTime} = ${workedHours}`;
            }
    
            restauData.push([
                job.jobId,
                job.nurse,
                `${job.shiftDate} ${job.shiftTime}`,
                job.jobStatus,
                workedHoursStr,
                job.preTime,
                job.lunch,
                job.lunchEquation ? job.lunchEquation.toFixed(2) : '0.00',
                job.finalHoursEquation ? job.finalHoursEquation.toFixed(2) : '0.00'
            ]);
        }

        for (const job of hotelJob) {
            const workedHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
            const startTime = job.shiftStartTime ? getTimeFromDate(job.shiftStartTime) : '';
            const endTime = job.shiftEndTime ? getTimeFromDate(job.shiftEndTime) : '';
            let workedHoursStr = '';
    
            if (startTime !== '' && endTime !== '') {
                workedHoursStr = `${startTime} to ${endTime} = ${workedHours}`;
            }
    
            hotelData.push([
                job.jobId,
                job.nurse,
                `${job.shiftDate} ${job.shiftTime}`,
                job.jobStatus,
                workedHoursStr,
                job.preTime,
                job.lunch,
                job.lunchEquation ? job.lunchEquation.toFixed(2) : '0.00',
                job.finalHoursEquation ? job.finalHoursEquation.toFixed(2) : '0.00'
            ]);
        }
  
        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };

        const token = setToken(payload);
  
        if (token) {
            res.status(200).json({ message: "Successfully Get!", restauData, hotelData, totalHotelPageCnt, totalRestauPageCnt, token });
        } else {
            res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (error) {
        console.error('Error occurred while fetching timesheets:', error);
        res.status(500).json({ message: "An error occurred!" });
    }
};

exports.getAllUsersList = async (req, res) => {
    try {
        const user = req.user;
        let adminArr = [];
        let restauWorkArr = [];
        let restauHireArr = [];
        let hotelWorkArr = [];
        let hotelHireArr = [];

        const { search = '', page = 1, filters = [] } = req.body;
        const limit = 25;
        const skip = (page - 1) * limit;
        const query = {};
        const fQuery = {};

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
        const restauHireData = await RestauHire.find(fQuery, { firstName: 1, lastName: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1 });
        const hotelHireData = await HoteLHire.find(fQuery, { firstName: 1, lastName: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1 });
        const restauWorkData = await RestauWork.find(query, { firstName: 1, lastName: 1, email: 1, userRole: 1, userStatus: 1 });
        const hotelWorkData = await HotelWork.find(query, { firstName: 1, lastName: 1, email: 1, userRole: 1, userStatus: 1 });

        adminData.forEach(item => {
            adminArr.push([
                `${item.firstName} ${item.lastName}`,
                item.email,
                item.userRole,
                "",
                item.userStatus,
                "delete"
            ]);
        });

        restauHireData.forEach(item => {
            restauHireArr.push([
                `${item.firstName} ${item.lastName}`,
                item.contactEmail,
                "Restaurant Manager",
                item.companyName,
                item.userStatus,
                "delete"
            ]);
        });

        hotelHireData.forEach(item => {
            hotelHireArr.push([
                `${item.firstName} ${item.lastName}`,
                item.contactEmail,
                "Hotel Manager",
                item.companyName,
                item.userStatus,
                "delete"
            ]);
        });

        restauWorkData.forEach(item => {
            restauWorkArr.push([
                `${item.firstName} ${item.lastName}`,
                item.email,
                "Restaurant Worker",
                "",
                item.userStatus,
                "delete"
            ]);
        });

        hotelWorkData.forEach(item => {
            hotelWorkArr.push([
                `${item.firstName} ${item.lastName}`,
                item.email,
                "Hotel Worker",
                "",
                item.userStatus,
                "delete"
            ]);
        });

        const combinedList = [...adminArr, ...restauHireArr, ...restauWorkArr, ...hotelHireArr, ...hotelWorkArr];
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

exports.removeAccount = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (role == 'Admin') {
            await Admin.deleteOne({ email: email });
        } else if (role == 'Restaurant Manager') {
            await RestauHire.deleteOne({ contactEmail: email });
        } else if(role == 'Restaurant Worker') {
            await RestauWork.deleteOne({ email: email });
        } else if (role == 'Hotel Manager') {
            await HoteLHire.deleteOne({ contactEmail: email });
        } else if(role == 'Hotel Worker') {
            await HotelWork.deleteOne({ email: email });
        }
        return res.status(200).json({ message: "Success" });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};

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
    } else if (userRole === 'Restaurant Worker') {
        const restauWorker = await RestauWork.findOne({ email });

        await RestauWork.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await RestauWork.updateOne({ email }, {$set: { password }});

            console.log(email, password, restauWorker);
            const verifySubject1 = "BookSmart™ - Your password has been changed"
            const verifiedContent1 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${restauWorker.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult1 = mailTrans.sendMail(restauWorker.email, verifySubject1, verifiedContent1);
        }

        if (restauWorker.userStatus != status) {
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${restauWorker.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult2 = mailTrans.sendMail(restauWorker.email, verifySubject2, verifiedContent2);
            } else {
                const verifySubject3 = "BookSmart™ - Your Account Restricted"
                const verifiedContent3 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${restauWorker.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult3 = mailTrans.sendMail(restauWorker.email, verifySubject3, verifiedContent3);
            }
        }
    } else if (userRole === 'Restaurant Manager') {
        const restauManager = await RestauHire.findOne({ contactEmail: email });

        await RestauHire.updateOne({ contactEmail: email }, {$set: { userStatus: status }});

        if (password != '') {
            await RestauHire.updateOne({ contactEmail: email }, {$set: { password }});
            const verifySubject4 = "BookSmart™ - Your password has been changed"
            const verifiedContent4 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${restauManager.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult4 = mailTrans.sendMail(restauManager.contactEmail, verifySubject4, verifiedContent4);
        }

        if (restauManager.userStatus != status) {
            if (status == 'activate') {
                const verifySubject5 = "BookSmart™ - Your Account Approval"
                const verifiedContent5 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${restauManager.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult5 = mailTrans.sendMail(restauManager.contactEmail, verifySubject5, verifiedContent5);
            } else {
                const verifySubject6 = "BookSmart™ - Your Account Restricted"
                const verifiedContent6 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${restauManager.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult6 = mailTrans.sendMail(restauManager.contactEmail, verifySubject6, verifiedContent6);
            }
        }
    } else if (userRole === 'Hotel Worker') {
        const hotelWorker = await HotelWork.findOne({ email });

        await HotelWork.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await HotelWork.updateOne({ email }, {$set: { password }});

            console.log(email, password, hotelWorker);
            const verifySubject1 = "BookSmart™ - Your password has been changed"
            const verifiedContent1 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${hotelWorker.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult1 = mailTrans.sendMail(hotelWorker.email, verifySubject1, verifiedContent1);
        }

        if (hotelWorker.userStatus != status) {
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${hotelWorker.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult2 = mailTrans.sendMail(hotelWorker.email, verifySubject2, verifiedContent2);
            } else {
                const verifySubject3 = "BookSmart™ - Your Account Restricted"
                const verifiedContent3 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${hotelWorker.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult3 = mailTrans.sendMail(hotelWorker.email, verifySubject3, verifiedContent3);
            }
        }
    } else if (userRole === 'Hotel Manager') {
        const hotelManager = await HotelWork.findOne({ contactEmail: email });

        await HotelWork.updateOne({ contactEmail: email }, {$set: { userStatus: status }});

        if (password != '') {
            await HotelWork.updateOne({ contactEmail: email }, {$set: { password }});
            const verifySubject4 = "BookSmart™ - Your password has been changed"
            const verifiedContent4 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${hotelManager.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult4 = mailTrans.sendMail(hotelManager.contactEmail, verifySubject4, verifiedContent4);
        }

        if (hotelManager.userStatus != status) {
            if (status == 'activate') {
                const verifySubject5 = "BookSmart™ - Your Account Approval"
                const verifiedContent5 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${hotelManager.firstName},</p>
                    <p>Your BookSmart™ account has been approved.</p>
                </div>`
                let approveResult5 = mailTrans.sendMail(hotelManager.contactEmail, verifySubject5, verifiedContent5);
            } else {
                const verifySubject6 = "BookSmart™ - Your Account Restricted"
                const verifiedContent6 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${hotelManager.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult6 = mailTrans.sendMail(hotelManager.contactEmail, verifySubject6, verifiedContent6);
            }
        }
    }
    return res.status(200).json({ message: 'User information has been updated' });
};

exports.allContractors = async (req, res) => {
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

        const restauData = await RestauWork.find(query, { 
                firstName: 1, lastName: 1, aic: 1, entryDate: 1, phoneNumber: 1, title: 1, email: 1, userStatus: 1, userRole: 1
            })
            .sort({ aic: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const hotelData = await HotelWork.find(query, { 
                firstName: 1, lastName: 1, aic: 1, entryDate: 1, phoneNumber: 1, title: 1, email: 1, userStatus: 1, userRole: 1
            })
            .sort({ aic: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        let restauDataArr = [];

        for (const item of restauData) {
            let awarded = await RestauBid.find({ bidStatus: 'Awarded', caregiverId: item.aic }).count();
            let applied = await RestauBid.find({ caregiverId: item.aic }).count();
            let ratio = '';

            if (awarded > 0 && applied > 0) {
                ratio = (100 / applied) * awarded;
                ratio += '%';
            }

            restauDataArr.push([
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
                item.userRole
            ]);
        }

        let hotelDataArr = [];

        for (const item of hotelData) {
            let awarded = await HotelBid.find({ bidStatus: 'Awarded', caregiverId: item.aic }).count();
            let applied = await HotelBid.find({ caregiverId: item.aic }).count();
            let ratio = '';

            if (awarded > 0 && applied > 0) {
                ratio = (100 / applied) * awarded;
                ratio += '%';
            }

            hotelDataArr.push([
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
                item.userRole
            ]);
        }

        const combinedList = [...restauDataArr, ...hotelDataArr];
        const totalRecords = combinedList.length;
        const userList = combinedList.slice(skip, skip + limit);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        };
        const token = setToken(payload);

        if (token) {
            res.status(200).json({ message: "Successfully Get!", userList, totalPageCnt, token });
        } else {
            res.status(400).json({ message: "Cannot log in User!" });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { userId, password, tmpPassword, userRole } = req.body;

        if (userRole == 'restaurantWork') {
            const restauUser = await RestauWork.findOne({ aic: userId });
            if (restauUser) {
                const updateUser = await RestauWork.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${restauUser.firstName} ${restauUser.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${restauUser.email}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(restauUser.email, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        } else if (userRole == 'hotelWorker') {
            const hotelUser = await HotelWork.findOne({ aic: userId });
            if (hotelUser) {
                const updateUser = await HotelWork.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${hotelUser.firstName} ${hotelUser.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${hotelUser.contactEmail}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(hotelUser.contactEmail, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        } else if (userRole == 'Restaurant Manager') {
            const restauManager = await RestauHire.findOne({ aic: userId });
            if (restauManager) {
                const updateUser = await RestauHire.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${restauManager.firstName} ${restauManager.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${restauManager.contactEmail}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(restauManager.contactEmail, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        } else if (userRole == 'Hotel Manager') {
            const hotelManager = await HoteLHire.findOne({ aic: userId });
            if (hotelManager) {
                const updateUser = await HoteLHire.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${hotelManager.firstName} ${hotelManager.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${hotelManager.contactEmail}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(hotelManager.contactEmail, verifySubject8, verifiedContent8);
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

exports.updateUserStatus = async (req, res) => {
    try {
        const { userId, status, userRole } = req.body;

        if (userRole === 'restaurantWork') {
            const restauUser = await RestauWork.findOne({ aic: userId }, { firstName: 1, lastName: 1, email: 1 });
            if (restauUser) {
                await RestauWork.updateOne({ aic: userId }, { $set: { userStatus: status } });
                if (status == 'activate') {
                    const verifySubject2 = "BookSmart™ - Your Account Approval"
                    const verifiedContent2 = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${restauUser.firstName},</p>
                        <p>Your BookSmart™ account has been approved.</p>
                    </div>`
                    let approveResult2 = mailTrans.sendMail(restauUser.email, verifySubject2, verifiedContent2);
                } else {
                    const verifySubject3 = "BookSmart™ - Your Account Restricted"
                    const verifiedContent3 = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${restauUser.firstName},</p>
                        <p>Your BookSmart™ account has been restricted.</p>
                    </div>`
                    let approveResult3 = mailTrans.sendMail(restauUser.email, verifySubject3, verifiedContent3);
                }
                res.status(200).json({ message: "Status has been updated" });
            } else {
                res.status(404).json({ message: "Status change failed." });
            }
        } else if (userRole === 'hotelWorker') {
            const hotelUser = await HotelWork.findOne({ aic: userId }, { firstName: 1, lastName: 1, email: 1 });
            if (hotelUser) {
                await HotelWork.updateOne({ aic: userId }, { $set: { userStatus: status } });
                if (status == 'activate') {
                    const verifySubject2 = "BookSmart™ - Your Account Approval"
                    const verifiedContent2 = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${hotelUser.firstName},</p>
                        <p>Your BookSmart™ account has been approved.</p>
                    </div>`
                    let approveResult2 = mailTrans.sendMail(hotelUser.email, verifySubject2, verifiedContent2);
                } else {
                    const verifySubject3 = "BookSmart™ - Your Account Restricted"
                    const verifiedContent3 = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${hotelUser.firstName},</p>
                        <p>Your BookSmart™ account has been restricted.</p>
                    </div>`
                    let approveResult3 = mailTrans.sendMail(hotelUser.email, verifySubject3, verifiedContent3);
                }
                res.status(200).json({ message: "Status has been updated" });
            } else {
                res.status(404).json({ message: "Status change failed." });
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.getUserProfile = async (req, res) => {
    try {
        const { userId, userRole } = req.body;
        let isUser;

        if (userRole === 'restaurantWork') {
            isUser = await RestauWork.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, title: 1, address: 1 });
        } else if (userRole === 'hotelWorker') {
            isUser = await HotelWork.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, title: 1, address: 1 });
        }
        
        if (isUser) {
            let awardedData = [];
            let appliedData = [];
            let awardedCnt = [];
            let appliedCnt = [];

            if (userRole === 'restaurantWork') {
                awardedData = await RestauBid.find({ bidStatus: 'Awarded', caregiverId: userId }, { jobId: 1, entryDate: 1, facility: 1, bidStatus: 1 });
                appliedData = await RestauBid.find({ caregiverId: userId }, { bidId: 1, entryDate: 1, jobId: 1, message: 1 });
                
                awardedCnt = await RestauBid.countDocuments({ bidStatus: 'Awarded', caregiverId: userId });
                appliedCnt = await RestauBid.countDocuments({ caregiverId: userId });
            } else if (userRole === 'hotelWorker') {
                awardedData = await HotelBid.find({ bidStatus: 'Awarded', caregiverId: userId }, { jobId: 1, entryDate: 1, facility: 1, bidStatus: 1 });
                appliedData = await HotelBid.find({ caregiverId: userId }, { bidId: 1, entryDate: 1, jobId: 1, message: 1 });
                
                awardedCnt = await HotelBid.countDocuments({ bidStatus: 'Awarded', caregiverId: userId });
                appliedCnt = await HotelBid.countDocuments({ caregiverId: userId });
            }
            
            let ratio = '';
            let totalJobRating = 0;
            let avgJobRating = 0;
            let awardedList = [];
            let appliedList = [];

            const jobIds = appliedData.map(item => item.jobId);
            let jobRatings = [];

            if (userRole === 'restaurantWork') {
                jobRatings = await RestaJob.find({ jobId: { $in: jobIds } }, { jobId: 1, jobRating: 1 });
            } else if (userRole === 'hotelWorker') {
                jobRatings = await HotelJob.find({ jobId: { $in: jobIds } }, { jobId: 1, jobRating: 1 });
            }
            
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

            res.status(200).json({message: "Successfully get", appliedList, awardedList, userData });
        } else {
            res.status(500).json({ message: "Not exist" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getUserInfo = async (req, res) => {
    try {
        const user = req.user;
        const { userId, userRole } = req.body;

        if (userRole === 'restaurantWork') {
            let restaUser = await RestauWork.findOne({ aic: userId }, 
                { aic: 1, firstName: 1, lastName: 1, email: 1, userStatus: 1, userRole: 1, phoneNumber: 1, title: 1, birthday: 1, socialSecurityNumber: 1, verifiedSocialSecurityNumber: 1, address: 1, password: 1, entryDate: 1, device: 1, 
                    resume: {
                        content: '$resume.content',
                        name: '$resume.name',
                        type: '$resume.type'
                    }
                });
            if (restaUser) {
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                };
                const token = setToken(payload);
                console.log('result')
                return res.status(200).json({ message: "Successfully retrieved", userData: restaUser, token: token });
            } else {
                return res.status(404).json({ message: "User does not exist", userData: [] });
            }
        } else if (userRole === 'hotelWorker') {
            let hotelUser = await HotelWork.findOne({ aic: userId }, 
                { aic: 1, firstName: 1, lastName: 1, email: 1, userStatus: 1, userRole: 1, phoneNumber: 1, title: 1, birthday: 1, socialSecurityNumber: 1, verifiedSocialSecurityNumber: 1, address: 1, password: 1, entryDate: 1, device: 1, 
                    resume: {
                        content: '$resume.content',
                        name: '$resume.name',
                        type: '$resume.type'
                    }
                });
    
            if (hotelUser) {
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                };
                const token = setToken(payload);
                console.log('result')
                return res.status(200).json({ message: "Successfully retrieved", userData: hotelUser, token: token });
            } else {
                return res.status(404).json({ message: "User does not exist", userData: [] });
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.update = async (req, res) => {
    const request = req.body;
    const user = req.user;
    const extracted = await extractNonJobId(request);

    if (extracted.updateEmail) {
       extracted.email = extracted.updateEmail;
       delete extracted.updateEmail;
    }

    if (request.userRole === 'restaurantWork') {
        RestauWork.findOneAndUpdate({ aic: request.userId }, { $set: extracted }, { new: true }, (err, updatedDocument) => {
            console.log('updated');
            if (err) {
                console.log(err);
                return res.status(500).json({ error: err });
            } else {
                console.log('sending mail');
                let updatedData = updatedDocument;

                if (user.userRole == "Admin" && extracted.userStatus == "activate" && extracted.userStatus != existUser.userStatus) {
                    console.log('Activated .........');
                    const verifySubject = "BookSmart™ - Your Account Approval"
                    const verifiedContent = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${updatedData.firstName},</p>
                        <p>Your BookSmart™ account has been approved.</p>
                    </div>`
                    let approveResult = mailTrans.sendMail(updatedData.email, verifySubject, verifiedContent);
                }
                if (user.userRole == "Admin" && extracted.userStatus == "inactivate" && extracted.userStatus != existUser.userStatus) {
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
    } else if (request.userRole === 'hotelWorker') {
        console.log(extracted);
        HotelWork.findOneAndUpdate({ aic: request.userId }, { $set: extracted }, { new: true }, (err, updatedDocument) => {
            console.log('updated');
            if (err) {
                console.log(err);
                return res.status(500).json({ error: err });
            } else {
                console.log('sending mail');
                let updatedData = updatedDocument;

                if (user.userRole == "Admin" && extracted.userStatus == "activate" && extracted.userStatus != existUser.userStatus) {
                    console.log('Activated .........');
                    const verifySubject = "BookSmart™ - Your Account Approval"
                    const verifiedContent = `
                    <div id=":15j" class="a3s aiL ">
                        <p>Hello ${updatedData.firstName},</p>
                        <p>Your BookSmart™ account has been approved.</p>
                    </div>`
                    let approveResult = mailTrans.sendMail(updatedData.email, verifySubject, verifiedContent);
                }
                if (user.userRole == "Admin" && extracted.userStatus == "inactivate" && extracted.userStatus != existUser.userStatus) {
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

exports.getAllHotelAndRestaurants = async (req, res) => {
    try {
        const user = req.user;
        const { search = '', page = 1 } = req.body;
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

        const restauData = await RestauHire.find(query, { aic: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, userStatus: 1, selectedoption: 1, signature: 1, userRole: 1, contactEmail: 1 })
                                            .sort({ entryDate: -1 });

        const hotelData = await HoteLHire.find(query, { aic: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, userStatus: 1, selectedoption: 1, signature: 1, userRole: 1, contactEmail: 1 })
                                            .sort({ entryDate: -1 });

        let restauDataArr = [];
        restauData.map((item, index) => {
            restauDataArr.push([
                item.aic,
                moment(item.entryDate).format("MM/DD/YYYY"),
                item.companyName,
                item.firstName + " " + item.lastName,
                item.userStatus,
                item.selectedoption,
                item.signature,
                "Restaurant Manager",
                "view_shift",
                "pw",
                item.contactEmail
            ]);
        });

        let hotelDataArr = [];
        hotelData.map((item, index) => {
            hotelDataArr.push([
                item.aic,
                moment(item.entryDate).format("MM/DD/YYYY"),
                item.companyName,
                item.firstName + " " + item.lastName,
                item.userStatus,
                item.selectedoption,
                item.signature,
                "Hotel Manager",
                "view_shift",
                "pw",
                item.contactEmail
            ]);
        });

        const combinedList = [...restauDataArr, ...hotelDataArr];
        const totalRecords = combinedList.length;
        const dataArray = combinedList.slice(skip, skip + limit);
        const totalPageCnt = Math.ceil(totalRecords / limit);

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

exports.getHotelAndRestaurantInfo = async (req, res) => {
    try {
        const user = req.user;
        const { userId, userRole } = req.body;

        if (userRole == 'Restaurant Manager') {
            const userData = await RestauHire.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, aic: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1, contactPhone: 1, address: 1 });
            const jobList = await RestaJob.find({ facilityId: userId }, { jobId: 1, entryDate: 1, jobNum: 1, jobStatus: 1, shiftDate: 1, shiftTime: 1 });
            
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
        } else if (userRole == 'Hotel Manager') {
            const userData = await HoteLHire.findOne({ aic: userId }, { entryDate: 1, firstName: 1, lastName: 1, aic: 1, contactEmail: 1, companyName: 1, userRole: 1, userStatus: 1, contactPhone: 1, address: 1 });
            const jobList = await HotelJob.find({ facilityId: userId }, { jobId: 1, entryDate: 1, jobNum: 1, jobStatus: 1, shiftDate: 1, shiftTime: 1 });
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
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.shifts = async (req, res) => {
    try {
        const user = req.user;

        const { rSearch = '', rPage = 1, hSearch = '', hPage = 1 } = req.body;
        const limit = 15;
        const rSkip = (rPage - 1) * limit;
        const hSkip = (hPage - 1) * limit;
        const rQuery = {};
        const hQuery = {};
  
        if (rSearch.trim()) {
            const isNumeric = !isNaN(rSearch);
            rQuery.$or = [
                { entryDate: { $regex: rSearch, $options: 'i' } },
                { facility: { $regex: rSearch, $options: 'i' } },
                { jobNum: { $regex: rSearch, $options: 'i' } },
                { location: { $regex: rSearch, $options: 'i' } },
                { jobStatus: { $regex: rSearch, $options: 'i' } },
                ...(isNumeric ? [{ jobId: Number(rSearch) }] : []),
                { noStatusExplanation: { $regex: rSearch, $options: 'i' } }
            ];
        }

        if (hSearch.trim()) {
            const isNumeric = !isNaN(hSearch);
            hQuery.$or = [
                { entryDate: { $regex: hSearch, $options: 'i' } },
                { facility: { $regex: hSearch, $options: 'i' } },
                { jobNum: { $regex: hSearch, $options: 'i' } },
                { location: { $regex: hSearch, $options: 'i' } },
                { jobStatus: { $regex: hSearch, $options: 'i' } },
                ...(isNumeric ? [{ jobId: Number(hSearch) }] : []),
                { noStatusExplanation: { $regex: hSearch, $options: 'i' } }
            ];
        }
  
        const rPipeline = [
            { $match: rQuery },
            { 
                $addFields: { 
                    parsedEntryDate: { $dateFromString: { dateString: "$entryDate" } }
                }
            },{ 
                $sort: { parsedEntryDate: -1 } 
            }, 
            { $project: {
                entryDate: 1, facility: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, 
                shiftTime: 1, degree: 1, jobStatus: 1, isHoursSubmit: 1, isHoursApproved: 1,
                timeSheet: { content: '$timeSheet.content', name: '$timeSheet.name', type: '$timeSheet.type' },
                timeSheetTemplate: { content: '', name: '$timeSheetTemplate.name', type: '$timeSheetTemplate.type' },
                noStatusExplanation: 1
            }},
            { $skip: rSkip },
            { $limit: limit }
        ];

        const hPipeline = [
            { $match: hQuery },
            { 
                $addFields: { 
                    parsedEntryDate: { $dateFromString: { dateString: "$entryDate" } }
                }
            },{ 
                $sort: { parsedEntryDate: -1 } 
            }, 
            { $project: {
                entryDate: 1, facility: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, 
                shiftTime: 1, degree: 1, jobStatus: 1, isHoursSubmit: 1, isHoursApproved: 1,
                timeSheet: { content: '$timeSheet.content', name: '$timeSheet.name', type: '$timeSheet.type' },
                timeSheetTemplate: { content: '', name: '$timeSheetTemplate.name', type: '$timeSheetTemplate.type' },
                noStatusExplanation: 1
            }},
            { $skip: hSkip },
            { $limit: limit }
        ];
  
        const restauData = await RestaJob.aggregate(rPipeline);
        const totalResetauJobRecords = await RestaJob.countDocuments(rQuery);
        const totalRestauPageCnt = Math.ceil(totalResetauJobRecords / limit);

        const restauJobIds = restauData.map(item => item.jobId);
        const restauBids = await RestauBid.find({ jobId: { $in: restauJobIds } }).lean();
        const restauBidMap = {};
        const totalRestauBidCountMap = {};
        
        restauBids.forEach(bid => {
            if (bid.bidStatus === 'Awarded') {
                restauBidMap[bid.jobId] = bid.caregiver;
            }
            totalRestauBidCountMap[bid.jobId] = (totalRestauBidCountMap[bid.jobId] || 0) + 1;
        });
  
        let restauDataArray = [];
        for (const item of restauData) {
            restauDataArray.push([
                item.entryDate,
                item.facility,
                item.jobId,
                item.jobNum,
                item.location,
                item.shiftDate,
                item.shiftTime,
                "view_shift",
                item.degree,
                item.jobStatus,
                restauBidMap[item.jobId] || '',
                totalRestauBidCountMap[item.jobId] || 0,
                "view_hours",
                item.isHoursSubmit ? "yes" : "no",
                item.isHoursApproved ? "yes" : "no",
                item.timeSheet,
                item.timeSheetTemplate?.name,
                item.noStatusExplanation,
                "delete",
                "Restaurant"
            ]);
        }

        const hotelData = await HotelJob.aggregate(hPipeline);
        const totalHotelJobRecords = await HotelJob.countDocuments(hQuery);
        const totalHotelPageCnt = Math.ceil(totalHotelJobRecords / limit);

        const hotelJobIds = hotelData.map(item => item.jobId);
        const hotelBids = await RestauBid.find({ jobId: { $in: hotelJobIds } }).lean();
        const hotelBidMap = {};
        const totalHotelBidCountMap = {};
        
        hotelBids.forEach(bid => {
            if (bid.bidStatus === 'Awarded') {
                hotelBidMap[bid.jobId] = bid.caregiver;
            }
            totalHotelBidCountMap[bid.jobId] = (totalHotelBidCountMap[bid.jobId] || 0) + 1;
        });
  
        let hotelDataArray = [];
        for (const item of hotelData) {
            hotelDataArray.push([
                item.entryDate,
                item.facility,
                item.jobId,
                item.jobNum,
                item.location,
                item.shiftDate,
                item.shiftTime,
                "view_shift",
                item.degree,
                item.jobStatus,
                hotelBidMap[item.jobId] || '',
                totalHotelBidCountMap[item.jobId] || 0,
                "view_hours",
                item.isHoursSubmit ? "yes" : "no",
                item.isHoursApproved ? "yes" : "no",
                item.timeSheet,
                item.timeSheetTemplate?.name,
                item.noStatusExplanation,
                "delete",
                "Hotel"
            ]);
        }

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };
        const token = setToken(payload);

        return res.status(200).json({ message: "Successfully Get!", restauDataArray, hotelDataArray, totalRestauPageCnt, totalHotelPageCnt, token });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.removeJob = async (req, res) => {
    const { jobId, role } = req.body;
    if (!jobId) {
        return res.status(500).json({ message: "JobId not exist!" });
    } else {
        if (role === 'Restaurant') {
            const result = await RestaJob.deleteOne({ jobId: jobId });
            return res.status(200).json({ message: "Successfully Removed" });
        } else if (role === 'Hotel') {
            const result = await HotelJob.deleteOne({ jobId: jobId });
            return res.status(200).json({ message: "Successfully Removed" });
        }
    }
};

exports.updateJob = async (req, res) => {
    try {
        const request = req.body;

        if (request.role === 'Restaurant') {
            await RestaJob.updateOne(
                        { jobId: request.jobId },
                        { $set: request },
                        { upsert: false }
                    )
                    .then(result => {
                        if (result.nModified === 0) {
                            return res.status(500).json({ error: 'Job not found or no changes made' });
                        }
                        return res.status(200).json({ message: 'Updated' });
                    })
                    .catch(err => {
                        console.error(err);
                        return res.status(500).json({ error: err.message });
                    });
        } else if (request.role === 'Hotel') {
            await HotelJob.updateOne(
                        { jobId: request.jobId },
                        { $set: request },
                        { upsert: false }
                    )
                    .then(result => {
                        if (result.nModified === 0) {
                            return res.status(500).json({ error: 'Job not found or no changes made' });
                        }
                        return res.status(200).json({ message: 'Updated' });
                    })
                    .catch(err => {
                        console.error(err);
                        return res.status(500).json({ error: err.message });
                    });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.updateDocuments = async (req, res) => {
    try {
        const user = req.user;
        const { file, type, prevFile, jobId, role } = req.body;
    
        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        };
        const token = setToken(payload);
  
        if (role === 'Restaurant') {
            if (type == 'timesheet') {
                if (file.name != '') {
                    const s3FileUrl = await uploadToS3(file);
                    await RestaJob.updateOne({ jobId }, { $set: {timeSheet: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
                } else {
                    if (prevFile == '') {
                        await RestaJob.updateOne({ jobId }, { $set: {timeSheet: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                    }
                }
                return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
            } else {
                if (file.name != '') {
                    const s3FileUrl = await uploadToS3(file);
                    await RestaJob.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
                } else {
                    if (prevFile == '') {
                        await RestaJob.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                    }
                }
                return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
            }
        } else if (role === 'Hotel') {
            if (type == 'timesheet') {
                if (file.name != '') {
                    const s3FileUrl = await uploadToS3(file);
                    await HotelJob.updateOne({ jobId }, { $set: {timeSheet: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
                } else {
                    if (prevFile == '') {
                        await HotelJob.updateOne({ jobId }, { $set: {timeSheet: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                    }
                }
                return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
            } else {
                if (file.name != '') {
                    const s3FileUrl = await uploadToS3(file);
                    await HotelJob.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
                } else {
                    if (prevFile == '') {
                        await HotelJob.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                    }
                }
                return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred", error });
    }
};

exports.getJob = async (req, res) => {
    try {
        // const user = req.user;
        const {jobId, role} = req.body;
    
        if (!jobId) {
            return res.status(500).json({ message: "JobId not exist" });
        }
    
        if (role === 'Restaurant') {
            let jobData = await RestaJob.findOne({ jobId }, { entryDate: 1, jobId: 1, jobNum: 1, nurse: 1, degree: 1, shiftTime: 1, isHoursApproved: 1, shiftDate: 1, payRate: 1, jobStatus: 1, timeSheet: { content: '',name: '$timeSheet.name',type: '$timeSheet.type'}, jobRating: 1, location: 1, bonus: 1 });
            const bidders = await RestauBid.find({ jobId }, { entryDate: 1, bidId: 1, caregiver: 1, message: 1, bidStatus: 1, caregiverId: 1 });
      
            let biddersList = await Promise.all(bidders.map(async (item) => {
                let bidderInfo = await RestauWork.findOne({ aic: item.caregiverId }, { email: 1, phoneNumber: 1 });
                return [
                    item.entryDate,
                    item.caregiver,
                    "",
                    item.message,
                    item.bidStatus,
                    "",
                    item.bidId,
                    bidderInfo?.email || '',
                    bidderInfo?.phoneNumber || '',
                ];
            }));
      
            const workedHours = calculateShiftHours(jobData.shiftStartTime, jobData.shiftEndTime);
            const startTime = jobData.shiftStartTime ? getTimeFromDate(jobData.shiftStartTime) : '';
            const endTime = jobData.shiftEndTime ? getTimeFromDate(jobData.shiftEndTime) : '';
    
            let workedHoursStr = '';
    
            if (startTime != "" && endTime != "") {
                workedHoursStr = startTime + " to " + endTime + " = " + workedHours;
            }

            console.log(jobData);
    
            jobData = { ...jobData.toObject(), workedHours: workedHoursStr, bid_offer: bidders.length };
    
            return res.status(200).json({
                message: "Successfully Get",
                jobData,
                bidders: biddersList
            });
        } else if (role === 'Hotel') {
            let jobData = await HotelJob.findOne({ jobId }, { entryDate: 1, jobId: 1, jobNum: 1, isHoursApproved: 1, nurse: 1, degree: 1, shiftTime: 1, shiftDate: 1, payRate: 1, jobStatus: 1, timeSheet: { content: '',name: '$timeSheet.name',type: '$timeSheet.type'}, jobRating: 1, location: 1, bonus: 1 });
            const bidders = await HotelBid.find({ jobId }, { entryDate: 1, bidId: 1, caregiver: 1, message: 1, bidStatus: 1, caregiverId: 1 });
      
            let biddersList = await Promise.all(bidders.map(async (item) => {
                let bidderInfo = await HotelWork.findOne({ aic: item.caregiverId }, { email: 1, phoneNumber: 1 });
                return [
                    item.entryDate,
                    item.caregiver,
                    "",
                    item.message,
                    item.bidStatus,
                    "",
                    item.bidId,
                    bidderInfo?.email || '',
                    bidderInfo?.phoneNumber || '',
                ];
            }));
      
            const workedHours = calculateShiftHours(jobData.shiftStartTime, jobData.shiftEndTime);
            const startTime = jobData.shiftStartTime ? getTimeFromDate(jobData.shiftStartTime) : '';
            const endTime = jobData.shiftEndTime ? getTimeFromDate(jobData.shiftEndTime) : '';
    
            let workedHoursStr = '';
    
            if (startTime != "" && endTime != "") {
                workedHoursStr = startTime + " to " + endTime + " = " + workedHours;
            }
    
            jobData = { ...jobData.toObject(), workedHours: workedHoursStr, bid_offer: bidders.length };
    
            return res.status(200).json({
                message: "Successfully Get",
                jobData,
                bidders: biddersList
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred", error });
    }
};

exports.updateHoursStatus = async (req, res) => {
    const { shiftFromDate, shiftEndDate, preTime, isHoursApproved, noStatusExplanation, lunch, jobId, role } = req.body;
  
    let finalHoursEquation = 0;
    if (typeof preTime == 'number' && preTime) {
        finalHoursEquation = preTime;
    } else if (typeof preTime != 'number' && preTime) {
        finalHoursEquation = parseFloat(preTime);
    }
  
    if (role === 'Restaurant') {
        const result = await RestaJob.updateOne({ jobId }, { $set: { isHoursApproved, lunch, preTime, noStatusExplanation, finalHoursEquation, shiftFromDate, shiftEndDate } });
    } else if (role === 'Hotel') {
        const result = await HotelJob.updateOne({ jobId }, { $set: { isHoursApproved, lunch, preTime, noStatusExplanation, finalHoursEquation, shiftFromDate, shiftEndDate } });
    }
    return res.status(200).json({ message: "Success" });
};