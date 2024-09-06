const express = require("express");
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const cron = require('node-cron');

const app = express();

// Load SSL certificate and key
const privateKey = fs.readFileSync('ssl/server.key', 'utf8');
const certificate = fs.readFileSync('ssl/server.crt', 'utf8');

const credentials = { key: privateKey, cert: certificate };

// const server = http.createServer(app);
const server = https.createServer(credentials, app);
app.use(fileUpload());
require("./app/socketServer")(server);
// require("./app/walletavatar")

console.log(new Date);

var corsOptions = {
  origin: "*"
};
dotenv.config();
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// parse requests of content-type - application/json
app.use(express.json());
// mongoose.connect("mongodb://localhost/phantom-avatars", { useNewUrlParser: true, useUnifiedTopology: true });
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

const db = require("./app/models");
db.mongoose
  .connect(db.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("Connected to the database!");
  })
  .catch(err => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });



// simple route
app.get("/test", (req, res) => {
  res.json({ message: "Welcome to bezkoder application." });
});

require("./app/routes/clinical.route")(app);
require("./app/routes/facilities.route")(app);
require("./app/routes/job.routes")(app);
require("./app/routes/admin.route.js")(app);
require('./app/routes/bid.route.js')(app);
const { setInvoices } = require("./app/controllers/facilities.controller.js");
const { log } = require("console");
// require("./app/routes/image.routes")(app);


let invoices = [];

// Scheduled task to generate invoices every Friday at 6 PM
cron.schedule('50 10 * * 6', () => {
    // Example facility data (you can replace this with actual data from your database)
    const facilities = [
        { id: 1, name: 'Facility A', amountDue: 100 },
        { id: 2, name: 'Facility B', amountDue: 200 },
    ];
    
    facilities.forEach(facility => {
        const invoicePath = generateInvoice(facility); // Call the function from the imported module
        invoices.push({ facilityId: facility.id, path: invoicePath });
    });
    console.log('Invoices generated:', invoices);
    
    // Set the invoices in the invoice routes
    setInvoices(invoices);
});


// set port, listen for requests
const PORT = process.env.PORT || 5000;
// const HOST = "0.0.0.0";
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

