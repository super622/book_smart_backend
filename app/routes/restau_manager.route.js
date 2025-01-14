module.exports = app => {
    const restau_manager = require("../controllers/restau_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', restau_manager.login);
    router.post('/signup', restau_manager.signup);

    app.use("/api/restau_manager", router);
};
