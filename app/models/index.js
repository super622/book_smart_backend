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
db.title = require('./title.model.js')(mongoose);
db.restau_user = require('./restau_user.model.js')(mongoose);
db.restau_manager = require('./restau_manager.model.js')(mongoose);
db.hospital_user = require('./hospital_user.model.js')(mongoose);
db.hospital_manager = require('./hospital_manager.model.js')(mongoose);
module.exports = db;
