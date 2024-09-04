"use strict";

var _require = require("../utils/verifyToken.js"),
    verifyUser = _require.verifyUser,
    verifyToken = _require.verifyToken;

module.exports = function (app) {
  var jobs = require("../controllers/job.controller.js");

  var router = require("express").Router(); // Create a new Spot


  router.get("/shifts", verifyUser, jobs.shifts);
  router.post("/postJob", verifyUser, jobs.postJob);
  app.use("/api/jobs", router);
};
//# sourceMappingURL=job.routes.dev.js.map
