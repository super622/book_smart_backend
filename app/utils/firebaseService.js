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
    // Convert all data values to strings (FCM requirement)
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
        stringData[key] = String(value);
    }
    
    const message = {
        notification: {
            title,
            body,
        },
        data: stringData,
        tokens,
    };
    
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log("FCM multicast message sent successfully. Success count:", response.successCount, "Failure count:", response.failureCount);
        if (response.failureCount > 0) {
            console.log("Failed tokens:", response.responses.filter(r => !r.success).map(r => r.error));
        }
        return response;
    } catch (error) {
        console.error("Error sending FCM multicast:", error);
        throw error;
    }
}
