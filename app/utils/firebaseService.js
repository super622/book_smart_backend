const admin = require('firebase-admin');
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

exports.sendNotification = async (token, title, body, data = {}) => {
    const message = {
        notification: {
            title,
            body,
        },
        data,
        token
    };
    
    try {
        const response = await admin.messaging().send(message);
        console.log("FCM message sent successfully:", response);
    } catch (error) {
        console.error("Error sending FCM message:", error);
    }
}

exports.sendNotificationToMultipleUsers = async (tokens, title, body, data = {}) => {
    const message = {
        notification: {
            title,
            body,
        },
        data,
        tokens,
    };
    
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log("FCM multicast message sent:", response);
    } catch (error) {
        console.error("Error sending FCM multicast:", error);
    }
}
