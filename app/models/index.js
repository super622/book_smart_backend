const dbConfig = require("../config/db.config.js");

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set('strictQuery', false);

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;
db.clinical = require("./clinical.model.js")(mongoose);
db.jobs = require("./job.model.js")(mongoose);
db.facilities = require("./facilities.model.js")(mongoose);
db.admins = require("./admin.model.js")(mongoose);
db.bids = require('./bidsAndOffers.modal.js')(mongoose);
db.degree = require('./degree.model.js')(mongoose);
db.location = require('./location.model.js')(mongoose);
module.exports = db;
