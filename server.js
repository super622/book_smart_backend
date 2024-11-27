const express = require("express");
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const cron = require('node-cron');
const moment = require('moment-timezone');

const app = express();

// Load SSL certificate and key
// const privateKey = fs.readFileSync('ssl/server.key', 'utf8');
// const certificate = fs.readFileSync('ssl/server.crt', 'utf8');

// const credentials = { key: privateKey, cert: certificate };

const server = http.createServer(app);
// const server = https.createServer(credentials, app);
app.use(fileUpload());
require("./app/socketServer")(server);
// require("./app/walletavatar")

console.log(new Date);

var corsOptions = {
  origin: "*"
};
dotenv.config();
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// parse requests of content-type - application/json
app.use(express.json());
// mongoose.connect("mongodb://localhost/phantom-avatars", { useNewUrlParser: true, useUnifiedTopology: true });
// parse requests of content-type - application/x-www-form-urlencoded
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



// simple route
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

require("./app/routes/clinical.route")(app);
require("./app/routes/facilities.route")(app);
require("./app/routes/job.routes")(app);
require("./app/routes/admin.route.js")(app);
require('./app/routes/bid.route.js')(app);
require('./app/routes/degree.route.js')(app);
require('./app/routes/location.route.js')(app);

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
  const [startTime] = shiftTime.split(' - ');
  return moment(startTime, 'h:mm A').format('HH:mm');
}

// Cron job scheduled to run every 50 seconds
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

    console.log(`Fetched ${jobs.length} jobs for the date ${currentDate}.`);

    // Filter jobs matching the 2-hour condition
    const matchingJobs = jobs.filter(job => extractStartTime(job.shiftTime) === twoHoursLater);

    console.log(`Found ${matchingJobs.length} matching jobs.`);

    // Batch process jobs
    await Promise.all(
      matchingJobs.map(async (job) => {
        const { jobId, location, shiftTime } = job;
        console.log('Processing jobId:', jobId);

        // Fetch awarded bidders
        const bidders = await db.bids.find(
          { jobId, bidStatus: 'Awarded' },
          { caregiverId: 1 }
        );

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
        );

        console.log(`Found ${caregivers.length} caregivers for jobId ${jobId}.`);

        // Send SMS notifications
        await Promise.all(
          caregivers.map(caregiver =>
            sendSMS(caregiver.phoneNumber, `Reminder: You have a shift starting soon at ${location}`)
          )
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
