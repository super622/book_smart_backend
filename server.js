const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const cors = require("cors");
const moment = require("moment-timezone");
const fileUpload = require("express-fileupload");
const cron = require("node-cron");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Optional HTTPS
// const privateKey = fs.readFileSync('ssl/server.key', 'utf8');
// const certificate = fs.readFileSync('ssl/server.crt', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

const server = http.createServer(app);
// const server = https.createServer(credentials, app);

app.use(fileUpload());
require("./app/socketServer")(server);

app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require("./app/models");
db.mongoose
  .connect(db.url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to the database!"))
  .catch((err) => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

// routes
require("./app/routes/clinical.route")(app);
require("./app/routes/facilities.route")(app);
require("./app/routes/job.routes")(app);
require("./app/routes/admin.route.js")(app);
require("./app/routes/bid.route.js")(app);
require("./app/routes/degree.route.js")(app);
require("./app/routes/location.route.js")(app);
require("./app/routes/title.route.js")(app);
require("./app/routes/restau_user.route.js")(app);
require("./app/routes/restau_manager.route.js")(app);
require("./app/routes/hotel_manager.route.js")(app);
require("./app/routes/hotel_user.route.js")(app);
require("./app/routes/restau_bid.route.js")(app);
require("./app/routes/restau_job.route.js")(app);
require("./app/routes/hotel_bid.route.js")(app);
require("./app/routes/hotel_job.route.js")(app);
require("./app/routes/hospitality.route.js")(app);

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

const { setInvoices } = require("./app/controllers/facilities.controller.js");
// Keep your existing senders
const { sendSMS } = require("./app/controllers/twilio.js");
const { sendNotification } = require("./app/utils/firebaseService.js");

let invoices = [];

cron.schedule("50 10 * * 6", () => {
  const facilities = [
    { id: 1, name: "Facility A", amountDue: 100 },
    { id: 2, name: "Facility B", amountDue: 200 },
  ];
  facilities.forEach((facility) => {
    const invoicePath = generateInvoice(facility); // assumed defined elsewhere
    invoices.push({ facilityId: facility.id, path: invoicePath });
  });
  console.log("Invoices generated:", invoices);
  setInvoices(invoices);
});

/** ===== Existing helper for *jobs* (left as-is) ===== */
function extractStartTime(shiftTime) {
  if (shiftTime.match(/^\d{2}-\d{2}$/)) {
    const [startTime] = shiftTime.split("-");
    return moment(startTime, "HH").format("HH:mm");
  }
  if (shiftTime.match(/^[0-9]{1,2}[ap]m/)) {
    const [startTime] = shiftTime.split(" - ");
    return moment(startTime, "h:mma").format("HH:mm");
  }
  if (shiftTime.match(/[AP]M/)) {
    const [startTime] = shiftTime.split(" - ");
    return moment(startTime, "h:mm A").format("HH:mm");
  }
  if (shiftTime.match(/^[0-9]{1}[ap]m/)) {
    const [startTime] = shiftTime.split("-");
    return moment(startTime, "h a").format("HH:mm");
  }
  return null;
}

/** ===== Helpers for hotel/restau assignedShift ===== */
function extractStartTimeFromAssigned(shiftTime) {
  if (!shiftTime) return null;

  // Normalize odd spaces and separators (→ ➔ ➜ -> — – "to")
  const normalized = String(shiftTime)
    .replace(/[\u202F\u00A0]/g, " ")         // narrow/normal NBSP -> space
    .replace(/(→|➔|➜|->|—|–|to)/gi, "-")    // unify separators to '-'
    .replace(/\s+/g, " ")
    .trim();

  const startRaw = normalized.split("-")[0].trim();

  // include hh formats to accept leading zeros like "05:00 PM"
  const formats = ["h:mm A", "h A", "h:mma", "ha", "hh:mm A", "hh A", "HH:mm", "HH"];
  for (const f of formats) {
    const m = moment(startRaw, f, true);
    if (m.isValid()) return m.format("HH:mm");
  }
  return null;
}

function getShiftStartMomentFromAssigned(shift, tz) {
  try {
    const tzName = typeof tz === "string" && tz ? tz : "America/Toronto";

    if (!shift?.date || !shift?.time) {
      console.log("[parse] missing date/time on shift:", shift);
      return null;
    }

    const startHHmm = extractStartTimeFromAssigned(shift.time);
    console.log(
      "[parse] rawTime=",
      shift.time,
      "| startHHmm=",
      startHHmm,
      "| tz=",
      tzName
    );
    if (!startHHmm) return null;

    const dateFormats = [
      "MMMM D, YYYY",
      "MMMM DD, YYYY",
      "MMM D, YYYY",
      "MM/DD/YYYY",
    ];

    for (const df of dateFormats) {
      const input = `${shift.date} ${startHHmm}`;
      const fmt = `${df} HH:mm`;

      let m;
      try {
        m = moment.tz(input, fmt, tzName);
      } catch (e) {
        console.error("[parse] moment.tz threw:", { input, fmt, tzName }, e);
        continue;
      }

      console.log(
        "[parse] try format=",
        fmt,
        "| valid=",
        m.isValid(),
        "| parsed=",
        m && m.isValid() ? m.format("YYYY-MM-DD HH:mm") : null
      );
      if (m.isValid()) return m;
    }
    return null;
  } catch (e) {
    console.error(
      "[parse] getShiftStartMomentFromAssigned error:",
      { date: shift?.date, time: shift?.time, tzType: typeof tz, tzValue: tz },
      e
    );
    return null;
  }
}

/** ===== Cron: every 15 minutes ===== */
cron.schedule("*/15 * * * *", async () => {
  console.log(
    "Running job reminder check at",
    moment().format("YYYY-MM-DD HH:mm:ss")
  );

  try {
    const currentDate = moment
      .tz(new Date(), "America/Toronto")
      .format("MM/DD/YYYY");
    const twoHoursLater = moment
      .tz("America/Toronto")
      .add(2, "hours")
      .format("HH:mm");

    console.log(`Looking for jobs with start time: ${twoHoursLater}`);

    // === Existing jobs logic (UNCHANGED) ===
    const jobs = await db.jobs.find(
      { shiftDate: currentDate, jobStatus: "Awarded" },
      { jobId: 1, shiftTime: 1, location: 1 }
    );
    const HotelJobs = await db.hotel_job.find(
      { shiftDate: currentDate, jobStatus: "Awarded" },
      { jobId: 1, shiftTime: 1, location: 1 }
    );
    const RestauJobs = await db.restau_job.find(
      { shiftDate: currentDate, jobStatus: "Awarded" },
      { jobId: 1, shiftTime: 1, location: 1 }
    );

    console.log(`Fetched ${jobs.length} jobs for ${currentDate}.`);
    console.log(`Fetched ${HotelJobs.length} hotel jobs for ${currentDate}.`);
    console.log(
      `Fetched ${RestauJobs.length} restaurant jobs for ${currentDate}.`
    );

    const matchingJobs = jobs.filter(
      (job) => extractStartTime(job.shiftTime) === twoHoursLater
    );
    const matchingHotelJobs = HotelJobs.filter(
      (job) => extractStartTime(job.shiftTime) === twoHoursLater
    );
    const matchingRestauJobs = RestauJobs.filter(
      (job) => extractStartTime(job.shiftTime) === twoHoursLater
    );

    console.log(`Found ${matchingJobs.length} matching jobs.`);
    console.log(`Found ${matchingHotelJobs.length} matching hotel jobs.`);
    console.log(`Found ${matchingRestauJobs.length} matching restaurant jobs.`);

    // JOBS flow (kept: SMS + FCM)
    await Promise.all(
      matchingJobs.map(async (job) => {
        const { jobId, location } = job;
        console.log("Processing jobId:", jobId);

        const bidders = await db.bids.find(
          { jobId, bidStatus: "Awarded" },
          { caregiverId: 1 }
        );

        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded caregiver IDs:", caregiverIds);
        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.clinical.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1, fcmToken: 1 }
        );
        console.log(
          `Found ${caregivers.length} caregivers for jobId ${jobId}.`
        );

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            const message =
              `BookSmart Shift Reminder.\n\n` +
              `We'll see you in 2 hours at ${location}!\n\n` +
              `Please be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`;
            await sendNotification(caregiver.fcmToken, "Reminder", message);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );

    await Promise.all(
      matchingHotelJobs.map(async (job) => {
        const { jobId, location } = job;
        console.log("Processing hotel jobId:", jobId);

        const bidders = await db.hotel_bid.find(
          { jobId, bidStatus: "Awarded" },
          { caregiverId: 1 }
        );

        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded hotel caregiver IDs:", caregiverIds);
        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.hotel_user.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1, fcmToken: 1 }
        );
        console.log(
          `Found ${caregivers.length} hotel caregivers for jobId ${jobId}.`
        );

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            const message =
              `BookSmart Shift Reminder.\n\n` +
              `We'll see you in 2 hours at ${location}!\n\n` +
              `Please be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`;
            await sendNotification(caregiver.fcmToken, "Reminder", message);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );

    await Promise.all(
      matchingRestauJobs.map(async (job) => {
        const { jobId, location } = job;
        console.log("Processing restaurant jobId:", jobId);

        const bidders = await db.restau_bid.find(
          { jobId, bidStatus: "Awarded" },
          { caregiverId: 1 }
        );

        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded restaurant caregiver IDs:", caregiverIds);
        if (caregiverIds.length === 0) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.restau_user.find(
          { aic: { $in: caregiverIds } },
          { phoneNumber: 1, fcmToken: 1 }
        );
        console.log(
          `Found ${caregivers.length} restaurant caregivers for jobId ${jobId}.`
        );

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            const message =
              `BookSmart Shift Reminder.\n\n` +
              `We'll see you in 2 hours at ${location}!\n\n` +
              `Please be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`;
            await sendNotification(caregiver.fcmToken, "Reminder", message);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for jobId ${jobId}.`);
      })
    );

    // === NEW: Accepted-shift reminders for hotel_users & restau_users ===
    const tzName = "America/Toronto";

    const hotelUsers = await db.hotel_user.find(
      { "assignedShift.status": "accept" },
      { assignedShift: 1, phoneNumber: 1, fcmToken: 1, name: 1, aic: 1 }
    );
    console.log(
      `[hotel] users with at least one accepted shift: ${hotelUsers.length}`
    );

    const restauUsers = await db.restau_user.find(
      { "assignedShift.status": "accept" },
      { assignedShift: 1, phoneNumber: 1, fcmToken: 1, name: 1, aic: 1 }
    );
    console.log(
      `[restaurant] users with at least one accepted shift: ${restauUsers.length}`
    );

    async function processAcceptedShifts(users, typeLabel) {
      const windowMinutes = 15;
      const now = moment.tz(tzName).seconds(0).milliseconds(0); // align minute to cron

      for (const user of users) {
        const who = user.aic ?? (user._id ? String(user._id) : "(unknown user)");

        for (const sh of user.assignedShift || []) {
          // console.log(
          //   `[${typeLabel}] user=${who} | shiftId=${sh.id ?? "(no id)"} | status=${sh.status} | date="${sh.date}" | time="${sh.time}"`
          // );
          if (sh.status !== "accept") {
            // console.log(`[${typeLabel}]   ⛔ skip: status is not "accept"`);
            continue;
          }

          const startAt = getShiftStartMomentFromAssigned(sh, tzName);
          if (!startAt) {
            console.log(
              // `[${typeLabel}]   ⛔ skip: could not parse start time from date/time`
            );
            continue;
          }

          const notifyAt = startAt.clone().subtract(2, "hours").seconds(0).milliseconds(0);
          const diffMin = now.diff(notifyAt, "minutes"); // 0..14 on the exact 15-min tick
          const hit = diffMin >= 0 && diffMin < windowMinutes;

          // console.log(
          //   `[${typeLabel}]   times: startAt=${startAt.format(
          //     "YYYY-MM-DD HH:mm"
          //   )} | notifyAt=${notifyAt.format("YYYY-MM-DD HH:mm")} | now=${now.format(
          //     "YYYY-MM-DD HH:mm"
          //   )} | diffMin=${diffMin} | hit=${hit}`
          // );

          if (!hit) {
            // console.log(
            //   `[${typeLabel}]   ⏱️ not in window (fires only in [notifyAt, notifyAt+15m), e.g. 09:45 -> 07:45)`
            // );
            continue;
          }

          const locationOrName =
            sh.location || sh.companyName || `${typeLabel} shift`;

          // ===== Send SMS + FCM (no email) =====
          try {
            await sendSMS(user.phoneNumber, locationOrName);
            console.log(`[${typeLabel}]   📱 SMS attempted to ${user.phoneNumber}`);
          } catch (e) {
            console.error(
              `[${typeLabel}]   ❌ SMS failed for ${user.phoneNumber}:`,
              e?.message || e
            );
          }

          try {
            const pushMsg =
              `BookSmart Shift Reminder.\n\n` +
              `We'll see you in 2 hours at ${locationOrName}!\n\n` +
              `Please be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`;
            await sendNotification(user.fcmToken, "Reminder", pushMsg);
            console.log(`[${typeLabel}]   🔔 FCM attempted for user=${who}`);
          } catch (e) {
            console.error(`[${typeLabel}]   ❌ FCM failed:`, e?.message || e);
          }

          console.log(`[${typeLabel}]   ✅ phone+FCM processed for user=${who}`);
        }
      }
    }

    await processAcceptedShifts(hotelUsers, "hotel");
    await processAcceptedShifts(restauUsers, "restaurant");
  } catch (error) {
    console.error("Error processing jobs:", error.message);
  }
});

const PORT = process.env.PORT || 5000;
// const HOST = "0.0.0.0";
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
