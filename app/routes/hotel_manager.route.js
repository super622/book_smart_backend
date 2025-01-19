const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const hotel_manager = require("../controllers/hotel_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', hotel_manager.login);
    router.post('/signup', hotel_manager.signup);
    router.post('/forgotPassword', hotel_manager.forgotPassword);
    router.post('/verifyCode', hotel_manager.verifyCode);
    router.post('/resetPassword', hotel_manager.resetPassword);
    router.post('/getAllFacilities', verifyUser, hotel_manager.getAllFacilities);
    router.post('/update', verifyUser, hotel_manager.Update);
    router.get('/list', verifyUser, hotel_manager.managers);

    app.use("/api/hotel_manager", router);
};
