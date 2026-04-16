import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from './firebase';

export const imageUploadsEnabled = false;

export async function uploadServiceOrderImage(imageDataUrl, orderId) {
    if (!imageUploadsEnabled) {
        throw new Error('O upload de imagem esta desabilitado nesta versao porque o Firebase Storage exige upgrade do plano.');
    }

    if (!storage || !imageDataUrl) {
        return null;
    }

    const imageRef = ref(storage, `service-orders/${orderId}/${Date.now()}`);
    await uploadString(imageRef, imageDataUrl, 'data_url');
    return getDownloadURL(imageRef);
}

export async function deleteFileByUrl(fileUrl) {
    if (!storage || !fileUrl || !fileUrl.startsWith('http')) {
        return;
    }

    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch {
        // Ignora falhas de remocao para nao bloquear a operacao principal.
    }
}
