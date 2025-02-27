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
  router.post("/getAllHotelAndRestaurants", verifyUser, hospitality.getAllHotelAndRestaurants);
  router.post("/getHotelAndRestaurantInfo", verifyUser, hospitality.getHotelAndRestaurantInfo);
  router.post("/shifts", verifyUser, hospitality.shifts);
  router.post("/removeJob", hospitality.removeJob);
  router.post("/PostJob", hospitality.updateJob);
  router.post("/updateDocuments", verifyUser, hospitality.updateDocuments);
  router.post("/getJob", hospitality.getJob);
  router.post("/updateHoursStatus", hospitality.updateHoursStatus);
  router.post("/setAwarded", hospitality.setAwarded);
  router.post("/getClientInfo", hospitality.getClientInfo);
  router.post("/getAllContractorList", hospitality.getAllContractorList);
  router.post("/getContractorBidIds", hospitality.getContractorBidIds);
  router.get("/getAllRestaurants", hospitality.getAllRestaurants);
  router.get("/getAllHotels", hospitality.getAllHotels);
  
  app.use("/api/hospitality", router);
};
