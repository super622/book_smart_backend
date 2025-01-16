const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const restau_user = require("../controllers/restau_user.controller.js");
    var router = require("express").Router();

    router.post('/login', restau_user.login);
    router.post('/signup', restau_user.signup);
    router.post('/forgotPassword', restau_user.forgotPassword);
    router.post('/verifyCode', restau_user.verifyCode);
    router.post('/resetPassword', restau_user.resetPassword);
    router.post('/phoneSms', restau_user.phoneSms);
    router.post('/verifyPhone', restau_user.verifyPhone);
    router.post('/update', verifyUser, restau_user.Update);
    router.post('/getUserProfile', verifyUser, restau_user.getUserProfile);
    router.get('/clinician', verifyUser, restau_user.clinician);
    router.get('/getAllList', verifyUser, restau_user.getAllList);
    router.post('/getUserInfo', restau_user.getUserInfo);
    router.post('/allCaregivers', verifyUser, restau_user.allCaregivers);
    router.post('/updateUserStatus', verifyUser, restau_user.updateUserStatus);
    router.post('/getUserImage', restau_user.getUserImage);

    app.use("/api/restau_user", router);
};
