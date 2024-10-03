var dotenv = require('dotenv');
dotenv.config()
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.TWILIO_SENDGRID_API_KEY)

exports.sendMail = async(email, subject, content, file = '') => {
  try {
    console.log("Creating Transport");
    console.log('to => ', email + ', from  => ', process.env.USER);

    let msg = null;
    if (file == '') {
      msg = {
        to: email,
        from: process.env.USER,
        subject: subject,
        html: content,
      };
    } else {
      let attachFile = file;
      attachFile.content = attachFile.content.toString('base64');
      msg = {
        to: email,
        from: process.env.USER,
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
        console.log('Status Code => ', response[0].statusCode)
        if (response[0].status == '202') {
          console.log('success SendGrid');
        }
        return true;
      })
      .catch((error) => {
        console.log(JSON.stringify(error));
        return false;
      });
  } catch (error) {
    console.log(JSON.stringify(error));
    return false;
  }
};
