/**
 * Helper to determine the type of an attachment URL or filename.
 * Returns: 'sheets' | 'excel' | 'pdf' | 'image' | 'none'
 */
export function getAttachmentType(url) {
    if (!url || typeof url !== 'string') return 'none';
    const lower = url.toLowerCase();

    // Google Sheets or general external spreadsheet links
    if (
        lower.includes('docs.google.com/spreadsheets') ||
        lower.includes('sheets.google.com') ||
        lower.includes('spreadsheets')
    ) {
        return 'sheets';
    }

    // Excel or CSV files
    if (
        /\.(xlsx|xls|csv)($|\?|&)/i.test(lower) ||
        (lower.includes('/raw/upload/') && /\.(xlsx|xls|csv)/i.test(lower))
    ) {
        return 'excel';
    }

    // PDF files
    if (
        /\.pdf($|\?|&)/i.test(lower) ||
        (lower.includes('/raw/upload/') && !/\.(xlsx|xls|csv)/i.test(lower))
    ) {
        return 'pdf';
    }

    // Default to image for all other attachments
    return 'image';
}

/**
 * Returns a human-friendly title/label for an attachment
 */
export function getAttachmentLabel(url) {
    const type = getAttachmentType(url);
    switch (type) {
        case 'sheets':
            return 'Planilha Google Sheets';
        case 'excel':
            return 'Planilha Excel / CSV';
        case 'pdf':
            return 'Documento PDF';
        case 'image':
            return 'Imagem';
        default:
            return 'Anexo';
    }
}
