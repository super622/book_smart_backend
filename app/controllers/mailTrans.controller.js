// var nodemailer = require('nodemailer');
// var http = require('http');
// var url = require('url');
var dotenv = require('dotenv');
dotenv.config()

// exports.sendMail = async(email, subject, content) => {
//     try {
//         console.log("Creating Transport")
//         var transporter = nodemailer.createTransport({
//             service:'gmail',
//             auth: {
//               user: "lovely7rh@gmail.com",
//               pass: "hkobgghzvfhsewxr",
//             }
//         });
//         var mailOptions = {
//           from: "lovely7rh@gmail.com",
//           to: email,
//           subject: subject,
//           html: content
//         }
//         console.log("Sending mail")
//         transporter.sendMail(mailOptions, function(error, info) {
//             if (error) {
//                 console.log(error);
//                 return false;
//             } else {
//                 console.log('Email sent: ' + info.response)
//                 return true;
//             }
//         })
//     } catch (error) {
//         console.log(error);
//         return false;
//     }
// }

// sendMail('royhensley728@gmail.com', 'Test', 'test')

const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.TWILIO_SENDGRID_API_KEY)



  exports.sendMail = async(email, subject, content) => {
    try {
        console.log("Creating Transport")
        const msg = {
          to: email, // Change to your recipient
          from: process.env.USER, // Change to your verified sender
          subject: subject,
          html: content,
        }
        
        sgMail
          .send(msg)
          .then((response) => {
            console.log(response[0].statusCode)
            console.log(response[0].headers)
            if (response[0].status == '202') {
                console.log('success SendGrid');
                
            }
            return true;
          })
          .catch((error) => {
            console.error(error)
            return false;
          })
    } catch (error) {
        console.log(error);
        return false;
    }
}