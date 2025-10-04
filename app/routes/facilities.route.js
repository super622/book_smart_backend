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

  router.post('/getAllFacilities', verifyUser, facilities.getAllFacilities);

  router.post('/getFacilityInfo', verifyUser, facilities.getFacilityInfo);

  router.post('/update', verifyUser, facilities.Update);
  
  router.get('/facility', verifyUser, facilities.facility);

  router.post('/addShiftTypeToAll', facilities.addShiftTypeFieldToAll);
  router.post('/addStaffInfoFieldToAll', facilities.addStaffInfoFieldToAll);
  router.post('/clearShiftTypeForAll', facilities.clearShiftTypeForAll);

  router.post('/addShiftType', verifyUser, facilities.addShiftType);
  router.post('/getShiftTypes', verifyUser, facilities.getShiftTypes);
  router.post('/updateShiftType', verifyUser, facilities.updateShiftType);
  router.post('/deleteShiftType', verifyUser, facilities.deleteShiftType);
  router.get('/acknowledgedUsers', verifyUser, facilities.getAcknowledgedUsers);
  router.post('/addStaffToManager', verifyUser, facilities.addStaffToManager);
  router.post('/deleteStaffFromManager', verifyUser, facilities.deleteStaffFromManager);
  router.post('/getAllStaffShiftInfo', verifyUser, facilities.getAllStaffShiftInfo);
  router.post('/addShiftToStaff', verifyUser, facilities.addShiftToStaff);
  router.post('/editShiftFromStaff', verifyUser, facilities.editShiftFromStaff);
  router.post('/deleteShiftFromStaff', verifyUser, facilities.deleteShiftFromStaff);

  app.use("/api/facilities", router);
};
