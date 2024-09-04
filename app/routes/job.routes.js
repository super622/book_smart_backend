const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
  const jobs = require("../controllers/job.controller.js");

  var router = require("express").Router();

  // Create a new Spot
  router.get("/shifts", verifyUser, jobs.shifts);
  router.post("/postJob", verifyUser, jobs.postJob);
  router.get("/myShift", verifyUser, jobs.myShift);
  router.get("/getDashboardData", verifyUser, jobs.getAllData)
  router.post('/update', verifyUser, jobs.Update);
  // router.get('invoices', verifyUser, facilities.invoices);
  router.get('/generateInvoice', jobs.generateInvoice);

  // router.get('invoices', verifyUser, facilities.invoices);
  router.get('/invoices', jobs.invoices);

  // router.post('sendInvoice', verifyUser, jobs.sendInvoice);
  router.post('/sendInvoice', jobs.sendInvoice);

  router.post('/updateTime', verifyUser, jobs.updateTime)

  app.use("/api/jobs", router);
};
