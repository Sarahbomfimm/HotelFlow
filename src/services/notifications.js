import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export async function createUserNotification({
    recipientUid = null,
    recipientEmail = null,
}, {
    message,
    type = 'info',
    relatedOrderId = null,
}) {
    if (!db || (!recipientUid && !recipientEmail) || !message) {
        return null;
    }

    const payload = {
        recipientUid,
        recipientEmail: recipientEmail?.toLowerCase() || null,
        message,
        type,
        lida: false,
        relatedOrderId,
        createdAt: new Date().toISOString(),
    };

    const notificationRef = await addDoc(collection(db, 'notifications'), payload);

    return {
        id: notificationRef.id,
        ...payload,
    };
}
