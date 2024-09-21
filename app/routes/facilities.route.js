const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
  const facilities = require("../controllers/facilities.controller.js");

  var router = require("express").Router();

  router.post('/login', facilities.login);

  router.post('/signup', facilities.signup);

  router.post('/forgotPassword', facilities.forgotPassword);
  
  router.post('/verifyCode', facilities.verifyCode);

  router.post('/resetPassword', facilities.resetPassword);

  router.post('/logout', facilities.logout);

  router.get('/getFacilityList', verifyUser, facilities.getFacilityList);

  router.post('/getFacilityInfo', verifyUser, facilities.getFacilityInfo);

  router.post('/update', verifyUser, facilities.Update);
  
  router.get('/facility', verifyUser, facilities.facility);

  app.use("/api/facilities", router);
};
