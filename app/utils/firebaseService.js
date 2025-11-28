const admin = require('firebase-admin');
const serviceAccount = require("../../serviceAccountKey.json");

// Check if Firebase is already initialized to avoid re-initialization errors
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with project:', serviceAccount.project_id);
} else {
    console.log('Firebase Admin already initialized');
}

exports.sendNotification = async (token, title, body, data = {}) => {
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
        token
    };
    
    try {
        const response = await admin.messaging().send(message);
        console.log("FCM message sent successfully. Message ID:", response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error("Error sending FCM message:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // Common error codes:
        // - messaging/invalid-registration-token: Token is invalid
        // - messaging/registration-token-not-registered: Token is not registered
        // - messaging/invalid-argument: Invalid arguments
        
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
            console.error("Token is invalid or not registered. Token:", token.substring(0, 20) + "...");
        }
        
        // Handle SenderId mismatch error specifically
        if (error.code === 'messaging/mismatched-credential') {
            console.error("CRITICAL: SenderId mismatch detected!");
            console.error("This means the FCM token was generated for a different Firebase project.");
            console.error("The token was generated for a different project than the service account key being used.");
            console.error("Solution: Ensure the serviceAccountKey.json matches the Firebase project used by the mobile app.");
            console.error("Current service account project_id:", serviceAccount.project_id);
        }
        
        return { success: false, error: error.message, code: error.code };
    }
}

exports.sendNotificationToMultipleUsers = async (tokens, title, body, data = {}) => {
    if (!tokens || tokens.length === 0) {
        console.log("No tokens provided for notification");
        return { successCount: 0, failureCount: 0, responses: [] };
    }
    
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
        console.log(`Attempting to send notification to ${tokens.length} tokens`);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log("FCM multicast message sent successfully. Success count:", response.successCount, "Failure count:", response.failureCount);
        
        if (response.failureCount > 0) {
            const failedResponses = response.responses.filter(r => !r.success);
            console.log(`Failed tokens count: ${failedResponses.length}`);
            failedResponses.forEach((failed, index) => {
                console.error(`Failed token ${index + 1}:`, {
                    error: failed.error?.code || 'Unknown error',
                    message: failed.error?.message || 'No error message',
                    tokenPreview: tokens[response.responses.indexOf(failed)]?.substring(0, 20) + "..."
                });
            });
        }
        
        if (response.successCount > 0) {
            console.log(`Successfully sent to ${response.successCount} devices`);
        }
        
        return response;
    } catch (error) {
        console.error("Error sending FCM multicast:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        throw error;
    }
}
