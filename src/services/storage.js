import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from './firebase';

export const imageUploadsEnabled = false;
const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryImageUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
const cloudinaryRawUploadPreset = import.meta.env.VITE_CLOUDINARY_RAW_UPLOAD_PRESET?.trim() || cloudinaryImageUploadPreset;

export const progressPdfUploadsEnabled = Boolean(cloudinaryCloudName && cloudinaryRawUploadPreset);
export const MAX_PROGRESS_PDF_SIZE_BYTES = 10 * 1024 * 1024;

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

export async function uploadProgressPdf(file, orderId) {
    if (!progressPdfUploadsEnabled) {
        throw new Error('Anexo em PDF indisponivel. Configure Cloudinary para anexos e tente novamente.');
    }

    if (!file || !orderId) {
        return null;
    }

    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
        throw new Error('Anexe apenas arquivos PDF.');
    }

    if (file.size > MAX_PROGRESS_PDF_SIZE_BYTES) {
        throw new Error('O PDF deve ter no máximo 10MB.');
    }

    const safeName = String(file.name || 'anexo.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryRawUploadPreset);
    formData.append('folder', `service-orders/${orderId}/progress`);
    // Keep the .pdf extension in public_id to improve browser/pdf viewer compatibility on download.
    formData.append('public_id', `${Date.now()}-${safeName}`);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`,
        { method: 'POST', body: formData },
    );

    const data = await response.json();
    if (!response.ok) {
        const cloudinaryMessage = data?.error?.message || 'Erro ao enviar PDF para Cloudinary.';
        throw new Error(cloudinaryMessage);
    }

    return {
        url: data.secure_url,
        publicId: data.public_id,
        fileName: safeName,
    };
}

export async function uploadPopPdf(file, sectorName) {
    if (!progressPdfUploadsEnabled) {
        throw new Error('Anexo em PDF indisponível. Configure Cloudinary para anexos e tente novamente.');
    }

    if (!file) {
        return null;
    }

    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
        throw new Error('Anexe apenas arquivos PDF.');
    }

    if (file.size > MAX_PROGRESS_PDF_SIZE_BYTES) {
        throw new Error('O PDF deve ter no máximo 10MB.');
    }

    const safeName = String(file.name || 'pop.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryRawUploadPreset);
    const folderPath = sectorName ? `pops/${sectorName}` : 'pops';
    formData.append('folder', folderPath);
    formData.append('public_id', `${Date.now()}-${safeName}`);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`,
        { method: 'POST', body: formData },
    );

    const data = await response.json();
    if (!response.ok) {
        const cloudinaryMessage = data?.error?.message || 'Erro ao enviar PDF do POP para Cloudinary.';
        throw new Error(cloudinaryMessage);
    }

    return {
        url: data.secure_url,
        publicId: data.public_id,
        fileName: safeName,
    };
}

export async function uploadTreinamentoPdf(file, tema) {
    if (!progressPdfUploadsEnabled) {
        throw new Error('Anexo em PDF indisponível. Configure Cloudinary para anexos e tente novamente.');
    }

    if (!file) {
        return null;
    }

    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
        throw new Error('Anexe apenas arquivos PDF.');
    }

    if (file.size > MAX_PROGRESS_PDF_SIZE_BYTES) {
        throw new Error('O PDF deve ter no máximo 10MB.');
    }

    const safeName = String(file.name || 'treinamento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryRawUploadPreset);
    const folderPath = tema ? `treinamentos/${tema.replace(/[^a-zA-Z0-9._-]/g, '_')}` : 'treinamentos';
    formData.append('folder', folderPath);
    formData.append('public_id', `${Date.now()}-${safeName}`);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`,
        { method: 'POST', body: formData },
    );

    const data = await response.json();
    if (!response.ok) {
        const cloudinaryMessage = data?.error?.message || 'Erro ao enviar PDF do Treinamento para Cloudinary.';
        throw new Error(cloudinaryMessage);
    }

    return {
        url: data.secure_url,
        publicId: data.public_id,
        fileName: safeName,
    };
}

export async function uploadDocumentoFile(file, categoryName) {
    if (!progressPdfUploadsEnabled) {
        throw new Error('Anexo de arquivo indisponível. Configure Cloudinary para anexos e tente novamente.');
    }

    if (!file) {
        return null;
    }

    if (file.size > MAX_PROGRESS_PDF_SIZE_BYTES) {
        throw new Error('O arquivo deve ter no máximo 10MB.');
    }

    const safeName = String(file.name || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryRawUploadPreset);
    const folderPath = categoryName ? `documentacoes/${categoryName.replace(/[^a-zA-Z0-9._-]/g, '_')}` : 'documentacoes';
    formData.append('folder', folderPath);
    formData.append('public_id', `${Date.now()}-${safeName}`);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`,
        { method: 'POST', body: formData },
    );

    const data = await response.json();
    if (!response.ok) {
        const cloudinaryMessage = data?.error?.message || 'Erro ao enviar arquivo para Cloudinary.';
        throw new Error(cloudinaryMessage);
    }

    return {
        url: data.secure_url,
        publicId: data.public_id,
        fileName: safeName,
    };
}

