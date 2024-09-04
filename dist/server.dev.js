"use strict";

var express = require("express");

var http = require('http');

var cors = require("cors");

var dotenv = require("dotenv");

var bodyParser = require("body-parser");

var fileUpload = require('express-fileupload');

var app = express();
var server = http.createServer(app);
app.use(fileUpload());

require("./app/socketServer")(server); // require("./app/walletavatar")


var corsOptions = {
  origin: "*"
};
dotenv.config();
app.use(cors(corsOptions));
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
})); // parse requests of content-type - application/json

app.use(express.json()); // mongoose.connect("mongodb://localhost/phantom-avatars", { useNewUrlParser: true, useUnifiedTopology: true });
// parse requests of content-type - application/x-www-form-urlencoded

app.use(express.urlencoded({
  extended: true
}));

var db = require("./app/models");

db.mongoose.connect(db.url, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(function () {
  console.log("Connected to the database!");
})["catch"](function (err) {
  console.log("Cannot connect to the database!", err);
  process.exit();
}); // simple route

app.get("/test", function (req, res) {
  res.json({
    message: "Welcome to bezkoder application."
  });
});

require("./app/routes/user.routes")(app);

require("./app/routes/ticket.routes")(app);

require("./app/routes/buyTickets.routes")(app);

require("./app/routes/chat.routes")(app);

require("./app/routes/clinical.route")(app); // require("./app/routes/image.routes")(app);
// set port, listen for requests


var PORT = process.env.PORT || 5000; // const HOST = "0.0.0.0";

server.listen(PORT, function () {
  console.log("Server is running on port ".concat(PORT, "."));
});
//# sourceMappingURL=server.dev.js.map
