const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

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
exports.deleteAuthUser = onCall(async (request) => {
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

  // 5. Verificar que el usuario a eliminar NO es Admin Principal
  const targetDoc = await db.doc(`clubs/${clubId}/users/${uidToDelete}`).get();
  if (targetDoc.exists && targetDoc.data().isMainAdmin) {
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
