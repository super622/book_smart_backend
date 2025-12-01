const dbConfig = require("../config/db.config.js");

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set('strictQuery', false);

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;
db.clinical = require("./clinical.model.js")(mongoose);
db.jobs = require("./job.model.js")(mongoose);
db.Djobs = require("./dJob.modal.js")(mongoose);
db.facilities = require("./facilities.model.js")(mongoose);
db.admins = require("./admin.model.js")(mongoose);
db.bids = require('./bidsAndOffers.modal.js')(mongoose);
db.degree = require('./degree.model.js')(mongoose);
db.location = require('./location.model.js')(mongoose);
db.title = require('./title.model.js')(mongoose);
db.restau_user = require('./restau_user.model.js')(mongoose);
db.restau_manager = require('./restau_manager.model.js')(mongoose);
db.hotel_user = require('./hotel_user.model.js')(mongoose);
db.hotel_manager = require('./hotel_manager.model.js')(mongoose);
db.restau_bid = require('./restau_bid.model.js')(mongoose);
db.restau_job = require('./restau_job.model.js')(mongoose);
db.hotel_bid = require('./hotel_bid.model.js')(mongoose);
db.hotel_job = require('./hotel_job.model.js')(mongoose);
db.terms = require('./terms.model.js')(mongoose);

// Test database models (separate collections for testing)
db.test_clinical = require("./clinical.model.js")(mongoose, 'test_clinicals');
db.test_facilities = require("./facilities.model.js")(mongoose, 'test_facilities');
db.test_admins = require("./admin.model.js")(mongoose, 'test_admins');
db.test_terms = require("./terms.model.js")(mongoose, 'test_terms');

module.exports = db;
