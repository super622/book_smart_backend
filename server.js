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

const server = http.createServer(app);

app.use(fileUpload());
require("./app/socketServer")(server);

app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB bootstrap
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
require("./app/routes/djob.route")(app);
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
const { sendSMS } = require("./app/controllers/twilio.js");
const { sendNotification } = require("./app/utils/firebaseService.js");
const mailTrans = require("./app/controllers/mailTrans.controller.js");

let invoices = [];

cron.schedule("50 10 * * 6", () => {
  try {
    const facilities = [
      { id: 1, name: "Facility A", amountDue: 100 },
      { id: 2, name: "Facility B", amountDue: 200 },
    ];
    if (typeof generateInvoice !== "function") {
      console.log("[invoices] generateInvoice not defined. Skipping invoice creation.");
      return;
    }
    facilities.forEach((facility) => {
      const invoicePath = generateInvoice(facility);
      invoices.push({ facilityId: facility.id, path: invoicePath });
    });
    console.log("Invoices generated:", invoices);
    setInvoices(invoices);
  } catch (e) {
    console.error("[invoices] error:", e?.message || e);
  }
});

/* =========================
   Helpers used by JOBS (existing logic)
   ========================= */
function extractStartTime(shiftTime) {
  if (!shiftTime) return null;
  if (/^\d{2}-\d{2}$/.test(shiftTime)) {
    const [startTime] = shiftTime.split("-");
    return moment(startTime, "HH").format("HH:mm");
  }
  if (/^[0-9]{1,2}[ap]m/.test(shiftTime)) {
    const [startTime] = shiftTime.split(" - ");
    return moment(startTime, "h:mma").format("HH:mm");
  }
  if (/[AP]M/.test(shiftTime)) {
    const [startTime] = shiftTime.split(" - ");
    return moment(startTime, "h:mm A").format("HH:mm");
  }
  if (/^[0-9]{1}[ap]m/.test(shiftTime)) {
    const [startTime] = shiftTime.split("-");
    return moment(startTime, "h a").format("HH:mm");
  }
  return null;
}

// Normalize and parse start time from strings like:
// "7:30 AM → 3:45 PM", "8:25 AM -> 2:25 PM", "13-19", "05:00 PM - 11:00 PM", etc.
function extractStartTimeFromAssigned(shiftTime) {
  if (!shiftTime) return null;
  const normalized = String(shiftTime)
    .replace(/[\u202F\u00A0]/g, " ")
    .replace(/\s*(->|→|➔|—|–|to)\s*/gi, " - ")
    .replace(/\s*-\s*/g, " - ")
    .trim();

  const startRaw = normalized.split(" - ")[0]?.trim();
  const strictFormats = ["h:mm A", "h A", "h:mma", "ha", "HH:mm", "HH"];
  for (const f of strictFormats) {
    const m = moment(startRaw, f, true);
    if (m.isValid()) return m.format("HH:mm");
  }
  // Fallbacks
  const ap = startRaw && startRaw.match(/^(\d{1,2}(:\d{2})?\s*[AP]M)/i);
  if (ap) return moment(ap[1].replace(/\s+/g, " "), ["h:mm A", "h A"]).format("HH:mm");
  const h24 = startRaw && startRaw.match(/^(\d{1,2}(:\d{2})?)/);
  if (h24) return moment(h24[1], ["H:mm", "H"]).format("HH:mm");
  return null;
}

// Shared reminder message builder (used for SMS, FCM, and EMAIL)
function buildReminderMessage(loc) {
  return (
    `BookSmart Shift Reminder.\n\n` +
    `We'll see you in 2 hours at ${loc}!\n\n` +
    `Please be:\n- On time\n- Dressed appropriately\n- Courteous\n- Ready to work`
  );
}

// Convert the same text to simple HTML (preserves line breaks)
function textToHtml(text) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">${String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")}</div>`;
}

const REMINDER_SUBJECT = "BookSmart Shift Reminder";

// Scans a user collection (hotel_users/restau_users) for today's accepted assignedShift,
// prints detailed console output, and sends FCM + SMS + Email when start time == now+2h.
// Runs only at minutes 0/15/30/45 in America/Toronto.
async function processAcceptedAssignedShifts(label, UserModel) {
  const tz = "America/Toronto";
  const now = moment.tz(tz).startOf("minute");
  const minute = now.minute();

  // hard gate for exact minutes (0,15,30,45)
  if (![0, 15, 30, 45].includes(minute)) {
    console.log(`[${label}] Skip (minute=${minute}) — only 0/15/30/45 are processed`);
    return;
  }

  const todayLong = now.format("MMMM D, YYYY"); // "August D, YYYY"
  const targetHHmm = now.clone().add(2, "hours").format("HH:mm");

  console.log(
    `[${label}] Tick @ ${now.format("YYYY-MM-DD HH:mm")} ${tz} | today="${todayLong}" | targetStart="${targetHHmm}"`
  );

  // pull users that have at least one accepted shift today
  const users = await UserModel.find(
    { assignedShift: { $elemMatch: { status: "accept", date: todayLong } } },
    { assignedShift: 1, phoneNumber: 1, fcmToken: 1, email: 1, name: 1, aic: 1 }
  );

  if (!users.length) {
    console.log(`[${label}] No users with accepted assignedShift today.`);
    return;
  }

  // log ALL accepted items today with parsed HH:mm
  let acceptedTodayCount = 0;
  users.forEach((u) => {
    const list = (u.assignedShift || []).filter((s) => s.status === "accept" && s.date === todayLong);
    acceptedTodayCount += list.length;
    list.forEach((s) => {
      const parsed = extractStartTimeFromAssigned(s.time);
      console.log(
        `[${label}] candidate user=${u.aic ?? u.email ?? u._id} | date="${s.date}" | time="${s.time}" | parsedStart="${parsed}"`
      );
    });
  });
  console.log(`[${label}] Total accepted items today: ${acceptedTodayCount}`);

  // determine matches that start exactly in 2 hours
  const matches = [];
  users.forEach((u) => {
    (u.assignedShift || []).forEach((s) => {
      if (s.status === "accept" && s.date === todayLong) {
        const parsed = extractStartTimeFromAssigned(s.time);
        if (parsed === targetHHmm) {
          matches.push({ user: u, shift: s, startHHmm: parsed });
        }
      }
    });
  });
  console.log(`[${label}] Matches starting in 2 hours (${targetHHmm}): ${matches.length}`);

  // send for each match with progress logging
  let done = 0;
  for (const { user, shift } of matches) {
    const who = user.aic ?? user.email ?? String(user._id);
    const phone = user.phoneNumber || user.phone || null;
    const token = user.fcmToken || null;
    const email = user.email || null;
    const loc = shift.companyName || shift.location || "your scheduled location";
    const msg = buildReminderMessage(loc); // <-- single source of truth
    const msgHtml = textToHtml(msg);

    console.log(
      `[${label}] >>> SEND for user=${who} | shiftId=${shift.id ?? "?"} | date="${shift.date}" | time="${shift.time}" | start="${targetHHmm}"`
    );

    // SMS
    if (phone) {
      try {
        await sendSMS(phone, loc);
        console.log(`[${label}]   📱 SMS ✅ to ${phone}`);
      } catch (e) {
        console.error(`[${label}]   📱 SMS ❌ ${phone} -> ${e?.message || e}`);
      }
    } else {
      console.log(`[${label}]   📱 SMS skipped (no phone)`);
    }

    // FCM
    if (token) {
      try {
        await sendNotification(token, "Reminder", msg);
        console.log(`[${label}]   🔔 FCM ✅`);
      } catch (e) {
        console.error(`[${label}]   🔔 FCM ❌ -> ${e?.message || e}`);
      }
    } else {
      console.log(`[${label}]   🔔 FCM skipped (no token)`);
    }

    // Email — uses EXACT same message text as SMS/FCM
    if (email) {
      try {
        const r = await mailTrans.sendMail(email, REMINDER_SUBJECT, msgHtml);
        console.log(
          `[${label}]   ✉️  Email ✅ to ${email} | result=${JSON.stringify(r)?.slice(0, 160)}...`
        );
      } catch (e) {
        console.error(`[${label}]   ✉️  Email ❌ to ${email} -> ${e?.message || e}`);
      }
    } else {
      console.log(`[${label}]   ✉️  Email skipped (no email)`);
    }

    done++;
    console.log(`[${label}] <<< Progress ${done}/${matches.length}`);
  }

  if (!matches.length) {
    console.log(`[${label}] No items to notify at this tick.`);
  }
}

/* =========================
   MAIN CRON — every 15 minutes
   ========================= */
cron.schedule("*/15 * * * *", async () => {
  console.log("Running job reminder check at", moment().format("YYYY-MM-DD HH:mm:ss"));

  try {
    // ========= EXISTING JOBS FLOWS (unchanged) =========
    const currentDate = moment.tz(new Date(), "America/Toronto").format("MM/DD/YYYY");
    const twoHoursLater = moment.tz("America/Toronto").add(2, "hours").format("HH:mm");

    console.log(`Looking for jobs with start time: ${twoHoursLater}`);

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
    console.log(`Fetched ${RestauJobs.length} restaurant jobs for ${currentDate}.`);

    const matchingJobs = jobs.filter((job) => extractStartTime(job.shiftTime) === twoHoursLater);
    const matchingHotelJobs = HotelJobs.filter((job) => extractStartTime(job.shiftTime) === twoHoursLater);
    const matchingRestauJobs = RestauJobs.filter((job) => extractStartTime(job.shiftTime) === twoHoursLater);

    console.log(`Found ${matchingJobs.length} matching jobs.`);
    console.log(`Found ${matchingHotelJobs.length} matching hotel jobs.`);
    console.log(`Found ${matchingRestauJobs.length} matching restaurant jobs.`);

    // JOBS → SMS + FCM (kept as you had)
    await Promise.all(
      matchingJobs.map(async (job) => {
        const { jobId, location } = job;
        console.log("Processing jobId:", jobId);

        const bidders = await db.bids.find({ jobId, bidStatus: "Awarded" }, { caregiverId: 1 });
        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded caregiver IDs:", caregiverIds);
        if (!caregiverIds.length) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.clinical.find({ aic: { $in: caregiverIds } }, { phoneNumber: 1, fcmToken: 1 });
        console.log(`Found ${caregivers.length} caregivers for jobId ${jobId}.`);

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            // const message = buildReminderMessage(location);
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

        const bidders = await db.hotel_bid.find({ jobId, bidStatus: "Awarded" }, { caregiverId: 1 });
        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded hotel caregiver IDs:", caregiverIds);
        if (!caregiverIds.length) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.hotel_user.find({ aic: { $in: caregiverIds } }, { phoneNumber: 1, fcmToken: 1 });
        console.log(`Found ${caregivers.length} hotel caregivers for jobId ${jobId}.`);

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            // const message = buildReminderMessage(location);
            await sendNotification(caregiver.fcmToken, "Reminder", message);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for hotel jobId ${jobId}.`);
      })
    );

    await Promise.all(
      matchingRestauJobs.map(async (job) => {
        const { jobId, location } = job;
        console.log("Processing restaurant jobId:", jobId);

        const bidders = await db.restau_bid.find({ jobId, bidStatus: "Awarded" }, { caregiverId: 1 });
        const caregiverIds = bidders.map((bid) => bid.caregiverId);
        console.log("Awarded restaurant caregiver IDs:", caregiverIds);
        if (!caregiverIds.length) {
          console.log(`No awarded bidders for jobId ${jobId}.`);
          return;
        }

        const caregivers = await db.restau_user.find({ aic: { $in: caregiverIds } }, { phoneNumber: 1, fcmToken: 1 });
        console.log(`Found ${caregivers.length} restaurant caregivers for jobId ${jobId}.`);

        await Promise.all(
          caregivers.map(async (caregiver) => {
            await sendSMS(caregiver.phoneNumber, location);
            // const message = buildReminderMessage(location);
            await sendNotification(caregiver.fcmToken, "Reminder", message);
            console.log("phoneNumber:", caregiver.phoneNumber);
          })
        );

        console.log(`SMS notifications sent for restaurant jobId ${jobId}.`);
      })
    );

    // ========= ASSIGNED SHIFT (hotel_users + restau_users) — sends FCM + SMS + Email =========
    await processAcceptedAssignedShifts("HOTEL_USERS", db.hotel_user);
    await processAcceptedAssignedShifts("RESTAU_USERS", db.restau_user);

  } catch (error) {
    console.error("Error processing jobs:", error.message);
  }
});

const PORT = process.env.PORT || 5000;
// const HOST = "0.0.0.0";
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
