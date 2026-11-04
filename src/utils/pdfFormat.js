/** Vrai si le format déclaré d'une ressource est PDF. */
export const isPdfFormat = (format) => String(format || '').toLowerCase() === 'pdf';
