module.exports = app => {
    const restau_user = require("../controllers/restau_user.controller.js");
    var router = require("express").Router();

    router.post('/login', restau_user.login);
    router.post('/signup', restau_user.signup);

    app.use("/api/restau_user", router);
};
