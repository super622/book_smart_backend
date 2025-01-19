
const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
    const hotel_user = require("../controllers/hotel_user.controller.js");
    var router = require("express").Router();

    router.post('/login', hotel_user.login);
    router.post('/signup', hotel_user.signup);
    router.post('/forgotPassword', hotel_user.forgotPassword);
    router.post('/verifyCode', hotel_user.verifyCode);
    router.post('/resetPassword', hotel_user.resetPassword);
    router.post('/phoneSms', hotel_user.phoneSms);
    router.post('/verifyPhone', hotel_user.verifyPhone);
    router.post('/update', verifyUser, hotel_user.Update);
    router.post('/getUserProfile', verifyUser, hotel_user.getUserProfile);
    router.get('/clinician', verifyUser, hotel_user.clinician);
    router.get('/getAllList', verifyUser, hotel_user.getAllList);
    router.post('/getUserInfo', verifyUser, hotel_user.getUserInfo);
    router.post('/allCaregivers', verifyUser, hotel_user.allCaregivers);
    router.post('/updateUserStatus', verifyUser, hotel_user.updateUserStatus);
    router.post('/getUserImage', hotel_user.getUserImage);

    app.use("/api/hotel_user", router);
};
