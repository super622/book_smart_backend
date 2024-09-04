const twilio = require('twilio');
const dotenv = require('dotenv').config();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.createVerification = async (verifyPhone) => {
    console.log('verification');
    const verification = await client.verify.v2
        .services(process.env.TWILIO_SERVICE_SID)
        .verifications.create({
            channel: "sms",
            to: verifyPhone,
        });
    console.log(verification.status);
    return verification.status;
}

exports.createVerificationCheck = async function (to, code) {
    const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_SERVICE_SID)
        .verificationChecks.create({
            code: code,
            to: to,
        });
    console.log(verificationCheck.status);
    return verificationCheck.status;
}

exports.pushNotification = async function (message, address) {
    const notificationOpts = {
        toBinding: JSON.stringify({
            binding_type: 'sms',
            address: address,
        }),
        body: message,
    };
    client.notify.v1
        .services('IS825fa0ac8b32411998cb2e8ead356eed')
        .notifications.create(notificationOpts)
        .then(notification => console.log(notification.sid))
        .catch(error => console.log(error));
}
