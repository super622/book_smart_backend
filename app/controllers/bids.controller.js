const jwtEncode = require('jwt-encode')
const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const { set } = require('mongoose');
const Job = db.jobs;
const Bid = db.bids;
const Facility = db.facilities;
const mailTrans = require("../controllers/mailTrans.controller.js");
const moment = require('moment');

// const limitAccNum = 100;
const expirationTime = 10000000;
//Regiseter Account
exports.postBid = async (req, res) => {
  try {
    console.log("register");
    const user = req.user

    console.log(req.body);

    if (!req.bidId) {
      let response = req.body;
      const lastBid = await Bid.find().sort({ bidId: -1 }).limit(1);
      const lastBidId = lastBid.length > 0 ? lastBid[0].bidId : 0;
      const lastBidOffer = await Job.findOne({ jobId: response.jobId }, { bid_offer: 1 });
      const newBidOffer = parseInt(lastBidOffer.bid_offer) + 1;
      const newBidId = lastBidId + 1;
      const facility = await Job.findOne({ jobId: response.jobId }, { facilityId: 1, facility: 1, aic: 1, shiftDate: 1, shiftTime: 1 });
      const facilityEmail = await Facility.findOne({ aic: facility.facilityId }, { contactEmail: 1, aic: 1 });
      console.log(facilityEmail.aic);
      
      response.entryDate = moment(new Date()).format("MM/DD/YYYY");
      response.bidId = newBidId;
      response.facility = facility.facility;
      response.facilityId = facilityEmail.aic;
      const auth = new Bid(response);
      await auth.save();

      const updateJob = await Job.updateOne({ jobId: response.jobId }, { $set: { bid_offer: newBidOffer } });
      console.log('updated');

      const payload = {
        email: user.email,
        userRole: user.userRole,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
      };
      const token = setToken(payload);
      res.status(200).json({ message: "Successfully Applied", token: token });
      const verifySubject1 = `${user.firstName} ${user.lastName} has applied to Job #${response.jobId}`;
      const verifiedContent1 = `
        <div id=":15j" class="a3s aiL ">
          <p><strong>Shift Date</strong> - ${facility.shiftDate}</p>
          <p><strong>Shift Time</strong> - ${facility.shiftTime}</p>
          <p><strong>Job</strong> - ${response.jobId}</p>
          <p><strong>Submitted By</strong> : ${user.firstName} ${user.lastName}</p>
        </div>`;
      
      let approveResult = await mailTrans.sendMail(facilityEmail?.contactEmail, verifySubject1, verifiedContent1);
      let approveResult2 = await mailTrans.sendMail('support@whybookdumb.com', verifySubject1, verifiedContent1);
      let approveResult1 = await mailTrans.sendMail('techableteam@gmail.com', verifySubject1, verifiedContent1);

      const verifySubject3 = `Thank you for your interest in shift - ${response.jobId}`
      const verifiedContent3 = `
      <div id=":15j" class="a3s aiL ">
        <p><span style="color: #0000ff;"><strong>You will be notified via email, if this shift is awarded to you!</strong></span></p>
        <p>-----------------------</p>
      </div>`
      
      let approveResult3 = await mailTrans.sendMail(user?.email, verifySubject3, verifiedContent3);
    } else {
      console.log('content', req.body.content)
      const id = { jobId: req.body.jobId }
      const updateData = { bid: req.body.content } || { timeSheet: req.body.timeSheet }
      Job.findOneAndUpdate(
        { id },
        { $set: { updateData } },
        { new: false },
        (err, updatedDocument) => {
          if (err) {
            // Handle the error, e.g., return an error response
            res.status(500).json({ error: err });
            console.log(err);
          } else {
            console.log("updated", updatedDocument);
            const payload = {
              contactEmail: user.contactEmail,
              userRole: user.userRole,
              iat: Math.floor(Date.now() / 1000), // Issued at time
              exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            };
            const token = setToken(payload);
            console.log(token);
            // Document updated successfully, return the updated document as the response
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: updatedDocument });
          }
        }
      );
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

//Login Account
exports.shifts = async (req, res) => {
  try {
    // console.log("shifts");
    const user = req.user;
    const role = req.headers.role;
    console.log('role------', req.headers.role);
    const data = await Job.find({});
    console.log("data---++++++++++++++++++++++++>", data)
    let dataArray = [];
    // const token = ;
    if (role === 'Facilities') {
      data.map((item, index) => {
        dataArray.push([item.degree,
        item.entryDate,
        item.jobId,
        item.jobNum,
        item.location,
        item.unit,
        item.shiftDate,
        item.shift,
        item.bid_offer,
        item.bid,
        item.jobStatus,
        item.Hired,
        item.timeSheetVerified,
        item.jobRating,
        "delete"])
      })
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
    else if (role === "Clinician") {
      data.map((item, index) => {
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
      console.log("data++++++------------->", data)
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



