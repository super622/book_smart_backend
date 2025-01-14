module.exports = app => {
    const hospital_user = require("../controllers/hospital_user.controller.js");
    var router = require("express").Router();

    router.post('/login', hospital_user.login);
    router.post('/signup', hospital_user.signup);

    app.use("/api/hospital_user", router);
};
