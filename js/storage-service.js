// ============================================================
// STORAGE SERVICE — Capa de abstracción para subir archivos
// HOY usa Cloudinary (gratis, sin Firebase Storage)
// FUTURO: para migrar a Firebase Storage solo cambia este archivo
// ============================================================

const STORAGE_PROVIDER = 'cloudinary'; // Cambiar a 'firebase' al migrar

// ── Configuración Cloudinary ─────────────────────────────────
const CLOUDINARY_CLOUD  = 'dxrkrzeyl';
const CLOUDINARY_PRESET = 'myclub_docs';

// Cloudinary usa endpoints distintos según el tipo de archivo:
// "image" para fotos, "raw" para PDFs y Word
const CLOUDINARY_IMAGE_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
const CLOUDINARY_RAW_URL   = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`;

// ── Tipos de archivo permitidos ──────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',                                                        // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'   // .docx
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── uploadDocument ───────────────────────────────────────────
// Sube un archivo a Cloudinary y devuelve { url, publicId, fileType }
// Al migrar a Firebase Storage, solo reemplaza esta función
async function uploadDocument(file) {
  // Validar tipo
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Solo se permiten PDF, imágenes (JPG, PNG) o Word (.doc, .docx)');
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo es muy grande. Máximo permitido: 10 MB');
  }

  // PDFs e imágenes usan el endpoint "image" (público por defecto)
  // Word usa "raw" — si falla la descarga, convertir a PDF antes de subir
  const isRaw = file.type === 'application/msword' ||
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const uploadUrl = isRaw ? CLOUDINARY_RAW_URL : CLOUDINARY_IMAGE_URL;

  // Armar la petición
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'myclub_jugadores');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al subir el archivo. Intenta de nuevo');
  }

  const data = await response.json();

  // Determinar ícono según tipo de archivo
  let fileType = 'imagen';
  if (file.type === 'application/pdf') fileType = 'pdf';
  if (file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    fileType = 'word';
  }

  return {
    url:      data.secure_url,
    publicId: data.public_id,
    fileType
  };
}

// ── downloadDocument ─────────────────────────────────────────
// Abre el archivo en nueva pestaña.
// - PDFs e imágenes: el navegador los muestra con su propio botón de descarga
// - Word (.doc/.docx): el navegador los descarga automáticamente
function downloadDocument(url) {
  window.open(url, '_blank');
}

// ── deleteDocumentFromStorage ─────────────────────────────────
// Con Cloudinary sin firma no se puede borrar desde el cliente.
// El archivo queda en la nube pero se elimina el registro del jugador.
// Al migrar a Firebase Storage aquí va: storageRef.delete()
function deleteDocumentFromStorage(publicId) {
  // Firebase Storage (futuro):
  // return firebase.storage().ref(publicId).delete();
  console.log('[storage-service] Referencia eliminada. Archivo en nube:', publicId);
  return Promise.resolve();
}
