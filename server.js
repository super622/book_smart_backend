const express = require("express");
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require("cors");
const moment = require('moment-timezone');
const fileUpload = require('express-fileupload');
const cron = require('node-cron');
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Load SSL certificate and key
// const privateKey = fs.readFileSync('ssl/server.key', 'utf8');
// const certificate = fs.readFileSync('ssl/server.crt', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const server = http.createServer(app);
// const server = https.createServer(credentials, app);

app.use(fileUpload());
require("./app/socketServer")(server);

var corsOptions = {
  origin: "*"
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require("./app/models");
db.mongoose
  .connect(db.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("Connected to the database!");
  })
  .catch(err => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

require("./app/routes/clinical.route")(app);
require("./app/routes/facilities.route")(app);
require("./app/routes/job.routes")(app);
require("./app/routes/admin.route.js")(app);
require('./app/routes/bid.route.js')(app);
require('./app/routes/degree.route.js')(app);
require('./app/routes/location.route.js')(app);
require('./app/routes/title.route.js')(app);
require('./app/routes/restau_user.route.js')(app);
require('./app/routes/restau_manager.route.js')(app);
require('./app/routes/hotel_manager.route.js')(app);
require('./app/routes/hotel_user.route.js')(app);
require('./app/routes/restau_bid.route.js')(app);
require('./app/routes/restau_job.route.js')(app);
require('./app/routes/hotel_bid.route.js')(app);
require('./app/routes/hotel_job.route.js')(app);
require('./app/routes/hospitality.route.js')(app);

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

const { setInvoices } = require("./app/controllers/facilities.controller.js");
const { sendSMS } = require("./app/controllers/twilio.js");

let invoices = [];

cron.schedule('50 10 * * 6', () => {
  const facilities = [
    { id: 1, name: 'Facility A', amountDue: 100 },
    { id: 2, name: 'Facility B', amountDue: 200 },
  ];
  
  facilities.forEach(facility => {
    const invoicePath = generateInvoice(facility);
    invoices.push({ facilityId: facility.id, path: invoicePath });
  });
  console.log('Invoices generated:', invoices);
  setInvoices(invoices);
});

function extractStartTime(shiftTime) {
  // const [startTime] = shiftTime.split(' - ');
  // return moment(startTime, 'h:mm A').format('HH:mm');
  // Handle case like "13-19" (24-hour format without AM/PM)
  if (shiftTime.match(/^\d{2}-\d{2}$/)) {
    const [startTime] = shiftTime.split('-');
    return moment(startTime, 'HH').format('HH:mm');
  }

  // Handle time ranges with AM/PM (like "7a-3p" or "7:00 AM - 10:30 PM")
  if (shiftTime.match(/^[0-9]{1,2}[ap]m/)) {
    const [startTime] = shiftTime.split(' - ');
    return moment(startTime, 'h:mma').format('HH:mm');  // handle "7a-3p" or "7:00 AM"
  }

  // Handle explicit AM/PM format like "7:00 AM - 10:30 PM"
  if (shiftTime.match(/[AP]M/)) {
    const [startTime] = shiftTime.split(' - ');
    return moment(startTime, 'h:mm A').format('HH:mm');
  }

  // Handle simple times like "3a-6a" (without leading zeros)
  if (shiftTime.match(/^[0-9]{1}[ap]m/)) {
    const [startTime] = shiftTime.split('-');
    return moment(startTime, 'h a').format('HH:mm');
  }

  return null;  // Return null for unsupported formats
}

// Cron job scheduled to run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Running job reminder check at', moment().format('YYYY-MM-DD HH:mm:ss'));

  try {
    const currentDate = moment.tz(new Date(), 'America/Toronto').format('MM/DD/YYYY');
    const twoHoursLater = moment.tz('America/Toronto').add(2, 'hours').format('HH:mm');

    console.log(`Looking for jobs with start time: ${twoHoursLater}`);

    // Fetch jobs with minimal fields
    const jobs = await db.jobs.find(
      { shiftDate: currentDate, jobStatus: 'Awarded' },
      { jobId: 1, shiftTime: 1, location: 1 }
    );

    const HotelJobs = await db.hotel_job.find(
      { shiftDate: currentDate, jobStatus: 'Awarded' },
      { jobId: 1, shiftTime: 1, location: 1 }
    );

    const RestauJobs = await db.restau_job.find(
      { shiftDate: currentDate, jobStatus: 'Awarded' },
      { jobId: 1, shiftTime: 1, location: 1 }
    );

    console.log(`Fetched ${jobs.length} jobs for the date ${currentDate}.`);
    console.log(`Fetched ${HotelJobs.length} hotel jobs for the date ${currentDate}.`);
    console.log(`Fetched ${RestauJobs.length} restaurant jobs for the date ${currentDate}.`);

    // Filter jobs matching the 2-hour condition
    const matchingJobs = jobs.filter(job => extractStartTime(job.shiftTime) === twoHoursLater);
    const matchingHotelJobs = HotelJobs.filter(job => extractStartTime(job.shiftTime) === twoHoursLater);
    const matchingRestauJobs = RestauJobs.filter(job => extractStartTime(job.shiftTime) === twoHoursLater);

    console.log(`Found ${matchingJobs.length} matching jobs.`);
    console.log(`Found ${matchingHotelJobs.length} matching hotel jobs.`);
    console.log(`Found ${matchingRestauJobs.length} matching restaurant jobs.`);

    // Batch process jobs
    await Promise.all(
      matchingJobs.map(async (job) => {
        const { jobId, location, shiftTime } = job;
        console.log('Processing jobId:', jobId);

        // Fetch awarded bidders
        const bidders = await db.bids.find(
          { jobId, bidStatus: 'Awarded' },
          { caregiverId: 1 }
        ).toArray();

        const caregiverIds = bidders.map(bid => bid.caregiverId);
        console.log('Awarded caregiver IDs:', caregiverIds);

        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        // Fetch caregivers' phone numbers
        const caregivers = await db.clinical.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1 }
        ).toArray();

        console.log(`Found ${caregivers.length} caregivers for jobId ${jobId}.`);

        // Send SMS notifications
        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );

    await Promise.all(
      matchingHotelJobs.map(async (job) => {
        const { jobId, location, shiftTime } = job;
        console.log('Processing hotel jobId:', jobId);

        // Fetch awarded bidders
        const bidders = await db.hotel_bid.find(
          { jobId, bidStatus: 'Awarded' },
          { caregiverId: 1 }
        ).toArray();

        const caregiverIds = bidders.map(bid => bid.caregiverId);
        console.log('Awarded hotel caregiver IDs:', caregiverIds);

        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        // Fetch caregivers' phone numbers
        const caregivers = await db.hotel_user.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1 }
        ).toArray();

        console.log(`Found ${caregivers.length} hotel caregivers for jobId ${jobId}.`);

        // Send SMS notifications
        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );

    await Promise.all(
      matchingRestauJobs.map(async (job) => {
        const { jobId, location, shiftTime } = job;
        console.log('Processing restaurant jobId:', jobId);

        // Fetch awarded bidders
        const bidders = await db.restau_bid.find(
          { jobId, bidStatus: 'Awarded' },
          { caregiverId: 1 }
        ).toArray();

        const caregiverIds = bidders.map(bid => bid.caregiverId);
        console.log('Awarded restaurant caregiver IDs:', caregiverIds);

        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        // Fetch caregivers' phone numbers
        const caregivers = await db.restau_user.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1 }
        ).toArray();

        console.log(`Found ${caregivers.length} restuarant caregivers for jobId ${jobId}.`);

        // Send SMS notifications
        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );
  } catch (error) {
    console.error('Error processing jobs:', error.message);
  }
});

// set port, listen for requests
const PORT = process.env.PORT || 5000;
// const HOST = "0.0.0.0";
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
