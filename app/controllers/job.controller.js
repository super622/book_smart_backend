const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const Job = db.jobs;
const Bid = db.bids;
const Facility = db.facilities;
const Clinical = db.clinical;
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const mailTrans = require("../controllers/mailTrans.controller.js");
const invoiceHTML = require('../utils/invoiceHtml.js');
const { generatePDF } = require('../utils/pdf');
const path = require('path');
const cron = require('node-cron');
const phoneSms = require('../controllers/twilio.js');
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

// const limitAccNum = 100;
const expirationTime = 10000000;

// Function to calculate shift hours from shiftTime string
function parseTime(timeString) {
  // Split the time string into date and time components
  const [datePart, timePart] = timeString.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Create a new Date object
  return new Date(year, month - 1, day, hours, minutes);
}

function getTimeFromDate(timeString) {
  const [datePart, timePart] = timeString.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return hours + ":" + minutes;
};

function calculateShiftHours(shiftStartTime, shiftEndTime) {
  // Parse the start and end times using the parseTime function
  let hours = 0;
  if (shiftStartTime && shiftEndTime) {
    const startTime = parseTime(shiftStartTime);
    const endTime = parseTime(shiftEndTime);
  
    // Calculate the duration in milliseconds
    const duration = endTime - startTime; // Duration in milliseconds
  
    // Convert milliseconds to hours
    hours = duration / (1000 * 60 * 60); // Convert to hours
  }
  return hours;
}

// Function to parse time from string
function parseTime(timeStr) {
  const [time, period] = timeStr.match(/(\d+\.?\d*)([ap]?)/).slice(1);
  let [hours, minutes] = time.split('.').map(Number);
  if (period === 'p' && hours < 12) hours += 12; // Convert PM to 24-hour format
  if (period === 'a' && hours === 12) hours = 0; // Convert 12 AM to 0 hours

  return new Date(0, 0, 0, hours, minutes || 0); // Create a date object for time
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
    iat: Math.floor(Date.now() / 1000), // Issued at time
    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
  };
  const token = setToken(payload);

  let timeSheetFile = request.timeSheet;
  if (timeSheetFile == "" || !timeSheetFile) {
    await Job.updateOne({ jobId: request.jobId }, { $set: {timeSheet: { content: '', name: '', type: '' }, jobStatus: 'Pending'} });
    return res.status(200).json({ message: 'The timesheet has been updated.', token: token });
  } else {
    const jobDetail = await Job.findOne({ jobId: request.jobId }, { facilityId: 1 });
    const facility = await Facility.findOne({ aic: jobDetail.facilityId }, { contactEmail: 1 });

    const s3FileUrl = await uploadToS3(timeSheetFile);

    await Job.updateOne({ jobId: request.jobId }, { $set: {timeSheet: { content: s3FileUrl, name: timeSheetFile.name, type: timeSheetFile.type }, jobStatus: 'Pending Verification'} });

    const verifySubject1 = `${user.firstName} ${user.lastName} has uploaded a timesheet for Shift ID # ${request.jobId}`
    const verifiedContent1 = `
    <div id=":15j" class="a3s aiL ">
      <p><strong>Shift ID</strong> : ${request.jobId}</p>
      <p><strong>Name</strong> : ${user.firstName} ${user.lastName}</p>
      <p><strong>Timesheet</strong> : ${timeSheetFile?.name || ''}</p>
    </div>`

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
      iat: Math.floor(Date.now() / 1000), // Issued at time
      exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
    };
    const token = setToken(payload);

    if (type == 'timesheet') {
      if (file.name != '') {
        const s3FileUrl = await uploadToS3(timeSheetFile);
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

//Regiseter Account
exports.postJob = async (req, res) => {
  try {
    if (!req.body.jobId) {
      const lastJob = await Job.find().sort({ jobId: -1 }).limit(1); // Retrieve the last jobId
      const lastJobId = lastJob.length > 0 ? lastJob[0].jobId : 0; // Get the last jobId value or default to 0
      const newJobId = lastJobId + 1; // Increment the last jobId by 1 to set the new jobId for the next data entry
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

// Remove Job
exports.removeJob = async (req, res) => {
  console.log(req.body.jobId);
  if (!req.body.jobId) {
    return res.status(500).json({ message: "JobId not exist!" });
  } else {
    const result = await Job.deleteOne({ jobId: req.body.jobId });
    return res.status(200).json({ message: "Successfully Removed" });
  }
};

//Login Account
exports.shifts = async (req, res) => {
  try {
    console.log("start =============");
    const user = req.user;
    const role = req.headers.role;
    console.log(user, role);

    if (role === 'Facilities') {
      const { search = '', page = 1 } = req.body;
      const limit = 25;
      const skip = (page - 1) * limit;
      const query = {};      
      console.log(search, page);

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
        { $match: query },
        { 
          $addFields: { 
              parsedEntryDate: { $dateFromString: { dateString: "$entryDate" } }
          }
        },{ 
          $sort: { parsedEntryDate: -1 } 
        }, 
        { $project: {
          facility: 1, degree: 1, entryDate: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, shiftTime: 1, bid_offer: 1, jobStatus: 1, timeSheetVerified: 1, jobRating: 1
        }},
        { $skip: skip },
        { $limit: limit }
      ];
      
      const data = await Job.aggregate(pipeline);
      let dataArray = [];
      for (const item of data) {
        const hiredUser = await Bid.findOne({ jobId: item.jobId, bidStatus: 'Awarded' }, { caregiver: 1 });
        // if (user.companyName === item.facility) {
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
        // }
      }
      const totalRecords = await Job.countDocuments(query);
      const totalPageCnt = Math.ceil(totalRecords / limit);


      const payload = {
        contactEmail: user.contactEmail,
        userRole: user.userRole,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
      };
      const token = setToken(payload);
      if (token) {
        // const updateUser = await Job.updateOne({email: email, userRole: userRole}, {$set: {logined: true}});
        res.status(200).json({ message: "Successfully Get!", dataArray, token, totalPageCnt });
      } else {
        res.status(400).json({ message: "Cannot logined User!" })
      }
    } else if (role === "Clinician") {
      console.log('started');
      const today = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
      console.log(today);
      const data = await Job.find({ 
        entryDate: { 
          $gte: today
        }
      }, { jobId: 1, degree: 1, shiftDate: 1, shiftTime: 1, location: 1, jobStatus: 1, jobNum: 1, payRate: 1, jobInfo: 1, bonus: 1 }).sort({ entryDate: 1 });
      let dataArray = [];
      data.map((item, index) => {
        console.log(user.title, item.degree);
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
      console.log('return value', dataArray.length);
      if (token) {
        res.status(200).json({ message: "Successfully Get!", dataArray, token });
      } else {
        res.status(400).json({ message: "Cannot logined User!" })
      }
    } else if (role === 'Admin') {
      const { search = '', page = 1 } = req.body;
      const limit = 25;
      const skip = (page - 1) * limit;
      const query = {};      
      console.log(search, page);

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
        { $project: {
            entryDate: 1, facility: 1, jobId: 1, jobNum: 1, location: 1, shiftDate: 1, 
            shiftTime: 1, degree: 1, jobStatus: 1, isHoursSubmit: 1, isHoursApproved: 1,
            timeSheet: { content: '', name: '$timeSheet.name', type: '$timeSheet.type' },
            timeSheetTemplate: { content: '', name: '$timeSheetTemplate.name', type: '$timeSheetTemplate.type' },
            noStatusExplanation: 1
        }},
        { $skip: skip },
        { $limit: limit }
      ];

      const data = await Job.aggregate(pipeline);
      console.log("got data");
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
          item.timeSheet.name,
          item.timeSheetTemplate?.name,
          item.noStatusExplanation,
          "delete"
        ])
      }
      console.log(dataArray.length);
      return res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" })
  }
}

exports.getJob = async (req, res) => {
  console.log('get job');
  try {
    // const user = req.user;
    const jobId = req.body.jobId;

    if (!jobId) {
      return res.status(500).json({ message: "JobId not exist" });
    }

    let jobData = await Job.findOne({ jobId }, { entryDate: 1, jobId: 1, jobNum: 1, nurse: 1, degree: 1, shiftTime: 1, shiftDate: 1, payRate: 1, jobStatus: 1, timeSheet: { content: '',name: '$timeSheet.name',type: '$timeSheet.type'}, jobRating: 1, location: 1, bonus: 1 });
    console.log('got jobdata');
    const bidders = await Bid.find({ jobId }, { entryDate: 1, bidId: 1, caregiver: 1, message: 1, bidStatus: 1, caregiverId: 1 });
    console.log('got bidders');

    let biddersList = await Promise.all(bidders.map(async (item) => {
      let bidderInfo = await Clinical.findOne({ aic: item.caregiverId }, { email: 1, phoneNumber: 1 });
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
    console.log('complete process');

    const workedHours = calculateShiftHours(jobData.shiftStartTime, jobData.shiftEndTime);
    const startTime = jobData.shiftStartTime ? getTimeFromDate(jobData.shiftStartTime) : '';
    const endTime = jobData.shiftEndTime ? getTimeFromDate(jobData.shiftEndTime) : '';
    let workedHoursStr = '';
    if (startTime != "" && endTime != "") {
      workedHoursStr = startTime + " to " + endTime + " = " + workedHours;
    }
    jobData = { ...jobData.toObject(), workedHours: workedHoursStr, bid_offer: bidders.length };

    console.log('return job');
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
  const user = req.user;
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
  const user = await Clinical.findOne({ aic: nurse.caregiverId }, { email: 1 } );

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
  const clinicalInfo = await Clinical.findOne({ firstName: JobDetails.nurse.split(' ')[0], lastName: JobDetails.nurse.split(' ')[1] });

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
      <p><strong>Facility</strong> : ${JobDetails?.location || ''}</p>
      <p><strong>Shift Date</strong> : ${JobDetails?.shiftDate || ''}</p>
      <p><strong>Time</strong> : ${JobDetails?.shiftTime || ''}</p>
    </div>`;
    let sendResult1 = mailTrans.sendMail(clinicalInfo?.email, subject1, content1);

    const subject2 = `${clinicalInfo?.firstName} ${clinicalInfo?.lastName}'s timesheet has been verified!`;
    const content2 = `<div id=":18t" class="a3s aiL ">
      <p><strong>Job / Shift</strong> : ${jobId}</p>
      <p><strong>Facility</strong> : ${JobDetails?.location || ''}</p>
      <p><strong>Shift Date</strong> : ${JobDetails?.shiftDate || ''}</p>
      <p><strong>Time</strong> : ${JobDetails?.shiftTime || ''}</p>
    </div>`;

    let sendResult21 = mailTrans.sendMail('support@whybookdumb.com', subject2, content2);
    let sendResult31 = mailTrans.sendMail('getpaid@whybookdumb.com', subject2, content2);
    let sendResult2 = mailTrans.sendMail('techableteam@gmail.com', subject2, content2);
  }
  return res.status(200).json({ message: "Success" });
};

//Login Account
exports.myShift = async (req, res) => {
  try {
    const user = req.user;
    const role = req.headers.role;
    console.log(user);

    const jobIds = await Bid.find({ caregiverId: user?.aic, bidStatus: { $ne: 'Not Awarded' }  }, { jobId: 1 }).lean();
    const jobIdArray = jobIds.map(bid => bid.jobId);
    console.log(jobIdArray)
    const data = await Job.find({ jobId: { $in: jobIdArray } }, { timeSheet: { content: '', name: '$timeSheet.name', type: '$timeSheet.type' }, jobId: 1, location: 1, payRate: 1, jobStatus: 1, nurse: 1, unit: 1, entryDate: 1, shiftDate: 1, shiftTime: 1, shiftDateAndTimes: 1, laborState: 1, shiftStartTime: 1, shiftEndTime: 1 }).sort({ entryDate: -1, shiftDate: -1 });

    let dataArray = [];
    if (role === "Clinician") {
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
      })
      const date = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
      // const date = "04/03/2024"
      const jobs = await Job.find({ jobId: { $in: jobIdArray }, shiftDate: date }, { payRate: 1, shiftStartTime: 1, shiftEndTime: 1, bonus: 1, jobStatus: 1 });
      console.log(jobs);
      let totalPay = 0;

      for (const job of jobs) {
        if (!['Available', 'Cancelled', 'Paid'].includes(job.jobStatus)) {
          const payRate = job.payRate != '$' ? job.payRate == '' ? 0 : parseFloat(job.payRate.replace('$', '')) : 0;
          const shiftHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
          const bonus = job.bonus != '$' ? job.bonus == '' ? 0 : parseFloat(job.bonus.replace('$', '')) : 0;
          totalPay += payRate * shiftHours + bonus;
        }
      }

      // Get the start of the week (Monday)
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (today.getDay() + 6) % 7); // Set to Monday
      console.log(today, monday)

      // Query for jobs from Monday to today
      const weekly = await Job.find({
        email: user.email,
        shiftDate: {
          $gte: moment(monday, "America/Toronto").format("MM/DD/YYYY"), // Convert to YYYY-MM-DD
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
      console.log(totalPay, weeklyPay);
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
        return res.status(200).json({
          message: "Successfully Get!",
          jobData: {
            reportData: dataArray,
            dailyPay: { pay: totalPay, date: date },
            weeklyPay: { date: moment(monday, "America/Toronto").format("MM/DD/YYYY") + "-" + moment(today, "America/Toronto").format("MM/DD/YYYY"), pay: weeklyPay }
          },
          token: token
        }
        );
      } else {
        return res.status(400).json({ message: "Cannot logined User!" })
      }
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" })
  }
};

exports.getCaregiverTimesheets = async (req, res) => {
  const user = req.user;
  const { search = '', page = 1, filters = [] } = req.body; // Include filters from the request body
  const limit = 25; // Number of results per page
  const skip = (page - 1) * limit; // Calculate number of items to skip

  try {
    console.log(search, page, filters);
    // Initialize query object
    const query = {};

  //   // Handle the filter functionality
  //   filters.forEach(filter => {
  //     const { logic = 'and', field, condition, value } = filter;
  
  //     let fieldNames = [];
  
  //     if (field === 'Nurse') {
  //       fieldNames = ['firstName', 'lastName']; 
  //     } else if (field === 'Job-ID') {
  //       fieldNames = ['jobId']; 
  //     } else if (field === 'Job Shift & Time') {
  //       fieldNames = ['shiftDate', 'shiftTime'];
  //     } else if (field === 'Job Status') {
  //       fieldNames = ['jobStatus'];
  //     } else if (field === 'Pre Time') {
  //       fieldNames = ['preTime'];
  //     } else if (field === 'Lunch') {
  //       fieldNames = ['lunch'];
  //     } else if (field === 'Lunch Equation') {
  //       fieldNames = ['lunchEquation'];
  //     } else if (field === 'Final Hours Equation') {
  //       fieldNames = ['finalHoursEquation'];
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
  //     if (field === 'Nurse') {
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

    // Handle the search functionality
    if (search) {
      const isNumeric = !isNaN(search); // Check if the search input is numeric

      // Add search across fields to the query
      query.$or = [
        ...(isNumeric ? [{ jobId: Number(search) }] : []), // Numeric search for jobId
        { nurse: { $regex: search, $options: 'i' } }, // Text search for nurse
        { shiftTime: { $regex: search, $options: 'i' } }, // Text search for shiftTime
        { shiftDate: { $regex: search, $options: 'i' } }, // Text search for shiftDate
        { lunch: { $regex: search, $options: 'i' } }, // Text search for lunch
        ...(isNumeric ? [{ lunchEquation: Number(search) }] : []), // Numeric search for lunchEquation
        ...(isNumeric ? [{ finalHoursEquation: Number(search) }] : []), // Numeric search for finalHoursEquation
        { preTime: { $regex: search, $options: 'i' } } // Text search for preTime
      ];
    }

    // Fetch jobs from the database with pagination and filtering
    const jobs = await Job.find(query, { shiftStartTime: 1, shiftEndTime: 1, jobId: 1, nurse: 1, shiftDate: 1, shiftTime: 1, jobStatus: 1, preTime: 1, lunch: 1, lunchEquation: 1, finalHoursEquation: 1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for performance improvement

    // Count total number of documents matching the query
    const totalRecords = await Job.countDocuments(query);
    const totalPageCnt = Math.ceil(totalRecords / limit); // Calculate total pages

    let dataArray = [];

    // Prepare the response array
    for (const job of jobs) {
      const workedHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
      const startTime = job.shiftStartTime ? getTimeFromDate(job.shiftStartTime) : '';
      const endTime = job.shiftEndTime ? getTimeFromDate(job.shiftEndTime) : '';
      let workedHoursStr = '';

      if (startTime !== '' && endTime !== '') {
        workedHoursStr = `${startTime} to ${endTime} = ${workedHours}`;
      }

      // Push each job details to the response array
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

    // Generate JWT token
    const payload = {
      email: user.email,
      userRole: user.userRole,
      iat: Math.floor(Date.now() / 1000), // Issued at time
      exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time (e.g., 1 hour)
    };
    
    const token = setToken(payload);

    if (token) {
      // Successful response
      res.status(200).json({ message: "Successfully Get!", dataArray, totalPageCnt, token });
    } else {
      res.status(400).json({ message: "Cannot logined User!" });
    }
  } catch (error) {
    console.error('Error occurred while fetching timesheets:', error);
    res.status(500).json({ message: "An error occurred!" });
  }
};


exports.getTimesheet = async (req, res) => {
  try {
    let result = await Job.findOne({ jobId: req.body.jobId });
    
    return res.status(200).json({ message: "Success", data: result.timeSheet });
  } catch (e) {
    return res.status(500).json({ message: "An Error Occured!" })
  }
};

//Login Account
exports.getAllData = async (req, res) => {
  try {
    console.log("getAllData");
    const user = req.user;
    const role = req.headers.role;
    console.log('role------', req.headers.role);
    const jobStatusCount = [
      { _id: "Available", count: 0 },
      { _id: "Awarded", count: 0 },
      { _id: "Cancelled", count: 0 },
      { _id: "Paid", count: 0 },
      { _id: "Pending Verification", count: 0 },
      { _id: "Verified", count: 0 },
      { _id: "Pending - Completed Verification", count: 0 },
      { _id: "Shift Verified", count: 0 },
    ]
    const jobStatus = await Job.aggregate([
      {
        $group: {
          _id: "$jobStatus", // Group by jobStatus
          count: { $sum: 1 } // Count documents
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
          _id: "$nurse", // Group by jobStatus
          count: { $sum: 1 } // Count documents
        }
      },
    ]);


    const results = await Job.aggregate([
      {
        $group: {
          _id: { $substr: ["$entryDate", 0, 2] }, // Extract MM from entryDate
          count: { $sum: 1 } // Count the number of items
        }
      },
      {
        $sort: { _id: -1 } // Sort by month descending (12 to 01)
      },
      {
        $project: {
          _id: 0,
          _id: { $concat: ["$_id", "/24"] }, // Format as MM/24
          count: 1
        }
      }
    ]);

    console.log(results);
    // console.log(jobStatusCount, ': 3998043298098043290890843290843290843290', "\n", updatedCount);
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
      res.status(200).json({ message: "Successfully Get!", jobData: { job: updatedCount, nurse: nurseStatus, cal: results }, token: token });
    }
    else {
      res.status(400).json({ message: "Cannot logined User!" })
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" })
  }
}

function extractNonJobId(job) {
  // Get the keys of the object
  const keys = Object.keys(job);

  // Find the first key that is not 'jobId'
  const nonJobIdKey = keys.find(key => key !== 'jobId');

  // Return the new object with the non-jobId property
  return {
    [nonJobIdKey]: job[nonJobIdKey]
  };
}

const MailTransfer = async (name, subject, content) => {
  const [firstName, lastName] = name; // Destructure the name array

  try {
    const clinician = await Clinical.findOne({ firstName, lastName });
    console.log('Email:----:', clinician.email);
    if (clinician) {
      const sendResult = await mailTrans.sendMail(clinician.email, subject, content);
      console.log('Email sent successfully:', sendResult);
    } else {
      console.error('Clinician not found for:', firstName, lastName);
    }
  } catch (error) {
    console.error('Error fetching clinician or sending email:', error);
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

const pushSms = async (name, message) => {
  const [firstName, lastName] = name; // Destructure the name array
  try {
    const clinician = await Clinical.findOne({ firstName, lastName });
    console.log('Email:----:', clinician.phoneNumber);
    const phoneNumber = convertToInternationalFormat(clinician.phoneNumber)
    if (clinician) {
      const sendResult = await phoneSms.pushNotification(message, phoneNumber);
      console.log('Email sent successfully:', sendResult);
    } else {
      console.error('Clinician not found for:', firstName, lastName);
    }
  } catch (error) {
    console.error('Error fetching clinician or sending email:', error);
  }
}

function convertToDate(dateString, timeString) {
  // Parse the date string (MM/DD/YYYY)
  const [month, day, year] = dateString.split('/').map(Number);
  console.log(month, day, year);
  // Create a new Date object using the parsed date
   // month is 0-indexed in JavaScript
  // console.log(date);
  // Parse the time range (7.05a-8.10p)
  const [startTime, endTime] = timeString.split('-');

  // Function to convert time in "7.05a" or "8.10p" format to hours and minutes
  const parseTime = (time) => {
      const isPM = time.endsWith('p'); // Check if it's PM
      const [hourPart, minutePart] = time.slice(0, -1).split('.'); // Split by decimal
      let hour = parseInt(hourPart, 10); // Get the hour part
      console.log(minutePart, hour);
      const minutes = minutePart ? Math.round(parseFloat(`0.${minutePart}`) * 100) : 0; // Convert decimal to minutes

      if (isPM && hour !== 12) {
          hour += 12; // Convert to 24-hour format
      }
      if (!isPM && hour === 12) {
          hour = 0; // Midnight case
      }
      console.log(hour, minutes);
      
      return { hour, minutes };
  };

  // Get the start and end hours and minutes
  const { hour: startHour, minutes: startMinutes } = parseTime(startTime);
  const { hour: endHour, minutes: endMinutes } = parseTime(endTime);
  console.log(startHour, startMinutes)

  const date = new Date(Date.UTC(year, month - 1, day, startHour, startMinutes, 0));
  // Set the start time to the date
  console.log("aaa: ",date);
  // date.setHours(startHour, startMinutes, 0, 0); // Set hours, minutes, seconds, milliseconds
  // date.setMinutes(startMinutes);
  console.log("bbb: ",date);
  
  // Create an array to hold the start and end Date objects
  const startDateTime = new Date(date); // Start time
  
  const dateEnd = new Date(Date.UTC(year, month - 1, day, endHour, endMinutes, 0));
  const endDateTime = new Date(dateEnd); // End time

  // Set the end time
  // endDateTime.setHours(endHour, endMinutes, 0, 0); // Set end hours and minutes

  return { startDateTime, endDateTime };
}

const pushNotify = (reminderTime, name, verSub, verCnt, jobId, offsetTime, smsVerCnt) => {  
  console.log('pending---', reminderTime);
  const currentDate = reminderTime.getTime();
  console.log(currentDate, offsetTime);
  
  let reminderTimes = new Date(currentDate + offsetTime*60*60*1000);
  console.log(reminderTimes, "---------");
  
  if (reminderTimes.getHours() < 2) {
    reminderTimes.setHours(reminderTimes.getHours() + 22);
    reminderTimes.setDate(reminderTimes.getDate() - 1);
  } else {
    reminderTimes.setHours(reminderTimes.getHours() - 2);
  }
  now = new Date(Date.now());
  if(reminderTimes.getTime() < now.getTime()){
    console.log(reminderTimes, now);
    reminderTimes.setHours(reminderTimes.getHours() + 1);
    if(reminderTimes.getTime() < now.getTime())
      return false;
    else{
      now.setMinutes(now.getMinutes() + 1);
      reminderTimes = now;
    }
  }
  console.log(reminderTimes);
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
      console.log("Reminder sent");
      const mailSend = MailTransfer(name, verSub, verCnt);
      const smsResults = pushSms(name, smsVerCnt);
      let succed = false;
      const updateUser = await Job.updateOne({ jobId: jobId }, { $set: {jobStatus: 'Verified'} });
        if (!updateUser) {
          console.log('ERROR : ', err);
          return succed
        } else {
          console.log(succed)
          succed = true;
          return succed;
        }
      // sendSms(phone, `Reminder: You have a test scheduled at ${testDate}.`);            
    }
  );
  return true;  
}

//Update Account
exports.Update = async (req, res) => {
  console.log('updateSignal');
  const request = req.body;
  const user = req.user;
  const extracted = extractNonJobId(request);
  console.log({ extracted }, "-------------------------------------------------------");
  console.log("user", user, request);
  if (user) {
    console.log("items");
    Job.findOneAndUpdate({ jobId: request.jobId }, { $set: extracted }, { new: false }, async (err, updatedDocument) => {
      if (err) {
        // Handle the error, e.g., return an error response
        res.status(500).json({ error: err });
        console.log(err);
      } else {
        // console.log("updated", updatedDocument);
        const subject = `BookSmart™ - You failed Job`
        const content = `<div id=":18t" class="a3s aiL ">
                  <p>
                  <strong> ${updatedDocument.nurse}: You failed in job:${updatedDocument.jobId} beacuse the Facility don't accept you.<br></strong>
                  </p>
                  <p><strong>-----------------------<br></strong></p>
                  <p><strong>Date</strong>: ${moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY")}</p>
                  <p><strong><span class="il">BookSmart</span>™ <br></strong></p>
                  <p><br></p>
              </div>`
        const smsContent = `${updatedDocument.nurse}: You failed in job:${updatedDocument.jobId} beacuse the Facility don't accept you.`
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
            // Check if the name array has at least two elements
            if (name.length < 2) {
              console.error('Nurse name is incomplete:', updatedDocument.nurse);
              return; // Exit if the name is not valid
            }
            if (extracted.jobStatus === 'Cancelled') {
              MailTransfer(name, subject, content);
              pushSms(name, smsContent)
            } else {
              MailTransfer(name, sucSub, sucCnt);
              pushSms(name, smsSucCnt)
            }
          }
          else if(extracted.jobStatus === 'Pending Verification' && name !== ' ') {
            console.log('pending');
            const shiftTime = updatedDocument.shiftTime;
            const shiftDate = updatedDocument.shiftDate;
            console.log(shiftTime)
            const date = convertToDate(shiftDate, shiftTime)
            console.log(shiftDate, shiftTime, date.startDateTime, date);
            const reminderTime = new Date(date.startDateTime);  
            console.log(reminderTime, extracted); 
            const notify_result = pushNotify(reminderTime, name, verSub, verCnt, updatedDocument.jobId, request.offestTime, smsVerCnt);       
            if(!notify_result) {
              MailTransfer(name, subject, content);
              pushSms(name, smsContent);
              const updateUser = await Job.updateOne({ jobId: jobId }, { $set: {jobStatus: 'Cancelled'} });
            }
          }
        }
        else if (extracted.nurse && updatedDocument.jobStatus === 'Pending Verificaion') {
          console.log('pending');
          const shiftTime = updatedDocument.shiftTime;
          const shiftDate = updatedDocument.shiftDate;
          const date = convertToDate(shiftDate, shiftTime)
          console.log(shiftDate, shiftTime, date.startDateTime, date);
          const reminderTime = new Date(date.startDateTime);  
          console.log(reminderTime); 
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
          iat: Math.floor(Date.now() / 1000), // Issued at time
          exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        }
        const token = setToken(payload);
        console.log(token);
        // Document updated successfully, return the updated document as the response
        res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: updatedDocument });
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
  console.log(previousFriday);

  // Fetch all jobs
  const jobs = await Job.find();

  // Filter jobs based on the time range
  const results = jobs.filter(job => {
    const endTime24 = convertEndTimeTo24Hour(job.shiftTime); // Convert end time from "1a-5p" format to 24-hour format
    const shiftDateTime = new Date(`${job.shiftDate} ${endTime24}`); // Combine date and converted time

    // Check if the shift date and time fall within the specified range
    return shiftDateTime >= previousFriday && shiftDateTime < now;
  });

  console.log(results);

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
    console.log(invoiceData);
    const invoicesForFacility = [];
    const htmlContent = await invoiceHTML.generateInvoiceHTML(invoiceData, key);
    const invoicePath = await generatePDF(htmlContent, `${key}.pdf`);
    invoicesForFacility.push({ facilityId: key, path: invoicePath });
    invoices.push(...invoicesForFacility);
  }
  Object.keys(transformedArray).forEach(key => {
    const facilityData = transformedArray[key];
    
    pdfGenerate(facilityData, key);
  
  });
  console.log(invoices);
  // Update the state only once after all invoices are generated
  setInvoices(invoices);

  // Send the invoice path as a response
  invoiceGenerate = true;
  return { message: 'Invoice generated successfully' };
}

exports.generateInvoice = async (req, res) => {
  try { 
    console.log('invoice'); 
    if (invoiceGenerate) {
      console.log(invoices);
      res.status(200).json({message: 'success', invoiceData: invoices})
      invoiceGenerate = false;
      console.log(invoiceGenerate);
    }
    else {
      res.status(404).json({message:'Facility Invoices Not generated. Pleas try again 30 mins later.'})
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({message: "Internal Server Error!"})
  }
}

exports.invoices = async (req, res) => {

  console.log('Invoices');
  try {

    res.json(invoices);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

exports.sendInvoice = async (req, res) => {
  const { facilityId, email } = req.body;
  const invoice = await invoices.find(inv => inv.facilityId === facilityId);
  console.log(invoice, facilityId, email);
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
    subject: `Invoice for Facility ${facilityId}`,
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
      res.json({message: 'Invoice sent successfully'});
    } else {
      res.status(404).json({message: "Not Found the invoice"})
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({message: 'Error sending email'});
  }
}

exports.updateTime = async (req, res) => {
  try {
    const data = req.body;
    console.log(data);
    const user = req.user;
    const updateUser = await Job.updateOne({ jobId: data.jobId }, { $set: {laborState: data.laborState, shiftStartTime: data.shiftStartTime, shiftEndTime: data.shiftEndTime} });
    if (updateUser) {
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
        res.status(200).json({ message: "Successfully Update!", token: token });
      }
      else {
        res.status(400).json({ message: "Cannot logined User!" })
      }
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({message: 'Error sending email'});
  }
}
