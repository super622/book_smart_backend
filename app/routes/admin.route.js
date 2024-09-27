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

  router.get('/getAllUsersName', verifyUser, admin.getAllUsersName);

  router.get('/getBidIDs', verifyUser, admin.getBidIDs);

  router.post('/getAllUsersList', verifyUser, admin.getAllUsersList);

  app.use("/api/admin", router);
};
