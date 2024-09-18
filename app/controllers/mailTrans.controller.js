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



  exports.sendMail = async(email, subject, content, file = '') => {
    try {
        console.log("Creating Transport");
        console.log('to => ', email + ', from  => ', process.env.USER);
        let attachFile = file;
        attachFile.content = attachFile.content.toString('base64');
        console.log('file => ', attachFile);

        let msg = null;
        if (attachFile == '') {
          msg = {
            to: email,
            from: 'support@whybookdumb.com',
            subject: subject,
            html: content,
          };
        } else {
          msg = {
            to: email,
            from: 'support@whybookdumb.com',
            subject: subject,
            html: content,
            attachments: [
              {
                content: attachFile?.content || '',
                filename: attachFile?.name || '',
                type: attachFile?.type == 'pdf' ? "application/pdf" : "image/jpeg",
                disposition: "attachment"
              }
            ]
          };
        }

        
        sgMail
          .send(msg)
          .then((response) => {
            console.log('Status => ', response[0]);
            console.log('Status Code => ', response[0].statusCode)
            console.log('Status Header => ', response[0].headers)
            if (response[0].status == '202') {
              console.log('success SendGrid');
            }
            return true;
          })
          .catch((error) => {
            console.log(JSON.stringify(error));
            return false;
          })
    } catch (error) {
        console.log(JSON.stringify(error));
        return false;
    }
}