const db = require("../models/index.js");
const { setToken } = require('../utils/verifyToken.js');
const Job = db.hotel_job;
const Bid = db.hotel_bid;
const Hotel_Manager = db.hotel_manager;
const hotel_user = db.hotel_user;
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const mailTrans = require("./mailTrans.controller.js");
const invoiceHTML = require('../utils/invoiceHtml.js');
const { generatePDF } = require('../utils/pdf.js');
const path = require('path');
const cron = require('node-cron');
const phoneSms = require('./twilio.js');
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

function parseTime(timeString) {
    const [datePart, timePart] = timeString.split(' ');
    const [month, day, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
}

function getTimeFromDate(timeString) {
    const [datePart, timePart] = timeString.split(' ');
    const [hours, minutes] = timePart.split(':').map(Number);
    return hours + ":" + minutes;
};

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

function parseTime(timeStr) {
    const [time, period] = timeStr.match(/(\d+\.?\d*)([ap]?)/).slice(1);
    let [hours, minutes] = time.split('.').map(Number);
    if (period === 'p' && hours < 12) hours += 12;
    if (period === 'a' && hours === 12) hours = 0;
    return new Date(0, 0, 0, hours, minutes || 0);
}

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

exports.updateTimeSheet = async (req, res) => {
    const user = req.user;
    const request = req.body;
    const payload = {
        email: user.email,
        userRole: user.userRole,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expirationTime
    };
    const token = setToken(payload);
    let timeSheetFile = request.timeSheet;

    if (timeSheetFile == "" || !timeSheetFile) {
        await Job.updateOne({ jobId: request.jobId }, { $set: {timeSheet: { content: '', name: '', type: '' }, jobStatus: 'Pending'} });
        return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
    } else {
        const jobDetail = await Job.findOne({ jobId: request.jobId }, { facilityId: 1 });
        const facility = await Hotel_Manager.findOne({ aic: jobDetail.facilityId }, { contactEmail: 1 });
        const s3FileUrl = await uploadToS3(timeSheetFile);

        await Job.updateOne({ jobId: request.jobId }, { $set: {timeSheet: { content: s3FileUrl, name: timeSheetFile.name, type: timeSheetFile.type }, jobStatus: 'Pending Verification'} });

        const verifySubject1 = `${user.firstName} ${user.lastName} has uploaded a timesheet for Shift ID # ${request.jobId}`
        const verifiedContent1 = `
        <div id=":15j" class="a3s aiL ">
            <p><strong>Shift ID</strong> : ${request.jobId}</p>
            <p><strong>Name</strong> : ${user.firstName} ${user.lastName}</p>
            <p><strong>Timesheet</strong> : ${timeSheetFile?.name || ''}</p>
        </div>`;

        let approveResult1 = await mailTrans.sendMail('support@whybookdumb.com', verifySubject1, verifiedContent1, request.timeSheet);
        let approveResult2 = await mailTrans.sendMail('getpaid@whybookdumb.com', verifySubject1, verifiedContent1, request.timeSheet);
        let approveResult3 = await mailTrans.sendMail('techableteam@gmail.com', verifySubject1, verifiedContent1, request.timeSheet);
        let approveResult4 = await mailTrans.sendMail(facility?.contactEmail, verifySubject1, verifiedContent1, request.timeSheet);

        return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
    }
};

exports.updateDocuments = async (req, res) => {
    try {
        const user = req.user;
        const { file, type, prevFile, jobId } = req.body;
        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        };
        const token = setToken(payload);

        if (type == 'timesheet') {
            if (file.name != '') {
                const s3FileUrl = await uploadToS3(file);
                await Job.updateOne({ jobId }, { $set: {timeSheet: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
            } else {
                if (prevFile == '') {
                    await Job.updateOne({ jobId }, { $set: {timeSheet: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                }
            }
            return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
        } else {
            if (file.name != '') {
                const s3FileUrl = await uploadToS3(timeSheetFile);
                await Job.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: s3FileUrl, type: file.type, name: file.name }, jobStatus: 'Pending Verification'} });
            } else {
                if (prevFile == '') {
                    await Job.updateOne({ jobId }, { $set: {timeSheetTemplate: { content: '', type: '', name: '' }, jobStatus: 'Available'} });
                }
            }
            return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred", error });
    }
};

exports.postJob = async (req, res) => {
    try {
        if (!req.body.jobId) {
            const lastJob = await Job.find().sort({ jobId: -1 }).limit(1);
            const lastJobId = lastJob.length > 0 ? lastJob[0].jobId : 0;
            const newJobId = lastJobId + 1;
            const response = req.body;
            response.entryDate = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
            response.payRate = response.payRate;
            response.jobId = newJobId;
            const auth = new Job(response);
            await auth.save();
            return res.status(200).json({ message: "Published successfully" });
        } else {
            const request = req.body;

            await Job.updateOne(
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

exports.removeJob = async (req, res) => {
    if (!req.body.jobId) {
        return res.status(500).json({ message: "JobId not exist!" });
    } else {
        const result = await Job.deleteOne({ jobId: req.body.jobId });
        return res.status(200).json({ message: "Successfully Removed" });
    }
};

exports.shifts = async (req, res) => {
    try {
        const user = req.user;
        const role = req.headers.role;

        if (role === 'HotelHire') {
            const { search = '', page = 1 } = req.body;
            const limit = 25;
            const skip = (page - 1) * limit;
            const query = {};

            if (search.trim()) {
                const isNumeric = !isNaN(search);
                query.$or = [
                    { entryDate: { $regex: search, $options: 'i' } },
                    { degree: { $regex: search, $options: 'i' } },
                    { jobNum: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    ...(isNumeric ? [{ jobId: Number(search) }] : []),
                ];
            }

            const pipeline = [
                { $match: { ...query, facilityId: user?.aic } },
                { 
                    $addFields: { 
                        parsedEntryDate: { $dateFromString: { dateString: "$entryDate" } }
                    }
                },{ 
                    $sort: {
                        parsedEntryDate: -1
                    } 
                }, 
                { 
                    $project: {
                        facility: 1, degree: 1, entryDate: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, shiftTime: 1, bid_offer: 1, jobStatus: 1, timeSheetVerified: 1, jobRating: 1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];
        
            const data = await Job.aggregate(pipeline);
            let dataArray = [];

            for (const item of data) {
                const hiredUser = await Bid.findOne({ jobId: item.jobId, bidStatus: 'Awarded' }, { caregiver: 1 });
                dataArray.push([
                    item.degree,
                    item.entryDate,
                    item.jobId,
                    item.jobNum,
                    item.location,
                    item.shiftDate,
                    item.shiftTime,
                    "",
                    item.bid_offer,
                    item.jobStatus,
                    hiredUser ? hiredUser.caregiver : '',
                    item.timeSheetVerified,
                    item.jobRating,
                    "delete"
                ]);
            }
            const totalRecords = await Job.countDocuments(query);
            const totalPageCnt = Math.ceil(totalRecords / limit);

            const payload = {
                contactEmail: user.contactEmail,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            };
            const token = setToken(payload);
            if (token) {
                return res.status(200).json({ message: "Successfully Get!", dataArray, token, totalPageCnt });
            } else {
                return res.status(400).json({ message: "Cannot logined User!" })
            }
        } else if (role === "HotelWork") {
            const today = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
            const data = await Job.find({ 
                entryDate: { 
                    $gte: today
                }
            }, { jobId: 1, degree: 1, shiftDate: 1, shiftTime: 1, location: 1, jobStatus: 1, jobNum: 1, payRate: 1, jobInfo: 1, bonus: 1 }).sort({ entryDate: 1 });
            let dataArray = [];
            data.map((item, index) => {
                if (item.jobStatus == 'Available' && item.degree == user.title) {
                    dataArray.push({
                        jobId: item.jobId,
                        degree: item.degree,
                        shiftDate: item.shiftDate,
                        shift: item.shiftTime,
                        location: item.location,
                        status: item.jobStatus,
                        jobNum: item.jobNum,
                        payRate: item.payRate,
                        jobInfo: item.jobInfo,
                        bonus: item.bonus
                    });
                }
            });

            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);

            if (token) {
                return res.status(200).json({ message: "Successfully Get!", dataArray, token });
            } else {
                return res.status(400).json({ message: "Cannot logined User!" })
            }
        } else if (role === 'Admin') {
            const { search = '', page = 1 } = req.body;
            const limit = 25;
            const skip = (page - 1) * limit;
            const query = {};

            if (search.trim()) {
                const isNumeric = !isNaN(search);
                query.$or = [
                    { entryDate: { $regex: search, $options: 'i' } },
                    { facility: { $regex: search, $options: 'i' } },
                    { jobNum: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    { jobStatus: { $regex: search, $options: 'i' } },
                    ...(isNumeric ? [{ jobId: Number(search) }] : []),
                    { noStatusExplanation: { $regex: search, $options: 'i' } }
                ];
            }

            const pipeline = [
                { $match: query },
                { 
                    $addFields: { 
                        parsedEntryDate: { $dateFromString: { dateString: "$entryDate" } }
                    }
                },{ 
                    $sort: {
                        parsedEntryDate: -1
                    } 
                }, 
                { 
                    $project: {
                        entryDate: 1, facility: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, 
                        shiftTime: 1, degree: 1, jobStatus: 1, isHoursSubmit: 1, isHoursApproved: 1,
                        timeSheet: { content: '$timeSheet.content', name: '$timeSheet.name', type: '$timeSheet.type' },
                        timeSheetTemplate: { content: '', name: '$timeSheetTemplate.name', type: '$timeSheetTemplate.type' },
                        noStatusExplanation: 1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            const data = await Job.aggregate(pipeline);
            const totalRecords = await Job.countDocuments(query);
            const totalPageCnt = Math.ceil(totalRecords / limit);
            const jobIds = data.map(item => item.jobId);
            const bids = await Bid.find({ jobId: { $in: jobIds } }).lean();
            const bidMap = {};
            const totalBidCountMap = {};
        
            bids.forEach(bid => {
                if (bid.bidStatus === 'Awarded') {
                    bidMap[bid.jobId] = bid.caregiver;
                }
                totalBidCountMap[bid.jobId] = (totalBidCountMap[bid.jobId] || 0) + 1;
            });

            let dataArray = [];
            for (const item of data) {
                dataArray.push([
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
                    bidMap[item.jobId] || '',
                    totalBidCountMap[item.jobId] || 0,
                    "view_hours",
                    item.isHoursSubmit ? "yes" : "no",
                    item.isHoursApproved ? "yes" : "no",
                    item.timeSheet,
                    item.timeSheetTemplate?.name,
                    item.noStatusExplanation,
                    "delete"
                ]);
            }
            return res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getJob = async (req, res) => {
    try {
        const jobId = req.body.jobId;

        if (!jobId) {
            return res.status(500).json({ message: "JobId not exist" });
        }

        let jobData = await Job.findOne({ jobId }, { entryDate: 1, jobId: 1, jobNum: 1, nurse: 1, degree: 1, shiftTime: 1, shiftDate: 1, payRate: 1, jobStatus: 1, timeSheet: { content: '',name: '$timeSheet.name',type: '$timeSheet.type'}, jobRating: 1, location: 1, bonus: 1 });
        const bidders = await Bid.find({ jobId }, { entryDate: 1, bidId: 1, caregiver: 1, message: 1, bidStatus: 1, caregiverId: 1 });
        let biddersList = await Promise.all(bidders.map(async (item) => {
            let bidderInfo = await hotel_user.findOne({ aic: item.caregiverId }, { email: 1, phoneNumber: 1 });
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
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred", error });
    }
};

exports.updateHoursStatus = async (req, res) => {
    const shiftFromDate = req.body.fromDate;
    const shiftEndDate = req.body.endDate;
    const preTime = req.body.preTime;
    const isHoursApproved = req.body.approved;
    const noStatusExplanation = req.body.explanation;
    const lunch = req.body.lunch;
    const jobId = req.body.jobId;

    let finalHoursEquation = 0;
    if (typeof preTime == 'number' && preTime) {
        finalHoursEquation = preTime;
    } else if (typeof preTime != 'number' && preTime) {
        finalHoursEquation = parseFloat(preTime);
    }

    const result = await Job.updateOne({ jobId }, { $set: { isHoursApproved, lunch, preTime, noStatusExplanation, finalHoursEquation, shiftFromDate, shiftEndDate } });
    return res.status(200).json({ message: "Success" });
};

exports.setAwarded = async (req, res) => {
    const jobId = req.body.jobId;
    const bidId = req.body.bidderId;
    const status = req.body.status;
    const nurse = await Bid.findOne({ bidId });
    const user = await hotel_user.findOne({ aic: nurse.caregiverId }, { email: 1 } );

    if (status === 1) {
        await Job.updateOne({ jobId }, { $set: { jobStatus: 'Awarded', nurse: nurse?.caregiver }});
        await Bid.updateOne({ bidId }, { $set: { bidStatus: 'Awarded' }})

        const verifySubject1 = `Congrats ${nurse?.caregiver}, You Have Been Hired for Shift - #${jobId}`
        const verifiedContent1 = `
        <div id=":15j" class="a3s aiL ">
            <p><strong>Entry Date</strong> - ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
            <p><strong>Job</strong> - ${jobId}</p>
            <p><strong>Name</strong> : ${nurse?.caregiver}</p>
        </div>`
        
        let approveResult = mailTrans.sendMail(user?.email, verifySubject1, verifiedContent1);

        const verifySubject2 =  `${nurse?.caregiver} was hired for Shift - #${jobId}`
        const verifiedContent2 = `
        <div id=":15j" class="a3s aiL ">
            <p><strong>Entry Date</strong> - ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
            <p><strong>Job</strong> - ${jobId}</p>
            <p><strong>Name</strong> : ${nurse?.caregiver}</p>
        </div>`
        
        let approveResult2 = mailTrans.sendMail('support@whybookdumb.com', verifySubject2, verifiedContent2);
        let approveResult1 = mailTrans.sendMail('techableteam@gmail.com', verifySubject2, verifiedContent2);
    }

    return res.status(200).json({ message: "Success" });
};

exports.updateJobRatings = async (req, res) => {
    const jobId = req.body.jobId;
    const rating = req.body.rating;

    await Job.updateOne({ jobId }, { $set: { jobRating: rating }});
    return res.status(200).json({ message: "Success" });
};

exports.updateJobTSVerify = async (req, res) => {
    const jobId = req.body.jobId;
    const status = req.body.status;
    const file = req.body.file;
    const JobDetails = await Job.findOne({ jobId });
    const clinicalInfo = await hotel_user.findOne({ firstName: JobDetails.nurse.split(' ')[0], lastName: JobDetails.nurse.split(' ')[1] });

    if (status == 1) {
        await Job.updateOne({ jobId }, { $set: { timeSheetVerified: true, jobStatus: 'Verified' }});
    } else {
        await Job.updateOne({ jobId }, { $set: { timeSheetVerified: false }});
    }

    if (file?.content) {
        const s3FileUrl = await uploadToS3(file);
        await Job.updateOne({ jobId }, { $set: { timeSheet: { name: file.name, content: s3FileUrl, type: file.type } }});
    }

    if (status == 1) {
        const subject1 = `${clinicalInfo?.firstName} ${clinicalInfo?.lastName} - Your Timesheet has been verified!`;
        const content1 = `<div id=":18t" class="a3s aiL ">
            <p><strong>Job / Shift</strong> : ${jobId}</p>
            <p><strong>Hotel_Manager</strong> : ${JobDetails?.location || ''}</p>
            <p><strong>Shift Date</strong> : ${JobDetails?.shiftDate || ''}</p>
            <p><strong>Time</strong> : ${JobDetails?.shiftTime || ''}</p>
        </div>`;
        let sendResult1 = mailTrans.sendMail(clinicalInfo?.email, subject1, content1);

        const subject2 = `${clinicalInfo?.firstName} ${clinicalInfo?.lastName}'s timesheet has been verified!`;
        const content2 = `<div id=":18t" class="a3s aiL ">
            <p><strong>Job / Shift</strong> : ${jobId}</p>
            <p><strong>Hotel_Manager</strong> : ${JobDetails?.location || ''}</p>
            <p><strong>Shift Date</strong> : ${JobDetails?.shiftDate || ''}</p>
            <p><strong>Time</strong> : ${JobDetails?.shiftTime || ''}</p>
        </div>`;

        let sendResult21 = mailTrans.sendMail('support@whybookdumb.com', subject2, content2);
        let sendResult31 = mailTrans.sendMail('getpaid@whybookdumb.com', subject2, content2);
        let sendResult2 = mailTrans.sendMail('techableteam@gmail.com', subject2, content2);
    }
    return res.status(200).json({ message: "Success" });
};

exports.myShift = async (req, res) => {
    try {
        const user = req.user;

        const jobIds = await Bid.find({ caregiverId: user?.aic, bidStatus: { $ne: 'Not Awarded' }  }, { jobId: 1 }).lean();
        const jobIdArray = jobIds.map(bid => bid.jobId);
        const data = await Job.find({ jobId: { $in: jobIdArray } }, { timeSheet: { content: '', name: '$timeSheet.name', type: '$timeSheet.type' }, jobId: 1, location: 1, payRate: 1, jobStatus: 1, nurse: 1, unit: 1, entryDate: 1, shiftDate: 1, shiftTime: 1, shiftDateAndTimes: 1, laborState: 1, shiftStartTime: 1, shiftEndTime: 1 }).sort({ entryDate: -1, shiftDate: -1 });

        let dataArray = [];
        
        data.map((item) => {
            let file = item.timeSheet;
            file.content = '';
            dataArray.push({
            jobId: item.jobId,
            location: item.location,
            payRate: item.payRate,
            shiftStatus: item.jobStatus,
            caregiver: item.nurse,
            timeSheet: file,
            unit: item.unit,
            entryDate: item.entryDate,
            shiftDate: item.shiftDate,
            shiftTime: item.shiftTime,
            shiftDateAndTimes: item.shiftDateAndTimes,
            laborState: item.laborState,
            shiftStartTime: item.shiftStartTime,
            shiftEndTime: item.shiftEndTime
            });
        });
        const date = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
        const jobs = await Job.find({ jobId: { $in: jobIdArray }, shiftDate: date }, { payRate: 1, shiftStartTime: 1, shiftEndTime: 1, bonus: 1, jobStatus: 1 });
        let totalPay = 0;

        for (const job of jobs) {
            if (!['Available', 'Cancelled', 'Paid'].includes(job.jobStatus)) {
                const payRate = job.payRate != '$' ? job.payRate == '' ? 0 : parseFloat(job.payRate.replace('$', '')) : 0;
                const shiftHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
                const bonus = job.bonus != '$' ? job.bonus == '' ? 0 : parseFloat(job.bonus.replace('$', '')) : 0;
                totalPay += payRate * shiftHours + bonus;
            }
        }

        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() + 6) % 7);

        const weekly = await Job.find({
            email: user.email,
            shiftDate: {
            $gte: moment(monday, "America/Toronto").format("MM/DD/YYYY"),
            $lte: moment.tz(today, "America/Toronto").format("MM/DD/YYYY"),
            },
        }, { payRate: 1, jobStatus: 1, shiftStartTime: 1, shiftEndTime: 1, bonus: 1 });

        let weeklyPay = 0;

        for (const job of weekly) {
            if (!['Available', 'Cancelled', 'Paid'].includes(job.jobStatus)) {
                const payRate = job.payRate != '$' ? job.payRate == '' ? 0 : parseFloat(job.payRate.replace('$', '')) : 0;
                const shiftHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
                const bonus = job.bonus != '$' ? job.bonus == '' ? 0 : parseFloat(job.bonus.replace('$', '')) : 0;
                weeklyPay += payRate * shiftHours + bonus;
            }
        }
        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        }
        const token = setToken(payload);
        if (token) {
            return res.status(200).json({
                message: "Successfully Get!",
                jobData: {
                    reportData: dataArray,
                    dailyPay: { pay: totalPay, date: date },
                    weeklyPay: { date: moment(monday, "America/Toronto").format("MM/DD/YYYY") + "-" + moment(today, "America/Toronto").format("MM/DD/YYYY"), pay: weeklyPay }
                },
                token: token
            });
        } else {
            return res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.getCaregiverTimesheets = async (req, res) => {
    const user = req.user;
    const { search = '', page = 1, filters = [] } = req.body;
    const limit = 25;
    const skip = (page - 1) * limit;

    try {
        const query = {};

        if (search) {
            const isNumeric = !isNaN(search);

            query.$or = [
                ...(isNumeric ? [{ jobId: Number(search) }] : []),
                { nurse: { $regex: search, $options: 'i' } },
                { shiftTime: { $regex: search, $options: 'i' } },
                { shiftDate: { $regex: search, $options: 'i' } },
                { lunch: { $regex: search, $options: 'i' } },
                ...(isNumeric ? [{ lunchEquation: Number(search) }] : []),
                ...(isNumeric ? [{ finalHoursEquation: Number(search) }] : []),
                { preTime: { $regex: search, $options: 'i' } }
            ];
        }

        const jobs = await Job.find(query, { shiftStartTime: 1, shiftEndTime: 1, jobId: 1, nurse: 1, shiftDate: 1, shiftTime: 1, jobStatus: 1, preTime: 1, lunch: 1, lunchEquation: 1, finalHoursEquation: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalRecords = await Job.countDocuments(query);
        const totalPageCnt = Math.ceil(totalRecords / limit);

        let dataArray = [];

        for (const job of jobs) {
            const workedHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
            const startTime = job.shiftStartTime ? getTimeFromDate(job.shiftStartTime) : '';
            const endTime = job.shiftEndTime ? getTimeFromDate(job.shiftEndTime) : '';
            let workedHoursStr = '';

            if (startTime !== '' && endTime !== '') {
                workedHoursStr = `${startTime} to ${endTime} = ${workedHours}`;
            }

            dataArray.push([
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
            return res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt, token });
        } else {
            return res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (error) {
        console.error('Error occurred while fetching timesheets:', error);
        return res.status(500).json({ message: "An error occurred!" });
    }
};

exports.getTimesheet = async (req, res) => {
    try {
        let result = await Job.findOne({ jobId: req.body.jobId });
        return res.status(200).json({ message: "Success", data: result.timeSheet });
    } catch (e) {
        return res.status(500).json({ message: "An Error Occured!" });
    }
};

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
        const jobStatus = await Job.aggregate([
            {
                $group: {
                _id: "$jobStatus",
                count: { $sum: 1 }
                }
            }
        ]);
        const updatedCount = jobStatusCount.map(status => {
            const found = jobStatus.find(item => item._id === status._id);
            return {
                ...status,
                count: found ? found.count : status.count,
            };
        });
        const nurseStatus = await Job.aggregate([
            {
                $group: {
                    _id: "$nurse",
                    count: { $sum: 1 }
                }
            },
        ]);
        const results = await Job.aggregate([
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
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        }
        const token = setToken(payload);
        if (token) {
            return res.status(200).json({ message: "Successfully Get!", jobData: { job: updatedCount, nurse: nurseStatus, cal: results }, token: token });
        } else {
            return res.status(400).json({ message: "Cannot logined User!" });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

function extractNonJobId(job) {
    const keys = Object.keys(job);
    const nonJobIdKey = keys.find(key => key !== 'jobId');

    return {
        [nonJobIdKey]: job[nonJobIdKey]
    };
}

const MailTransfer = async (name, subject, content) => {
    const [firstName, lastName] = name;

    try {
        const clinician = await hotel_user.findOne({ firstName, lastName });
        if (clinician) {
            const sendResult = await mailTrans.sendMail(clinician.email, subject, content);
        } else {
            console.error('Clinician not found for:', firstName, lastName);
        }
    } catch (error) {
        console.error('Error fetching clinician or sending email:', error);
    }
}

function convertToInternationalFormat(phoneNumber) {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    if (cleanedNumber.length === 10) {
        return `+1${cleanedNumber}`;
    } else {
        throw new Error('Invalid phone number format. Expected format: (123) 123-1234');
    }
}

const pushSms = async (name, message) => {
    const [firstName, lastName] = name;
    try {
        const clinician = await hotel_user.findOne({ firstName, lastName });
        const phoneNumber = convertToInternationalFormat(clinician.phoneNumber)
        if (clinician) {
            const sendResult = await phoneSms.pushNotification(message, phoneNumber);
        } else {
            console.error('Clinician not found for:', firstName, lastName);
        }
    } catch (error) {
        console.error('Error fetching clinician or sending email:', error);
    }
}

function convertToDate(dateString, timeString) {
    const [month, day, year] = dateString.split('/').map(Number);
    const [startTime, endTime] = timeString.split('-');

    const parseTime = (time) => {
        const isPM = time.endsWith('p');
        const [hourPart, minutePart] = time.slice(0, -1).split('.');
        let hour = parseInt(hourPart, 10);
        const minutes = minutePart ? Math.round(parseFloat(`0.${minutePart}`) * 100) : 0;

        if (isPM && hour !== 12) {
            hour += 12;
        }
        if (!isPM && hour === 12) {
            hour = 0;
        }
        return { hour, minutes };
    };

    const { hour: startHour, minutes: startMinutes } = parseTime(startTime);
    const { hour: endHour, minutes: endMinutes } = parseTime(endTime);
    const date = new Date(Date.UTC(year, month - 1, day, startHour, startMinutes, 0));
    const startDateTime = new Date(date);
    const dateEnd = new Date(Date.UTC(year, month - 1, day, endHour, endMinutes, 0));
    const endDateTime = new Date(dateEnd);
    return { startDateTime, endDateTime };
}

const pushNotify = (reminderTime, name, verSub, verCnt, jobId, offsetTime, smsVerCnt) => {
    const currentDate = reminderTime.getTime();
    let reminderTimes = new Date(currentDate + offsetTime*60*60*1000);
    if (reminderTimes.getHours() < 2) {
        reminderTimes.setHours(reminderTimes.getHours() + 22);
        reminderTimes.setDate(reminderTimes.getDate() - 1);
    } else {
        reminderTimes.setHours(reminderTimes.getHours() - 2);
    }

    now = new Date(Date.now());

    if (reminderTimes.getTime() < now.getTime()) {
        reminderTimes.setHours(reminderTimes.getHours() + 1);
        if (reminderTimes.getTime() < now.getTime()) {
            return false;
        } else {
            now.setMinutes(now.getMinutes() + 1);
            reminderTimes = now;
        }
    }

    cron.schedule(
        reminderTimes.getMinutes() +
        " " +
        reminderTimes.getHours() +
        " " +
        reminderTimes.getDate() +
        " " +
        (reminderTimes.getMonth() + 1) +
        " *",
        async () => {
            const mailSend = MailTransfer(name, verSub, verCnt);
            const smsResults = pushSms(name, smsVerCnt);
            let succed = false;
            const updateUser = await Job.updateOne({ jobId: jobId }, { $set: {jobStatus: 'Verified'} });
            if (!updateUser) {
                return succed
            } else {
                succed = true;
                return succed;
            }
        }
    );
    return true;  
}

exports.Update = async (req, res) => {
    const request = req.body;
    const user = req.user;
    const extracted = extractNonJobId(request);

    if (user) {
        Job.findOneAndUpdate({ jobId: request.jobId }, { $set: extracted }, { new: false }, async (err, updatedDocument) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: err });
            } else {
                const subject = `BookSmart™ - You failed Job`
                const content = `<div id=":18t" class="a3s aiL ">
                        <p>
                        <strong> ${updatedDocument.nurse}: You failed in job:${updatedDocument.jobId} beacuse the Hotel_Manager don't accept you.<br></strong>
                        </p>
                        <p><strong>-----------------------<br></strong></p>
                        <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                        <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
                        <p><br></p>
                    </div>`
                const smsContent = `${updatedDocument.nurse}: You failed in job:${updatedDocument.jobId} beacuse the Hotel_Manager don't accept you.`
                const sucSub = `BookSmart™ - You accpeted Job`
                const sucCnt = `<div id=":18t" class="a3s aiL ">
                        <p>
                        <strong> ${updatedDocument.nurse}: You accepted in job:${updatedDocument.jobId}.<br></strong>
                        </p>
                        <p><strong>-----------------------<br></strong></p>
                        <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                        <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
                        <p><br></p>
                    </div>`
                const smsSucCnt = `${updatedDocument.nurse}: You accepted in job:${updatedDocument.jobId}.`
                    
                const verSub = `BookSmart™ - You have to prepare the job.`
                const verCnt = `<div id=":18t" class="a3s aiL ">
                        <p>
                        <strong> ${updatedDocument.nurse}: The job ${updatedDocument.jobId} will be started in 2 hours. Pleaset prepare the job.</strong>
                        </p>
                        <p><strong>-----------------------<br></strong></p>
                        <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                        <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
                        <p><br></p>
                    </div>`
                const smsVerCnt = `${updatedDocument.nurse}: The job ${updatedDocument.jobId} will be started in 2 hours. Pleaset prepare the job.`
                const name = updatedDocument.nurse.split(' ');
                const jobId = updatedDocument.jobId;

                if (extracted.jobStatus) {
                    if (extracted.jobStatus === 'Cancelled' || extracted.jobStatus === "Verified") {
                        if (name.length < 2) {
                            return;
                        }

                        if (extracted.jobStatus === 'Cancelled') {
                            MailTransfer(name, subject, content);
                            pushSms(name, smsContent)
                        } else {
                            MailTransfer(name, sucSub, sucCnt);
                            pushSms(name, smsSucCnt)
                        }
                    } else if(extracted.jobStatus === 'Pending Verification' && name !== ' ') {
                        const shiftTime = updatedDocument.shiftTime;
                        const shiftDate = updatedDocument.shiftDate;
                        const date = convertToDate(shiftDate, shiftTime)
                        const reminderTime = new Date(date.startDateTime);
                        const notify_result = pushNotify(reminderTime, name, verSub, verCnt, updatedDocument.jobId, request.offestTime, smsVerCnt);       
                        if(!notify_result) {
                            MailTransfer(name, subject, content);
                            pushSms(name, smsContent);
                            const updateUser = await Job.updateOne({ jobId: jobId }, { $set: {jobStatus: 'Cancelled'} });
                        }
                    }
                } else if (extracted.nurse && updatedDocument.jobStatus === 'Pending Verificaion') {
                    const shiftTime = updatedDocument.shiftTime;
                    const shiftDate = updatedDocument.shiftDate;
                    const date = convertToDate(shiftDate, shiftTime);
                    const reminderTime = new Date(date.startDateTime);
                    pushNotify(reminderTime, extracted.nurse, verSub, verCnt, updatedDocument.jobId, request.offestTime, smsVerCnt);  
                    if(!notify_result) {
                        MailTransfer(name, subject, content);
                        pushSms(name, smsContent);
                        const updateUser = await Job.updateOne({ jobId: jobId }, { $set: {jobStatus: 'Cancelled'} });
                    }
                }
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + expirationTime
                }
                const token = setToken(payload);
                return res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: updatedDocument });
            }
        })
    }
}

// Inovices
let invoices = []
const setInvoices = (invoiceList) => {
    invoices = invoiceList;
};

// Function to convert end time from "1a-5p" format to 24-hour format
function convertEndTimeTo24Hour(shiftTime) {
    const end = shiftTime.split('-')[1]; // Extract the end time (e.g., "5p")
    return convertTo24Hour(end); // Convert to 24-hour format
}

function convertTo24Hour(time) {
    const match = time.match(/(\d+)([ap]?)$/); // Match the hour and am/pm
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const period = match[2];
    if (period === 'p' && hour < 12) {
        hour += 12; // Convert PM to 24-hour format
    } else if (period === 'a' && hour === 12) {
        hour = 0; // Convert 12 AM to 0 hours
    }
    return hour.toString().padStart(2, '0') + ':00'; // Return in HH:MM format
}

let invoiceGenerate = false;
const job = cron.schedule('00 18 * * Friday', () => {
    generateInovices();
});

job.start();

async function generateInovices () {  
    // Calculate previous Friday at 6:00 AM
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToSubtract = (dayOfWeek + 5) % 7; // Calculate days to subtract to get to the previous Friday
    const previousFriday = new Date(now);
    previousFriday.setDate(now.getDate() - daysToSubtract);
    previousFriday.setHours(25, 0, 0, 0); // Set to 6:00 AM

    // Fetch all jobs
    const jobs = await Job.find();

    // Filter jobs based on the time range
    const results = jobs.filter(job => {
        const endTime24 = convertEndTimeTo24Hour(job.shiftTime); // Convert end time from "1a-5p" format to 24-hour format
        const shiftDateTime = new Date(`${job.shiftDate} ${endTime24}`); // Combine date and converted time

        // Check if the shift date and time fall within the specified range
        return shiftDateTime >= previousFriday && shiftDateTime < now;
    });

    const transformedArray = results.reduce((acc, curr) => {
        const { facility, nurse, shiftDate, shiftStartTime, shiftEndTime, payRate, bonus } = curr;
        if (acc[facility]) {
            acc[facility].push({
                description: `${facility}-${nurse}`,
                date: shiftDate,
                time: calculateShiftHours(shiftStartTime, shiftEndTime).toString(),
                rate: parseFloat(payRate.replace('$', '')),
                price: (parseFloat(payRate.replace('$', ''))* calculateShiftHours(shiftStartTime, shiftEndTime))
            });
        } else {
            acc[facility] = [{
                description: `${facility} ${nurse}`,
                date: shiftDate,
                time: calculateShiftHours(shiftStartTime, shiftEndTime).toString(),
                rate: parseFloat(payRate.replace('$', '')),
                price: parseFloat(payRate.replace('$', ''))* calculateShiftHours(shiftStartTime, shiftEndTime)
            }];
        }
        return acc;
    }, {});

    async function pdfGenerate (invoiceData, key) {
        const invoicesForHotel_Manager = [];
        const htmlContent = await invoiceHTML.generateInvoiceHTML(invoiceData, key);
        const invoicePath = await generatePDF(htmlContent, `${key}.pdf`);
        invoicesForHotel_Manager.push({ facilityId: key, path: invoicePath });
        invoices.push(...invoicesForHotel_Manager);
    }
    Object.keys(transformedArray).forEach(key => {
        const facilityData = transformedArray[key];
        pdfGenerate(facilityData, key);
    });
    setInvoices(invoices);
    invoiceGenerate = true;
    return { message: 'Invoice generated successfully' };
}

exports.generateInvoice = async (req, res) => {
    try { 
        console.log('invoice'); 
        if (invoiceGenerate) {
            invoiceGenerate = false;
            return res.status(200).json({message: 'success', invoiceData: invoices});
        } else {
            return res.status(404).json({message:'Hotel_Manager Invoices Not generated. Pleas try again 30 mins later.'});
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({message: "Internal Server Error!"});
    }
}

exports.invoices = async (req, res) => {
    try {
        return res.json(invoices);
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

exports.sendInvoice = async (req, res) => {
    const { facilityId, email } = req.body;
    const invoice = await invoices.find(inv => inv.facilityId === facilityId);
    if (!invoice) {
        return res.status(404).send('Invoice not found');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "lovely7rh@gmail.com",
            pass: "hkobgghzvfhsewxr",
        }
    });

    const mailOptions = {
        from: "lovely7rh@gmail.com",
        to: email,
        subject: `Invoice for Hotel_Manager ${facilityId}`,
        text: 'Please find the attached invoice.',
        attachments: [
            {
                filename: path.basename(invoice.path),
                path: invoice.path,
            },
        ],
    };

    try {
        const mailtrans = await transporter.sendMail(mailOptions);
        if (mailtrans) {
            return res.json({message: 'Invoice sent successfully'});
        } else {
            return res.status(404).json({message: "Not Found the invoice"})
        }
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({message: 'Error sending email'});
    }
}

exports.updateTime = async (req, res) => {
    try {
        const data = req.body;
        const user = req.user;
        const updateUser = await Job.updateOne({ jobId: data.jobId }, { $set: {laborState: data.laborState, shiftStartTime: data.shiftStartTime, shiftEndTime: data.shiftEndTime} });
        if (updateUser) {
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + expirationTime
            };
            const token = setToken(payload);

            if (token) {
                return res.status(200).json({ message: "Successfully Update!", token: token });
            } else {
                return res.status(400).json({ message: "Cannot logined User!" })
            }
        }
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({message: 'Error sending email'});
    }
}
