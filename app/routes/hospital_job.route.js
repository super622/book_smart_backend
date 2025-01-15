const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
    const jobs = require("../controllers/hospital_job.controller.js");
    var router = require("express").Router();

    router.post("/shifts", verifyUser, jobs.shifts);
    router.post("/postJob", jobs.postJob);
    router.post("/updateHoursStatus", verifyUser, jobs.updateHoursStatus);
    router.post("/removeJob", jobs.removeJob);
    router.post("/getJob", jobs.getJob);
    router.post("/setAwarded", jobs.setAwarded);
    router.post("/updateTimeSheet", verifyUser, jobs.updateTimeSheet);
    router.post("/updateJobRatings", verifyUser, jobs.updateJobRatings);
    router.get("/myShift", verifyUser, jobs.myShift);
    router.post("/getTimesheet", verifyUser, jobs.getTimesheet);
    router.post("/updateJobTSVerify", verifyUser, jobs.updateJobTSVerify);
    router.get("/getDashboardData", verifyUser, jobs.getAllData);
    router.post("/getCaregiverTimesheets", verifyUser, jobs.getCaregiverTimesheets);
    router.post('/update', verifyUser, jobs.Update);
    router.post("/updateDocuments", verifyUser, jobs.updateDocuments);
    router.get('/generateInvoice', jobs.generateInvoice);
    router.get('/invoices', jobs.invoices);
    router.post('/sendInvoice', jobs.sendInvoice);
    router.post('/updateTime', verifyUser, jobs.updateTime)

    app.use("/api/hospital/jobs", router);
};
