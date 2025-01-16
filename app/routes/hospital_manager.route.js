const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const hospital_manager = require("../controllers/hospital_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', hospital_manager.login);
    router.post('/signup', hospital_manager.signup);
    router.post('/forgotPassword', hospital_manager.forgotPassword);
    router.post('/verifyCode', hospital_manager.verifyCode);
    router.post('/resetPassword', hospital_manager.resetPassword);
    router.post('/getAllFacilities', verifyUser, hospital_manager.getAllFacilities);
    router.post('/update', verifyUser, hospital_manager.Update);
    router.get('/list', verifyUser, hospital_manager.managers);

    app.use("/api/hospital_manager", router);
};
