// ============================================================
// STORAGE SERVICE — Capa de abstracción para subir archivos
// USA Firebase Storage (plan Blaze)
// ============================================================

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
// Sube un archivo a Firebase Storage y devuelve { url, publicId, fileType }
// Los archivos se guardan en: players/{clubId}/{playerId}/{timestamp}_{nombre}
async function uploadDocument(file, playerId) {
  // Validar tipo
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Solo se permiten PDF, imágenes (JPG, PNG) o Word (.doc, .docx)');
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo es muy grande. Máximo permitido: 10 MB');
  }

  // Esperar a que Firebase esté listo
  if (!window.firebase?.storage) {
    throw new Error('Firebase Storage no está disponible todavía. Intenta de nuevo.');
  }

  const { storage, ref, uploadBytes, getDownloadURL } = window.firebase;

  // Obtener clubId del usuario actual
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const clubId = currentUser.schoolId || 'sin-club';

  // Crear nombre único para el archivo: timestamp + nombre original
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `players/${clubId}/${playerId}/${timestamp}_${safeName}`;

  // Crear referencia en Storage
  const storageRef = ref(storage, path);

  // Subir el archivo
  const snapshot = await uploadBytes(storageRef, file);

  // Obtener URL pública de descarga
  const url = await getDownloadURL(snapshot.ref);

  // Determinar tipo de archivo para el ícono
  let fileType = 'imagen';
  if (file.type === 'application/pdf') fileType = 'pdf';
  if (file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    fileType = 'word';
  }

  return {
    url,
    publicId: path, // En Firebase Storage el "id" es el path completo
    fileType
  };
}

// ── downloadDocument ─────────────────────────────────────────
// Abre el archivo en nueva pestaña
function downloadDocument(url) {
  window.open(url, '_blank');
}

// ── deleteDocumentFromStorage ─────────────────────────────────
// Elimina el archivo de Firebase Storage usando su path
async function deleteDocumentFromStorage(publicId) {
  if (!window.firebase?.storage) {
    console.warn('[storage-service] Firebase Storage no disponible, no se eliminó el archivo.');
    return;
  }

  const { storage, ref, deleteObject } = window.firebase;

  try {
    const storageRef = ref(storage, publicId);
    await deleteObject(storageRef);
    console.log('[storage-service] Archivo eliminado de Firebase Storage:', publicId);
  } catch (err) {
    // Si el archivo no existe (ya fue borrado), no lanzar error
    if (err.code === 'storage/object-not-found') {
      console.warn('[storage-service] Archivo no encontrado en Storage (ya fue borrado):', publicId);
    } else {
      throw err;
    }
  }
}
