const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
  const admin = require("../controllers/admin.controller.js");

  var router = require("express").Router();

  router.post('/login', admin.login);

  router.post('/signup', admin.signup);

  router.post('/forgotPassword', admin.forgotPassword);
  
  router.post('/verifyCode', admin.verifyCode);

  router.post('/resetPassword', admin.resetPassword);

  router.post('/logout', admin.logout);

  router.post('/update', verifyUser, admin.Update);

  router.post('/updateUser', verifyUser, admin.UpdateUser);

  router.post('/updatePassword', verifyUser, admin.updatePassword);

  router.post('/updateUserInfo', verifyUser, admin.updateUserInfo);

  router.post('/removeAccount', verifyUser, admin.removeAccount);
    
  router.get('/admin', verifyUser, admin.admin);

  router.get('/getAllUsersName', admin.getAllUsersName);

  router.get('/getBidIDs', admin.getBidIDs);

  router.post('/sendMessage', admin.sendMessage);

  router.post('/getAllUsersList', verifyUser, admin.getAllUsersList);

  router.post('/getAdminInfo', verifyUser, admin.getAdminInfo);
  
  router.post('/updateAdminsWithAId', admin.updateAdminsWithAId);
  router.post('/addShiftTypeToAll', admin.addShiftTypeFieldToAll);
  router.post('/addStaffInfoFieldToAll', admin.addStaffInfoFieldToAll);
  router.post('/clearShiftTypeForAll', admin.clearShiftTypeForAll);

  router.get('/getFacilities', admin.getFacilities);

  router.post('/addShiftType', verifyUser, admin.addShiftType);
  router.post('/getShiftTypes', verifyUser, admin.getShiftTypes);
  router.post('/updateShiftType', verifyUser, admin.updateShiftType);
  router.post('/deleteShiftType', verifyUser, admin.deleteShiftType);
  router.get('/acknowledgedUsers', verifyUser, admin.getAcknowledgedUsers);
  router.post('/addStaffToManager', verifyUser, admin.addStaffToManager);
  router.post('/deleteStaffFromManager', verifyUser, admin.deleteStaffFromManager);
  router.post('/getAllStaffShiftInfo', verifyUser, admin.getAllStaffShiftInfo);
  router.post('/addShiftToStaff', verifyUser, admin.addShiftToStaff);
  router.post('/editShiftFromStaff', verifyUser, admin.editShiftFromStaff);
  router.post('/deleteShiftFromStaff', verifyUser, admin.deleteShiftFromStaff);

  app.use("/api/admin", router);
};
