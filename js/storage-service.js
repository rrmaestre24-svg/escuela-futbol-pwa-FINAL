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

// ── compressImage ─────────────────────────────────────────────
// Comprime una imagen usando Canvas antes de subirla.
// Solo afecta imágenes — PDFs y Word se suben sin cambios.
// Reduce fotos de celular de ~3MB a ~150KB sin pérdida visual notable.
function compressImage(file) {
  return new Promise((resolve) => {
    const MAX_PX = 1024;    // ancho/alto máximo en píxeles
    const QUALITY = 0.75;   // calidad JPEG (0=peor, 1=original)

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcular nuevas dimensiones manteniendo proporción
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) {
          height = Math.round((height * MAX_PX) / width);
          width = MAX_PX;
        } else {
          width = Math.round((width * MAX_PX) / height);
          height = MAX_PX;
        }
      }

      // Dibujar en canvas y exportar como JPEG comprimido
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob || file), // si falla el canvas, sube el original
        'image/jpeg',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // si no se puede leer la imagen, sube el original
    };

    img.src = objectUrl;
  });
}

// ── Mapa de extensión → mimetype (fallback para browsers móviles sin file.type) ──
const EXT_TO_TYPE = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function resolveFileType(file) {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = '.' + (file.name || '').split('.').pop().toLowerCase();
  return EXT_TO_TYPE[ext] || '';
}

// ── uploadDocument ───────────────────────────────────────────
// Sube un archivo a Firebase Storage y devuelve { url, publicId, fileType }
// Los archivos se guardan en: players/{clubId}/{playerId}/{timestamp}_{nombre}
async function uploadDocument(file, playerId) {
  // Validar tipo — usa file.type si está disponible, extensión como fallback
  const resolvedType = resolveFileType(file);
  if (!resolvedType) {
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

  // Comprimir si es imagen — PDFs y Word se suben tal cual
  const isImage = resolvedType.startsWith('image/');
  const fileToUpload = isImage ? await compressImage(file) : file;

  // Crear nombre único para el archivo: timestamp + nombre original
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `players/${clubId}/${playerId}/${timestamp}_${safeName}`;

  // Crear referencia en Storage
  const storageRef = ref(storage, path);

  // Subir el archivo (comprimido si es imagen)
  const snapshot = await uploadBytes(storageRef, fileToUpload);

  // Obtener URL pública de descarga
  const url = await getDownloadURL(snapshot.ref);

  // Determinar tipo de archivo para el ícono
  let fileType = 'imagen';
  if (resolvedType === 'application/pdf') fileType = 'pdf';
  if (resolvedType === 'application/msword' ||
      resolvedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
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
