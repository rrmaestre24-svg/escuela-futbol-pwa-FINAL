const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

/**
 * updateMonthlySummary — actualiza el resumen contable mensual.
 *
 * Se dispara automáticamente cada vez que se crea, modifica o elimina
 * un pago en clubs/{clubId}/payments/{paymentId}.
 *
 * Escribe en clubs/{clubId}/monthly_summary/{año-mes} los totales:
 *   - totalIncome: suma de pagos con status "Pagado"
 *   - pendingCount: cantidad de pagos pendientes
 *   - updatedAt: timestamp de la última actualización
 *
 * El cliente lee este documento (1 lectura) en vez de iterar todos los pagos.
 * Si el documento no existe todavía, el cliente usa el cálculo local como fallback.
 */
exports.updateMonthlySummary = onDocumentWritten(
  'clubs/{clubId}/payments/{paymentId}',
  async (event) => {
    const { clubId } = event.params;
    const db = getFirestore();

    // Determinar el mes afectado a partir del documento nuevo o el anterior
    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();
    const payment = newData || oldData;

    if (!payment) return;

    // Usar dueDate para determinar el mes (formato YYYY-MM-DD)
    const dateStr = payment.dueDate || payment.paidDate || payment.createdAt;
    if (!dateStr) return;

    const yearMonth = String(dateStr).substring(0, 7); // "2025-03"

    // Leer todos los pagos de ese mes desde Firestore
    const snapshot = await db
      .collection(`clubs/${clubId}/payments`)
      .where('dueDate', '>=', `${yearMonth}-01`)
      .where('dueDate', '<=', `${yearMonth}-31`)
      .get();

    let totalIncome = 0;
    let pendingCount = 0;

    snapshot.forEach(doc => {
      const p = doc.data();
      if (p.status === 'Pagado') {
        totalIncome += Number(p.amount) || 0;
      } else if (p.status === 'Pendiente') {
        pendingCount++;
      }
    });

    // Escribir el resumen del mes
    await db.doc(`clubs/${clubId}/monthly_summary/${yearMonth}`).set({
      totalIncome,
      pendingCount,
      paymentCount: snapshot.size,
      updatedAt: new Date().toISOString()
    });

    console.log(`[updateMonthlySummary] ${clubId} / ${yearMonth}: income=${totalIncome} pending=${pendingCount}`);
  }
);
