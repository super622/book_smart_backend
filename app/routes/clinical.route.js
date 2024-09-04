const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
  const clinical = require("../controllers/clinical.controller.js");

  var router = require("express").Router();

  router.post('/login', clinical.login);

  router.post('/signup', clinical.signup);

  router.post('/logout', clinical.logout);

  router.post('/forgotPassword', clinical.forgotPassword);
  
  router.post('/verifyCode', clinical.verifyCode);

  router.post('/resetPassword', clinical.resetPassword);

  router.post('/phoneSms', clinical.phoneSms);

  router.post('/verifyPhone', clinical.verifyPhone);

  router.post('/update', verifyUser, clinical.Update);

  router.get('/clinician', verifyUser, clinical.clinician);

  app.use("/api/clinical", router);
};
