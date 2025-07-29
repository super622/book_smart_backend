const dotenv = require('dotenv');
dotenv.config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.TWILIO_SENDGRID_API_KEY);

exports.sendMail = async (email, subject, content, file = '') => {
  try {
    console.log(`[sendMail] Preparing to send to: ${email}`);
    let msg;

    if (file === '') {
      msg = {
        to: email,
        from: process.env.SENDER_EMAIL,
        subject,
        html: content,
      };
    } else {
      const attachFile = file;
      attachFile.content = attachFile.content.toString('base64');

      msg = {
        to: email,
        from: process.env.SENDER_EMAIL,
        subject,
        html: content,
        attachments: [{
          content: attachFile.content || '',
          filename: attachFile.name || '',
          type: attachFile.type === 'pdf' ? "application/pdf" : "image/jpeg",
          disposition: attachFile.cid ? "inline" : "attachment",
          content_id: attachFile.cid || 'null',
        }]
      };
    }

    const [response] = await sgMail.send(msg);
    console.log(`[sendMail] Sent to ${email} | Status: ${response.statusCode}`);
    return true;

  } catch (error) {
    console.error(`[sendMail] Error sending to ${email}`, error);
    return false;
  }
};

