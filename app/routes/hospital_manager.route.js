module.exports = app => {
    const hospital_manager = require("../controllers/hospital_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', hospital_manager.login);
    router.post('/signup', hospital_manager.signup);

    app.use("/api/hospital_manager", router);
};
