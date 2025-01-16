const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const restau_manager = require("../controllers/restau_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', restau_manager.login);
    router.post('/signup', restau_manager.signup);
    router.post('/forgotPassword', restau_manager.forgotPassword);
    router.post('/verifyCode', restau_manager.verifyCode);
    router.post('/resetPassword', restau_manager.resetPassword);
    router.post('/getAllFacilities', verifyUser, restau_manager.getAllFacilities);
    router.post('/update', verifyUser, restau_manager.Update);
    router.get('/list', verifyUser, restau_manager.managers);

    app.use("/api/restau_manager", router);
};
