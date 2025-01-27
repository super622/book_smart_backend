const { verifyUser } = require("../utils/verifyToken.js");
module.exports = app => {
  const hospitality = require("../controllers/hospitality.controller.js");
  const router = require("express").Router();

  router.get("/getDashboardData", verifyUser, hospitality.getAllData);
  router.post("/getCaregiverTimesheets", verifyUser, hospitality.getCaregiverTimesheets);
  router.post("/getAllUsersList", verifyUser, hospitality.getAllUsersList);
  router.post("/removeAccount", verifyUser, hospitality.removeAccount);
  router.post("/updateUserInfo", verifyUser, hospitality.updateUserInfo);
  router.post("/allCaregivers", verifyUser, hospitality.allContractors);
  router.post("/updatePassword", verifyUser, hospitality.updatePassword);
  router.post("/updateUserStatus", verifyUser, hospitality.updateUserStatus);
  router.post("/getUserProfile", verifyUser, hospitality.getUserProfile);
  router.post("/getUserInfo", verifyUser, hospitality.getUserInfo);
  router.post("/update", verifyUser, hospitality.update);

  app.use("/api/hospitality", router);
};
