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

  router.post('/getUserProfile', verifyUser, clinical.getUserProfile);

  router.get('/clinician', verifyUser, clinical.clinician);

  router.get('/getAllList', verifyUser, clinical.getAllList);

  router.post('/getClientInfo', clinical.getClientInfo);

  router.post('/getUserInfo', verifyUser, clinical.getUserInfo);

  router.post('/allCaregivers', verifyUser, clinical.allCaregivers);

  router.post('/updateUserStatus', verifyUser, clinical.updateUserStatus);

  router.post('/getUserImage', verifyUser, clinical.getUserImage);

  app.use("/api/clinical", router);
};
