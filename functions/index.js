const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

// ⚡ Opciones de costo mínimo para todas las funciones:
//   - minInstances: 0  → escala a CERO cuando no hay tráfico (sin costo en reposo)
//   - memory: 256MiB   → memoria mínima suficiente para estas operaciones
//   - timeoutSeconds: 30 → corta rápido si algo falla
//   - maxInstances: 5   → evita bursts de costo inesperados
const COST_MIN_OPTIONS = {
  minInstances: 0,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 5,
  region: 'us-central1',
};

/**
 * deleteAuthUser — elimina una cuenta de Firebase Authentication.
 *
 * Solo puede llamarla el Admin Principal del club (isMainAdmin: true).
 * El cliente envía: { uidToDelete, clubId }
 *
 * Seguridad:
 *   1. El llamador debe estar autenticado.
 *   2. El llamador debe ser isMainAdmin del club indicado.
 *   3. No se puede eliminar al propio Admin Principal.
 */
exports.deleteAuthUser = onCall(COST_MIN_OPTIONS, async (request) => {
  // 1. Verificar que el llamador está autenticado
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado para realizar esta acción.');
  }

  const callerUid = request.auth.uid;
  const { uidToDelete, clubId } = request.data;

  // 2. Validar parámetros
  if (!uidToDelete || !clubId) {
    throw new HttpsError('invalid-argument', 'Faltan parámetros: uidToDelete y clubId son requeridos.');
  }

  // 3. No permitir que alguien se elimine a sí mismo por esta vía
  if (callerUid === uidToDelete) {
    throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta.');
  }

  const db = getFirestore();

  // 4. Verificar que el llamador es Admin Principal del club
  const callerDoc = await db.doc(`clubs/${clubId}/users/${callerUid}`).get();
  if (!callerDoc.exists || !callerDoc.data().isMainAdmin) {
    throw new HttpsError('permission-denied', 'Solo el administrador principal puede eliminar usuarios.');
  }

  // 5. Verificar que el usuario a eliminar pertenece a este club
  const targetDoc = await db.doc(`clubs/${clubId}/users/${uidToDelete}`).get();
  if (!targetDoc.exists) {
    throw new HttpsError('permission-denied', 'El usuario no pertenece a este club.');
  }
  if (targetDoc.data().isMainAdmin) {
    throw new HttpsError('failed-precondition', 'No se puede eliminar al administrador principal.');
  }

  // 6. Eliminar la cuenta de Firebase Authentication
  try {
    await getAuth().deleteUser(uidToDelete);
    console.log(`[deleteAuthUser] Cuenta eliminada: ${uidToDelete} por ${callerUid} en club ${clubId}`);
    return { success: true };
  } catch (error) {
    // Si el usuario ya no existe en Auth (fue eliminado manualmente antes), no es error crítico
    if (error.code === 'auth/user-not-found') {
      console.log(`[deleteAuthUser] Usuario ${uidToDelete} no existía en Auth — ignorado`);
      return { success: true };
    }
    console.error('[deleteAuthUser] Error al eliminar:', error);
    throw new HttpsError('internal', 'No se pudo eliminar la cuenta. Intenta nuevamente.');
  }
});

/**
 * createParentSession — valida un código de acceso de padres y registra la sesión.
 *
 * El cliente envía: { clubId, accessCode, uid }
 * La Function valida en servidor que el código es válido para ese club,
 * obtiene el playerId asociado, y escribe authorized_sessions via Admin SDK.
 * De esta forma, el cliente nunca puede auto-asignarse un playerId arbitrario.
 */
exports.createParentSession = onCall(COST_MIN_OPTIONS, async (request) => {
  // 1. Debe estar autenticado (anónimamente al menos)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado para continuar.');
  }

  const uid = request.auth.uid;
  const { clubId, accessCode } = request.data;

  // 2. Validar parámetros
  if (!clubId || !accessCode) {
    throw new HttpsError('invalid-argument', 'clubId y accessCode son requeridos.');
  }

  const db = getFirestore();

  // 3. Buscar el código en parentCodes (misma query que hacía el cliente)
  const codesSnap = await db
    .collection(`clubs/${clubId}/parentCodes`)
    .where('code', '==', accessCode)
    .limit(1)
    .get();

  if (codesSnap.empty) {
    throw new HttpsError('not-found', 'Código de acceso no válido.');
  }

  const codeData = codesSnap.docs[0].data();
  const playerId = codeData.playerId;

  if (!playerId) {
    throw new HttpsError('failed-precondition', 'El código no tiene un jugador asociado.');
  }

  // 4. Verificar que el jugador existe y está activo
  const playerSnap = await db.doc(`clubs/${clubId}/players/${playerId}`).get();
  if (!playerSnap.exists) {
    throw new HttpsError('not-found', 'Jugador no encontrado.');
  }

  const playerData = playerSnap.data();
  const status = (playerData.status || 'activo').toLowerCase();
  if (status === 'inactivo' || status === 'inactive') {
    // Respetar la ventana de gracia de 30 min idéntica a la lógica del portal
    const now = Date.now();
    const revokeAt = playerData.portalAccessRevokesAt
      ? new Date(playerData.portalAccessRevokesAt).getTime()
      : NaN;
    const inactivatedAt = playerData.lastInactivatedAt
      ? new Date(playerData.lastInactivatedAt).getTime()
      : NaN;

    let mustBlock = true;
    if (!isNaN(revokeAt)) {
      mustBlock = now >= revokeAt;
    } else if (!isNaN(inactivatedAt)) {
      mustBlock = (now - inactivatedAt) >= (30 * 60 * 1000);
    }

    if (mustBlock) {
      throw new HttpsError('permission-denied', 'El acceso de este jugador ha sido desactivado por el club.');
    }
  }

  // 5. Escribir sesión via Admin SDK (bypassa reglas Firestore — confianza total en servidor)
  await db.doc(`clubs/${clubId}/authorized_sessions/${uid}`).set({
    role: 'parent',
    playerId,
    createdAt: new Date().toISOString(),
    createdBy: 'server'
  });

  console.log(`[createParentSession] Sesión registrada: uid=${uid} playerId=${playerId} club=${clubId}`);
  return { success: true, playerId };
});

