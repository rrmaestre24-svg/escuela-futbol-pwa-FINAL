// ============================================================
// STORAGE SERVICE — Capa de abstracción para subir archivos
// USA Supabase Storage (bucket: players)
// ============================================================

const STORAGE_BUCKET = 'players';
const AVATARS_BUCKET = 'avatars';

// ── Tipos de archivo permitidos ──────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

// ── compressImage ─────────────────────────────────────────────
// Comprime una imagen usando Canvas antes de subirla.
// Solo afecta imágenes — PDFs y Word se suben sin cambios.
function compressImage(file) {
  return new Promise((resolve) => {
    const MAX_PX = 1024;
    const QUALITY = 0.75;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

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

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

// ── uploadDocument ───────────────────────────────────────────
// Sube un archivo a Supabase Storage y devuelve { url, publicId, fileType }
// Los archivos se guardan en: players/{clubId}/{playerId}/{timestamp}_{nombre}
async function uploadDocument(file, playerId) {
  const resolvedType = resolveFileType(file);
  if (!resolvedType) {
    throw new Error('Solo se permiten PDF, imágenes (JPG, PNG) o Word (.doc, .docx)');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo es muy grande. Máximo permitido: 10 MB');
  }

  const supaUrl  = window.SUPA_URL  || window._SUPA_URL;
  const supaAnon = window.SUPA_ANON || window._SUPA_ANON;

  if (!supaUrl || !supaAnon) {
    throw new Error('Supabase no está disponible todavía. Intenta de nuevo.');
  }

  const isImage = resolvedType.startsWith('image/');
  const fileToUpload = isImage ? await compressImage(file) : file;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const clubId = currentUser.schoolId || localStorage.getItem('clubId') || 'sin-club';

  const timestamp = Date.now();
  const safeName = (file.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${clubId}/${playerId}/${timestamp}_${safeName}`;

  const uploadRes = await fetch(
    `${supaUrl}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: supaAnon,
        Authorization: `Bearer ${supaAnon}`,
        'Content-Type': resolvedType,
        'x-upsert': 'true'
      },
      body: fileToUpload
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Error al subir el archivo. Intenta de nuevo');
  }

  const url = `${supaUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;

  let fileType = 'imagen';
  if (resolvedType === 'application/pdf') fileType = 'pdf';
  if (resolvedType === 'application/msword' ||
      resolvedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    fileType = 'word';
  }

  return { url, publicId: path, fileType };
}

// ── downloadDocument ─────────────────────────────────────────
function downloadDocument(url) {
  window.open(url, '_blank');
}

// ── deleteDocumentFromStorage ─────────────────────────────────
async function deleteDocumentFromStorage(publicId) {
  const supaUrl  = window.SUPA_URL  || window._SUPA_URL;
  const supaAnon = window.SUPA_ANON || window._SUPA_ANON;

  if (!supaUrl || !supaAnon || !publicId) {
    console.warn('[storage-service] Supabase no disponible, no se eliminó el archivo.');
    return;
  }

  try {
    await fetch(
      `${supaUrl}/storage/v1/object/${STORAGE_BUCKET}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supaAnon,
          Authorization: `Bearer ${supaAnon}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [publicId] })
      }
    );
    console.log('[storage-service] Archivo eliminado de Supabase Storage:', publicId);
  } catch (err) {
    console.warn('[storage-service] No se pudo eliminar el archivo:', err);
  }
}

// ── AVATARS STORAGE (Bucket: avatars) ─────────────────────────────
// Sube imagen al bucket avatars con estructura organizada por tipo:
//   kind='logo'   → clubs/{clubId}/logo.jpg
//   kind='admin'  → admins/{clubId}/{id}.jpg
//   kind='player' → players/{clubId}/{id}.jpg  (default, retrocompatible)
// Sin timestamp en el nombre: upsert sobrescribe el mismo archivo y evita huérfanos.
async function uploadAvatarToStorage(file, id, customClubId = null, kind = 'player') {
  const resolvedType = resolveFileType(file);
  if (!resolvedType.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes (JPG, PNG) para el avatar');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo es muy grande. Máximo permitido: 10 MB');
  }

  const supaUrl  = window.SUPA_URL  || window._SUPA_URL;
  const supaAnon = window.SUPA_ANON || window._SUPA_ANON;

  if (!supaUrl || !supaAnon) {
    throw new Error('Supabase no está disponible todavía. Intenta de nuevo.');
  }

  const fileToUpload = await compressImage(file);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const clubId = customClubId || currentUser.schoolId || localStorage.getItem('clubId') || 'sin-club';

  // Resolver carpeta según el tipo
  let path;
  if (kind === 'logo' || id === 'logo') {
    path = `clubs/${clubId}/logo.jpg`;
  } else if (kind === 'admin') {
    path = `admins/${clubId}/${id}.jpg`;
  } else {
    path = `players/${clubId}/${id}.jpg`;
  }
  // Cache-buster query (?v=timestamp) para que la app vea la nueva versión
  // sin necesidad de archivo nuevo en Storage. upsert pisa el viejo.
  const cacheBust = Date.now();

  const uploadRes = await fetch(
    `${supaUrl}/storage/v1/object/${AVATARS_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: supaAnon,
        Authorization: `Bearer ${supaAnon}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: fileToUpload
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Error al subir el avatar. Intenta de nuevo');
  }

  const url = `${supaUrl}/storage/v1/object/public/${AVATARS_BUCKET}/${path}?v=${cacheBust}`;
  return { url, publicId: path };
}

async function deleteAvatarFromStorage(urlOrPath) {
  const supaUrl  = window.SUPA_URL  || window._SUPA_URL;
  const supaAnon = window.SUPA_ANON || window._SUPA_ANON;

  // Solo intentar borrar si es una URL de Supabase y tiene un dominio valido
  if (!supaUrl || !supaAnon || !urlOrPath || typeof urlOrPath !== 'string' || !urlOrPath.includes(supaUrl)) {
    return;
  }

  try {
    const urlObj = new URL(urlOrPath);
    const pathParts = urlObj.pathname.split(`${AVATARS_BUCKET}/`);
    if (pathParts.length < 2) return;
    const publicId = pathParts[1];

    await fetch(
      `${supaUrl}/storage/v1/object/${AVATARS_BUCKET}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supaAnon,
          Authorization: `Bearer ${supaAnon}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [publicId] })
      }
    );
    console.log('[storage-service] Avatar eliminado de Supabase:', publicId);
  } catch (err) {
    console.warn('[storage-service] No se pudo eliminar avatar:', err);
  }
}

// Hacer funciones globales
window.uploadDocument = uploadDocument;
window.downloadDocument = downloadDocument;
window.deleteDocumentFromStorage = deleteDocumentFromStorage;
window.uploadAvatarToStorage = uploadAvatarToStorage;
window.deleteAvatarFromStorage = deleteAvatarFromStorage;
