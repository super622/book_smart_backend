
const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
    const hospital_user = require("../controllers/hospital_user.controller.js");
    var router = require("express").Router();

    router.post('/login', hospital_user.login);
    router.post('/signup', hospital_user.signup);
    router.post('/forgotPassword', hospital_user.forgotPassword);
    router.post('/verifyCode', hospital_user.verifyCode);
    router.post('/resetPassword', hospital_user.resetPassword);
    router.post('/phoneSms', hospital_user.phoneSms);
    router.post('/verifyPhone', hospital_user.verifyPhone);
    router.post('/update', verifyUser, hospital_user.Update);
    router.post('/getUserProfile', verifyUser, hospital_user.getUserProfile);
    router.get('/clinician', verifyUser, hospital_user.clinician);
    router.get('/getAllList', verifyUser, hospital_user.getAllList);
    router.post('/getUserInfo', verifyUser, hospital_user.getUserInfo);
    router.post('/allCaregivers', verifyUser, hospital_user.allCaregivers);
    router.post('/updateUserStatus', verifyUser, hospital_user.updateUserStatus);
    router.post('/getUserImage', hospital_user.getUserImage);

    app.use("/api/hospital_user", router);
};
