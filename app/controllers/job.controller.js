const jwtEncode = require('jwt-encode')
const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const { set } = require('mongoose');
const Job = db.jobs;
const Bid = db.bids;
const Facility = db.facilities;
const Clinical = db.clinical;
const moment = require('moment');
const nodemailer = require('nodemailer');
const mailTrans = require("../controllers/mailTrans.controller.js");
const invoiceHTML = require('../utils/invoiceHtml.js');
const { generatePDF } = require('../utils/pdf');
const path = require('path');
const cron = require('node-cron');
const { read } = require('pdfkit');
const { removeAllListeners } = require('process');
const phoneSms = require('../controllers/twilio.js');
const dotenv = require('dotenv').config();

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

//Regiseter Account
exports.postJob = async (req, res) => {
  try {
    console.log("register");
    // const accountId = req.params.accountId;

    const user = req.user
    if (!req.body.jobId) {
      const lastJob = await Job.find().sort({ jobId: -1 }).limit(1); // Retrieve the last jobId
      const lastJobId = lastJob.length > 0 ? lastJob[0].jobId : 0; // Get the last jobId value or default to 0
      const newJobId = lastJobId + 1; // Increment the last jobId by 1 to set the new jobId for the next data entry
      // const isUser = await Job.findOne({ jobId: newJobId });
      const response = req.body;
      console.log("new Id------------->", newJobId)
      response.entryDate = moment(new Date()).format("MM/DD/YYYY");
      // response.hoursDateAndTIme = new Date();
      response.payRate = '$' + response.payRate;
      response.jobId = newJobId;
      const auth = new Job(response);
      await auth.save();
      const payload = {
        contactEmail: user.contactEmail,
        userRole: user.userRole,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
      }
      const token = setToken(payload);
      console.log(token);
      res.status(201).json({ message: "Successfully Registered", token: token });
    }
    else {
      console.log('content', req.body)
      const request = req.body;
      // request.timeSheet._id=new ObjectId(request.timeSheet._id);
      console.log(request.timeSheet);
      await Job.updateOne(
        { jobId: request.jobId },
        { $set: request },
        { upsert: false }
      )
        .then(result => {
          if (result.nModified === 0) {
            // If no documents were modified, return a 404 error
            return res.status(404).json({ error: 'Job not found or no changes made' });
          }

          // If the update was successful, fetch the updated document
          return Job.findOne({ jobId: request.jobId });
        })
        .then(result => {
          if (result.nModified === 0) {
            // If no documents were modified, return a 404 error
            return res.status(404).json({ error: 'Job not found or no changes made' });
          }
          console.log('dddddd', result);
          // If the update was successful, fetch the updated document
          return Job.findOne({ jobId: request.jobId });
        })
        .then(updatedDocument => {
          if (!updatedDocument) {
            // If no document was found after the update, return a 404 error
            return res.status(404).json({ error: 'Job not found' });
          }

          console.log("updated", updatedDocument);
          const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
          };
          const token = setToken(payload);
          console.log(token);

          // Document updated successfully, return the updated document as the response
          res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: updatedDocument });
        })
        .catch(err => {
          // Handle the error, e.g., return an error response
          console.error(err);
          res.status(500).json({ error: err.message });
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
    const user = req.user;
    const role = req.headers.role;
    const data = await Job.find({});
    let dataArray = [];

    if (role === 'Facilities') {
      data.map((item, index) => {
        const hiredUser = Bid.findOne({ jobId: item.jobId, bidStatus: 'Awarded' });
        if (user.companyName === item.facility) {
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
      });

      const payload = {
        contactEmail: user.contactEmail,
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
    else if (role === "Clinicians") {
      data.map((item, index) => {
        if (item.jobStatus == 'Available') {
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
            shiftDateAndTimes: item.shiftDateAndTimes,
            bonus: item.bonus
          })
          console.log("ClinicianData: ", data);
        }
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
    else if (role === 'Admin') {
      data.map((item, index) => {
        const times = calculateShiftHours(item.shiftStartTime, item.shiftEndTime);
        dataArray.push([
          item.entryDate,
          item.nurse,
          item.jobId,
          item.jobNum,
          item.location,
          item.shiftDate,
          item.shiftTime,
          item.bid_offer,
          item.bid,
          item.jobStatus,
          item.jobRating,
          item.facility,
          times
        ])
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

exports.getJob = async (req, res) => {
  try {
    const user = req.user;
    const jobId = req.body.jobId;

    if (!jobId) {
      return res.status(500).json({ message: "JobId not exist" });
    }

    // Fetch job data and bidders concurrently
    const [jobData, bidders] = await Promise.all([
      Job.findOne({ jobId }),
      Bid.find({ jobId })
    ]);

    // Get unique caregiver names
    const caregiverNames = bidders.map((item) => {
      const [firstName, lastName] = item.caregiver.split(' ');
      return { firstName, lastName };
    });

    // Fetch all caregiver info at once
    const caregiverInfo = await Clinical.find({
      $or: caregiverNames
    });

    const biddersList = bidders.map((item) => {
      const [firstName, lastName] = item.caregiver.split(' ');
      const bidderInfo = caregiverInfo.find(
        (c) => c.firstName === firstName && c.lastName === lastName
      ) || {};
      
      return [
        item.entryDate,
        item.caregiver,
        "",
        item.message,
        item.bidStatus,
        "",
        item.bidId,
        bidderInfo.email || '',
        bidderInfo.phoneNumber || ''
      ];
    });

    // Token creation
    const payload = {
      contactEmail: user.contactEmail,
      userRole: user.userRole,
      iat: Math.floor(Date.now() / 1000), // Issued at time
      exp: Math.floor(Date.now() / 1000) + (expirationTime || 3600) // Default expiration time 1 hour
    };
    const token = setToken(payload);

    return res.status(200).json({
      message: "Successfully Get",
      jobData,
      bidders: biddersList,
      token
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "An error occurred", error });
  }
};

exports.setAwraded = async (req, res) => {
  const jobId = req.body.jobId;
  const bidId = req.body.bidderId;
  const status = req.body.status;
  console.log(jobId, bidId, status);

  if (status === 1) {
    await Job.updateOne({ jobId }, { $set: { jobStatus: 'Awarded' }});
    await Bid.updateOne({ bidId }, { $set: { bidStatus: 'Awarded' }})
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

  await Job.updateOne({ jobId }, { $set: { timeSheetVerified: status == 1 ? true : false }});
  if (file?.name !== '') {
    await Job.updateOne({ jobId }, { $set: { timeSheet: file }});
  }
  return res.status(200).json({ message: "Success" });
};

//Login Account
exports.myShift = async (req, res) => {
  try {
    // console.log("shifts");
    const user = req.user;
    const role = req.headers.role;
    console.log('role------', req.headers.role);
    const nurse = user.firstName + ' ' + user.lastName;
    console.log(nurse, 'nurse-----');
    const data = await Job.find({ nurse: nurse });
    console.log("data---++++>", data)
    let dataArray = [];
    if (role === "Clinicians") {
      data.map((item) => {
        if (item.jobStatus !== 'Available') {
          dataArray.push({
            jobId: item.jobId,
            location: item.location,
            payRate: item.payRate,
            shiftStatus: item.jobStatus,
            caregiver: item.nurse,
            timeSheet: item.timeSheet,
            unit: item.unit,
            entryDate: item.shiftDate,
            shiftDateAndTimes: item.shiftDateAndTimes,
            laborState: item.laborState,
            shiftStartTime: item.shiftStartTime,
            shiftEndTime: item.shiftEndTime
          })
          console.log("MyShiftData:", dataArray)
        }
      })
      const date = moment(new Date()).format("MM/DD/YYYY");
      // const date = "04/03/2024"
      const jobs = await Job.find({ nurse: (user.firstName + ' ' + user.lastName), shiftDate: date });
      console.log(jobs);
      let totalPay = 0;

      for (const job of jobs) {
        if (!['Available', 'Cancelled', 'Paid'].includes(job.jobStatus)) {
          const payRate = job.payRate? parseFloat(job.payRate.replace('$', '')) : 0;
          const shiftHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
          const bonus = job.bonus ? parseFloat(job.bonus) : 0;
          totalPay += payRate * shiftHours + bonus;
          console.log(payRate, shiftHours, bonus, totalPay);
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
          $gte: moment(monday).format("MM/DD/YYYY"), // Convert to YYYY-MM-DD
          $lte: moment(today).format("MM/DD/YYYY"),
        },
      });

      let weeklyPay = 0;

      for (const job of weekly) {
        if (!['Available', 'Cancelled', 'Paid'].includes(job.jobStatus)) {
          const payRate = job.payRate? parseFloat(job.payRate.replace('$', '')) : 0;
          const shiftHours = calculateShiftHours(job.shiftStartTime, job.shiftEndTime);
          const bonus = job.bonus ? parseFloat(job.bonus) : 0;
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
        res.status(200).json({
          message: "Successfully Get!",
          jobData: {
            reportData: dataArray,
            dailyPay: { pay: totalPay, date: date },
            weeklyPay: { date: moment(monday).format("MM/DD/YYYY") + "-" + moment(today).format("MM/DD/YYYY"), pay: weeklyPay }
          },
          token: token
        }
        );
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
                  <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
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
                  <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
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
                  <p><strong>Date</strong>: ${moment(Date.now()).format("MM/DD/YYYY")}</p>
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
  // Your task code here
  console.log("start");
  generateInovices();

});
job.start();
console.log(new Date().toISOString())
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




