// ========================================
// 📥 IMPORTACIÓN MASIVA DE JUGADORES
// MY CLUB - Integrado con sistema existente
// ========================================

console.log('📥 Cargando sistema de importación masiva...');

// Variables del módulo
let importedPlayersData = [];
let importStats = { total: 0, success: 0, errors: 0 };

// ========================================
// FUNCIONES DE UTILIDAD (si no existen)
// ========================================

// Generar ID único (usa la existente o crea una)
function generateImportId() {
    if (typeof generateId === 'function') {
        return generateId();
    }
    return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Obtener fecha actual (usa la existente o crea una)
function getImportCurrentDate() {
    if (typeof getCurrentDate === 'function') {
        return getCurrentDate();
    }
    return new Date().toISOString().split('T')[0];
}

// Generar código de acceso para padres (6 caracteres)
function generateImportParentCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ========================================
// MODAL: MOSTRAR / OCULTAR
// ========================================

function showImportModal() {
    const modal = document.getElementById('importPlayersModal');
    if (modal) {
        modal.classList.remove('hidden');
        resetImportModal();
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

function closeImportModal() {
    const modal = document.getElementById('importPlayersModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    resetImportModal();
}

function resetImportModal() {
    importedPlayersData = [];
    importStats = { total: 0, success: 0, errors: 0 };
    
    const importFile = document.getElementById('importFile');
    if (importFile) importFile.value = '';
    
    const importPreview = document.getElementById('importPreview');
    if (importPreview) importPreview.classList.add('hidden');
    
    const importPreviewBody = document.getElementById('importPreviewBody');
    if (importPreviewBody) importPreviewBody.innerHTML = '';
    
    const importResults = document.getElementById('importResults');
    if (importResults) importResults.classList.add('hidden');
    
    const importStep1 = document.getElementById('importStep1');
    if (importStep1) importStep1.classList.remove('hidden');
    
    const importStep2 = document.getElementById('importStep2');
    if (importStep2) importStep2.classList.add('hidden');
    
    const importStep3 = document.getElementById('importStep3');
    if (importStep3) importStep3.classList.add('hidden');
    
    const downloadCodesBtn = document.getElementById('downloadCodesBtn');
    if (downloadCodesBtn) downloadCodesBtn.classList.add('hidden');
}

// ========================================
// DESCARGAR PLANTILLA
// ========================================

function downloadTemplate(format) {
    // 📋 ENCABEZADOS CON TODOS LOS CAMPOS ACTUALES
    const headers = [
        '🔴 nombre',
        '🔴 fecha_nacimiento',
        '🔴 categoria',
        'posicion',
        'numero_camiseta',
        'talla_uniforme',
        'tipo_documento',
        'numero_documento',
        'email',
        '🔴 telefono_padre',
        'telefono_madre',
        'direccion',
        'telefono_emergencia',
        'tipo_sangre',
        'eps',
        'sisben',
        'alergias',
        'medicamentos',
        'condiciones_medicas'
    ];
    
    // 📝 EJEMPLO DE LLENADO CON TODOS LOS DATOS Y MÚLTIPLES FORMATOS DE FECHA
    const examples = [
        // Ejemplo 1: Fecha en formato YYYY-MM-DD (ISO)
        ['Juan Pérez García', '2015-03-15', 'Categoría 2015', 'Delantero Centro', '10', 'M', 'CC', '1234567890', 'padre@email.com', '3001234567', '3009876543', 'Calle 123 #45-67', '3201234567', 'O+', 'Sura', 'A1', 'Ninguna', 'Ninguno', 'Ninguna'],
        // Ejemplo 2: Fecha en formato DD/MM/YYYY (español)
        ['María López Torres', '15/03/2015', 'Categoría 2015', 'Delantera', '7', 'M', 'TI', '9876543210', 'madre@email.com', '3109876543', '3109999999', 'Carrera 45 #12-34', '3201111111', 'A+', 'Famisanar', 'A2', 'Ninguna', 'Ninguno', 'Ninguna'],
        // Ejemplo 3: Fecha en formato DD-MM-YYYY (con guiones)
        ['Carlos Rodríguez Díaz', '20-05-2014', 'Categoría 2014', 'Lateral', '3', 'S', 'CC', '5555555555', 'carlos@email.com', '3214567890', '3214444444', 'Avenida 99 #88-77', '3202222222', 'B-', 'Ascendis', 'B', 'Penicilina', 'Asma inhaler', 'Ninguna'],
        // Ejemplo 4: Fecha alternativa DD/MM/YYYY
        ['Laura Martínez Silva', '10/11/2016', 'Categoría 2016', 'Portera', '1', 'XS', 'RC', '7777777777', 'laura@email.com', '3001111111', '', 'Pasaje 5 #10-20', '', 'AB+', 'EPS Sanitas', 'C', 'Ninguna', 'Ninguno', 'Asma']
    ];
    
    // 📌 DESCRIPCIÓN DE CAMPOS (segunda hoja para referencia)
    const descripciones = [
        ['CAMPO', 'DESCRIPCIÓN', 'FORMATOS ACEPTADOS', 'OBLIGATORIO'],
        ['nombre', 'Nombre completo del jugador', 'Texto (ej: Juan Pérez García)', 'SÍ'],
        ['fecha_nacimiento', 'Fecha de nacimiento del jugador', 'YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "15 de marzo de 2015"', 'SÍ'],
        ['categoria', 'Categoría o año de nacimiento', 'Texto (ej: Categoría 2015, Sub-12)', 'SÍ'],
        ['posicion', 'Posición en la cancha', 'Delantero, Lateral, Portero, Mediocampista, Defensa', 'NO'],
        ['numero_camiseta', 'Número de camiseta', '1-99', 'NO'],
        ['talla_uniforme', 'Talla del uniforme', '4, 6, 8, 10, 12, 14, XS, S, M, L, XL, XXL', 'NO'],
        ['tipo_documento', 'Tipo de documento de identidad', 'TI, RC, CC, CE, PA, NUIP', 'NO'],
        ['numero_documento', 'Número de documento sin espacios', '10 dígitos aprox', 'NO'],
        ['email', 'Correo electrónico del acudiente', 'formato@email.com', 'NO'],
        ['telefono_padre', 'Teléfono del acudiente principal', '10 dígitos (3001234567)', 'SÍ'],
        ['telefono_madre', 'Teléfono del segundo acudiente', '10 dígitos', 'NO'],
        ['direccion', 'Dirección residencial', 'Texto completo', 'NO'],
        ['telefono_emergencia', 'Teléfono de emergencia', '10 dígitos', 'NO'],
        ['tipo_sangre', 'Tipo de sangre', 'A+, A-, B+, B-, AB+, AB-, O+, O-', 'NO'],
        ['eps', 'Empresa Promotora de Salud', 'Sura, Famisanar, Ascendis, etc', 'NO'],
        ['sisben', 'Clasificación SISBEN', 'A1, A2, B, C', 'NO'],
        ['alergias', 'Alergias conocidas', 'Texto (ej: Penicilina, Maní, Ninguna)', 'NO'],
        ['medicamentos', 'Medicamentos habituales', 'Texto (ej: Asma inhaler, Ninguno)', 'NO'],
        ['condiciones_medicas', 'Condiciones médicas importantes', 'Texto (ej: Asma, Diabetes, Ninguna)', 'NO']
    ];
    
    // Crear datos para Excel
    const allExamples = [headers, ...examples];
    
    if (format === 'excel') {
        downloadAsExcelMejorado(allExamples, descripciones);
    } else {
        downloadAsCSV(allExamples);
    }
}

// Carga XLSX dinámicamente si no está disponible
function loadXLSX(callback) {
    if (typeof XLSX !== 'undefined') { callback(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = callback;
    s.onerror = () => showToast('❌ No se pudo cargar la librería Excel');
    document.head.appendChild(s);
}

// 🆕 Descargar como Excel (.xlsx) - MEJORADO CON 2 HOJAS
function downloadAsExcelMejorado(dataJugadores, dataDescripciones) {
    loadXLSX(function() { _downloadAsExcelMejorado(dataJugadores, dataDescripciones); });
}
function _downloadAsExcelMejorado(dataJugadores, dataDescripciones) {
    if (typeof XLSX === 'undefined') {
        downloadAsCSV(dataJugadores);
        return;
    }
    
    try {
        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        
        // ========== HOJA 1: DATOS DE JUGADORES ==========
        const ws1 = XLSX.utils.aoa_to_sheet(dataJugadores);
        
        // Ajustar ancho de columnas
        const colWidths = dataJugadores[0].map((col, i) => {
            const maxLen = Math.max(...dataJugadores.map(row => String(row[i] || '').length));
            return { wch: Math.max(maxLen + 2, 14) };
        });
        ws1['!cols'] = colWidths;
        
        // Formatear encabezado (primera fila en azul)
        ws1['A1'].s = {
            fill: { fgColor: { rgb: '4472C4' } },
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
        };
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws1, 'Jugadores');
        
        // ========== HOJA 2: INSTRUCCIONES Y REFERENCIAS ==========
        const ws2 = XLSX.utils.aoa_to_sheet([
            ['📋 INSTRUCCIONES PARA COMPLETAR EL FORMULARIO'],
            [''],
            ['1️⃣ CAMPOS OBLIGATORIOS (🔴 DEBEN SER LLENADOS):'],
            ['   • nombre - Nombre completo del jugador'],
            ['   • fecha_nacimiento - Se acepta en MÚLTIPLES FORMATOS (ver abajo)'],
            ['   • categoria - Categoría del jugador (ejemplo: Categoría 2015, Sub-12)'],
            ['   • telefono_padre - Teléfono del acudiente (10 dígitos sin espacios)'],
            [''],
            ['2️⃣ CAMPOS OPCIONALES (pueden dejarse en blanco):'],
            ['   • posicion, numero_camiseta, talla_uniforme'],
            ['   • tipo_documento, numero_documento, email'],
            ['   • telefono_madre, direccion, telefono_emergencia'],
            ['   • tipo_sangre, eps, sisben, alergias, medicamentos, condiciones_medicas'],
            [''],
            ['3️⃣ FORMATOS DE FECHA ACEPTADOS (fecha_nacimiento) - ¡ELIGE EL QUE PREFIERAS!'],
            ['   ✅ YYYY-MM-DD  →  2015-03-15'],
            ['   ✅ DD/MM/YYYY  →  15/03/2015 (formato español común)'],
            ['   ✅ DD-MM-YYYY  →  15-03-2015 (con guiones)'],
            ['   ✅ Texto       →  "15 de marzo de 2015" o "15 de Mar 2015"'],
            ['   ✅ Números de Excel  →  Se convierten automáticamente'],
            ['   📌 RECOMENDACIÓN: Usa DD/MM/YYYY si trabajas con Excel en español'],
            [''],
            ['4️⃣ FORMATO DE DATOS ESPERADO (OTROS CAMPOS):'],
            ['   • Nombres: Texto completo (Ej: Juan Pérez García)'],
            ['   • Teléfonos: 10 dígitos SIN espacios ni guiones (Ej: 3001234567)'],
            ['   • Tipo de sangre: A+, A-, B+, B-, AB+, AB-, O+, O-'],
            ['   • Email: formato válido (Ej: usuario@email.com)'],
            [''],
            ['5️⃣ DOCUMENTO DE IDENTIDAD (CÓDIGOS VÁLIDOS):'],
            ['   • TI = Tarjeta de Identidad'],
            ['   • RC = Registro Civil'],
            ['   • CC = Cédula de Ciudadanía'],
            ['   • CE = Cédula de Extranjería'],
            ['   • PA = Pasaporte'],
            ['   • NUIP = Número Único de Identificación Personal'],
            [''],
            ['6️⃣ RECOMENDACIONES IMPORTANTES:'],
            ['   • No modifiques los nombres de las columnas (encabezados)'],
            ['   • Completa al menos los campos obligatorios (🔴)'],
            ['   • Verifica que TODOS los datos sean correctos antes de subir'],
            ['   • Usa la hoja "Descripción de Campos" para referencia detallada'],
            ['   • Si una fecha no se reconoce, intenta con otro formato'],
            [''],
            ['7️⃣ EJEMPLOS DE MÚLTIPLES FORMATOS DE FECHA:'],
            ['   Los siguientes valores son IGUALES - el sistema los convierte igual:'],
            ['   • 2015-03-15  ↔  15/03/2015  ↔  15-03-2015  ↔  15 de marzo de 2015'],
            [''],
            ['⚠️ SI ALGO NO ESTÁ CLARO, CONSULTA LA HOJA "Descripción de Campos"']
        ]);
        
        ws2['!cols'] = [{ wch: 80 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones');
        
        // ========== HOJA 3: DESCRIPCIÓN DETALLADA DE CAMPOS ==========
        const ws3 = XLSX.utils.aoa_to_sheet(dataDescripciones);
        
        const colWidths3 = [
            { wch: 20 },  // CAMPO
            { wch: 50 },  // DESCRIPCIÓN
            { wch: 30 },  // EJEMPLO
            { wch: 15 }   // OBLIGATORIO
        ];
        ws3['!cols'] = colWidths3;
        
        XLSX.utils.book_append_sheet(wb, ws3, 'Descripción de Campos');
        
        // Descargar
        XLSX.writeFile(wb, 'plantilla_jugadores_completa_myclub.xlsx');
        
        if (typeof showToast === 'function') {
            showToast('✅ Plantilla Excel descargada (3 hojas: Jugadores, Instrucciones, Descripción)');
        }
    } catch (error) {
        console.error('Error generando Excel mejorado:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Error al generar Excel. Descargando CSV...');
        }
        downloadAsCSV(dataJugadores);
    }
}

// Versión anterior (compatibilidad)
function downloadAsExcel(data) {
    loadXLSX(function() { _downloadAsExcel(data); });
}
function _downloadAsExcel(data) {
    if (typeof XLSX === 'undefined') {
        downloadAsCSV(data);
        return;
    }
    
    try {
        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Ajustar ancho de columnas
        const colWidths = data[0].map((col, i) => {
            const maxLen = Math.max(...data.map(row => String(row[i] || '').length));
            return { wch: Math.max(maxLen + 2, 12) };
        });
        ws['!cols'] = colWidths;
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
        
        // Descargar
        XLSX.writeFile(wb, 'plantilla_jugadores_myclub.xlsx');
        
        if (typeof showToast === 'function') {
            showToast('📥 Plantilla Excel descargada');
        }
    } catch (error) {
        console.error('Error generando Excel:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Error al generar Excel. Descargando CSV...');
        }
        downloadAsCSV(data);
    }
}

// Descargar como CSV
function downloadAsCSV(data) {
    const csvContent = data.map(row => 
        row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        }).join(',')
    ).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_jugadores_myclub.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (typeof showToast === 'function') {
        showToast('📥 Plantilla CSV descargada');
    }
}

// Mantener compatibilidad con función anterior
function downloadExcelTemplate() {
    downloadTemplate('csv');
}

// ========================================
// PROCESAR ARCHIVO SUBIDO
// ========================================

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
        processCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        processExcel(file);
    } else {
        if (typeof showToast === 'function') {
            showToast('❌ Formato no soportado. Usa CSV o Excel (.xlsx)');
        }
    }
}

// Procesar CSV
function processCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const rows = parseImportCSV(text);
            
            if (rows.length < 2) {
                if (typeof showToast === 'function') showToast('❌ El archivo está vacío');
                return;
            }
            
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const data = rows.slice(1).filter(row => row.some(cell => cell && cell.trim()));
            
            importedPlayersData = data.map(row => mapRowToPlayer(headers, row));
            showImportPreview();
        } catch (error) {
            console.error('Error procesando CSV:', error);
            if (typeof showToast === 'function') showToast('❌ Error al procesar el archivo');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

// Procesar Excel (requiere librería XLSX)
function processExcel(file) {
    loadXLSX(function() { _processExcel(file); });
}
function _processExcel(file) {
    if (typeof XLSX === 'undefined') {
        showToast('❌ Librería Excel no disponible. Usa archivo CSV.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            if (rows.length < 2) {
                if (typeof showToast === 'function') showToast('❌ El archivo está vacío');
                return;
            }
            
            const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
            const dataRows = rows.slice(1).filter(row => row && row.some(cell => cell));
            
            importedPlayersData = dataRows.map(row => mapRowToPlayer(headers, row));
            showImportPreview();
        } catch (error) {
            console.error('Error procesando Excel:', error);
            if (typeof showToast === 'function') showToast('❌ Error al procesar el archivo');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Parsear CSV manualmente
function parseImportCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentCell += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentCell.trim());
                if (currentRow.some(cell => cell)) rows.push(currentRow);
                currentRow = [];
                currentCell = '';
                if (char === '\r') i++;
            } else if (char !== '\r') {
                currentCell += char;
            }
        }
    }
    
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell)) rows.push(currentRow);
    }
    
    return rows;
}

// Mapear fila a objeto jugador - MEJORADO CON TODOS LOS CAMPOS
function mapRowToPlayer(headers, row) {
    const player = {
        name: '',
        birthDate: '',
        category: '',
        phone: '',
        phoneParent2: '',
        emergencyContact: '',
        email: '',
        position: '',
        jerseyNumber: '',
        uniformSize: '',
        documentNumber: '',
        documentType: '',
        address: '',
        medicalInfo: { 
            bloodType: '', 
            allergies: '', 
            medications: '', 
            conditions: '', 
            eps: '', 
            sisben: '' 
        },
        isValid: true,
        errors: []
    };
    
    headers.forEach((header, index) => {
        const value = String(row[index] || '').trim();
        
        // Normalizar el nombre de la columna
        const normalizedHeader = header.toLowerCase().replace(/[^\w]/g, '');
        
        // NOMBRE
        if (['nombre', 'name', 'nombrecompleto'].includes(normalizedHeader)) {
            player.name = value;
        }
        // FECHA NACIMIENTO
        else if (['fechanacimiento', 'birthdate', 'birthdate', 'nacimiento', 'fecha'].includes(normalizedHeader)) {
            player.birthDate = formatImportDate(value);
        }
        // CATEGORÍA
        else if (['categoria', 'category', 'categoriaaño'].includes(normalizedHeader)) {
            player.category = value;
        }
        // TELÉFONO PADRE (PRINCIPAL)
        else if (['telefonopadre', 'phone', 'celular', 'tel'].includes(normalizedHeader)) {
            player.phone = normalizePhoneImport(value);
        }
        // TELÉFONO MADRE (SEGUNDO CONTACTO)
        else if (['telefonmadre', 'telefonomother', 'contactoemergencia', 'emergencia'].includes(normalizedHeader)) {
            player.phoneParent2 = normalizePhoneImport(value);
        }
        // TELÉFONO EMERGENCIA
        else if (['telefonoemergencia', 'emergencyphone', 'emergency'].includes(normalizedHeader)) {
            player.emergencyContact = normalizePhoneImport(value);
        }
        // EMAIL
        else if (['email', 'correo', 'mail'].includes(normalizedHeader)) {
            player.email = value;
        }
        // POSICIÓN
        else if (['posicion', 'position', 'puesto'].includes(normalizedHeader)) {
            player.position = value;
        }
        // NÚMERO CAMISETA
        else if (['numerocamiseta', 'numero', 'dorsal', 'jersey'].includes(normalizedHeader)) {
            player.jerseyNumber = value;
        }
        // TALLA UNIFORME
        else if (['tallauniforme', 'talla', 'uniformsize', 'size'].includes(normalizedHeader)) {
            player.uniformSize = value;
        }
        // NÚMERO DOCUMENTO
        else if (['numerodocumento', 'documento', 'doc', 'identification'].includes(normalizedHeader)) {
            player.documentNumber = value;
        }
        // TIPO DOCUMENTO
        else if (['tipodocumento', 'tipodoc', 'doctype'].includes(normalizedHeader)) {
            player.documentType = value;
        }
        // DIRECCIÓN
        else if (['direccion', 'address', 'dir', 'domicilio'].includes(normalizedHeader)) {
            player.address = value;
        }
        // TIPO SANGRE
        else if (['tiposangre', 'sangre', 'blood', 'bloodtype'].includes(normalizedHeader)) {
            player.medicalInfo.bloodType = value;
        }
        // EPS
        else if (normalizedHeader === 'eps') {
            player.medicalInfo.eps = value;
        }
        // SISBEN
        else if (['sisben', 'seguro'].includes(normalizedHeader)) {
            player.medicalInfo.sisben = value;
        }
        // ALERGIAS
        else if (['alergias', 'allergies', 'alergica'].includes(normalizedHeader)) {
            player.medicalInfo.allergies = value;
        }
        // MEDICAMENTOS
        else if (['medicamentos', 'medications', 'meds'].includes(normalizedHeader)) {
            player.medicalInfo.medications = value;
        }
        // CONDICIONES MÉDICAS
        else if (['condicionesmedicas', 'condiciones', 'conditions', 'medicalconditions'].includes(normalizedHeader)) {
            player.medicalInfo.conditions = value;
        }
    });
    
    // ✅ VALIDACIONES MEJORADAS
    
    // Campo obligatorio: NOMBRE
    if (!player.name || player.name.length < 3) {
        player.isValid = false;
        player.errors.push('❌ Nombre completo requerido (mínimo 3 caracteres)');
    }
    
    // Campo obligatorio: FECHA NACIMIENTO
    if (!player.birthDate) {
        player.isValid = false;
        player.errors.push('❌ Fecha de nacimiento requerida (YYYY-MM-DD)');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate)) {
        player.isValid = false;
        player.errors.push('❌ Fecha de nacimiento en formato incorrecto (debe ser YYYY-MM-DD)');
    }
    
    // Campo obligatorio: CATEGORÍA
    if (!player.category || player.category.length < 2) {
        player.isValid = false;
        player.errors.push('❌ Categoría requerida (ej: Categoría 2015, Sub-12)');
    }
    
    // Campo obligatorio: TELÉFONO PADRE
    if (!player.phone) {
        player.isValid = false;
        player.errors.push('❌ Teléfono padre requerido (10 dígitos)');
    } else if (player.phone.length !== 10 || !/^\d{10}$/.test(player.phone)) {
        player.isValid = false;
        player.errors.push(`❌ Teléfono padre inválido: "${player.phone}" (debe ser 10 dígitos sin espacios)`);
    }
    
    // Validaciones opcionales pero recomendadas
    if (player.email && !isValidEmail(player.email)) {
        player.errors.push(`⚠️ Email con formato incorrecto: "${player.email}"`);
    }
    
    if (player.phoneParent2 && player.phoneParent2.length !== 10) {
        player.errors.push(`⚠️ Teléfono madre debe tener 10 dígitos: "${player.phoneParent2}"`);
    }
    
    if (player.emergencyContact && player.emergencyContact.length !== 10) {
        player.errors.push(`⚠️ Teléfono emergencia debe tener 10 dígitos: "${player.emergencyContact}"`);
    }
    
    // Validar tipo de sangre si está presente
    const tiposSangreValidos = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (player.medicalInfo.bloodType && !tiposSangreValidos.includes(player.medicalInfo.bloodType.toUpperCase())) {
        player.errors.push(`⚠️ Tipo de sangre no válido: "${player.medicalInfo.bloodType}"`);
    }
    
    return player;
}

// Normalizar teléfono (remover espacios, guiones, etc)
function normalizePhoneImport(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10);
}

// Validar email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Formatear fecha para input - MEJORADO PARA EXCEL
function formatImportDate(dateStr) {
    if (!dateStr) return '';
    
    const str = String(dateStr).trim();
    
    // 1️⃣ Si ya está en formato YYYY-MM-DD, devolverlo tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // 2️⃣ Formato DD/MM/YYYY (muy común en Excel español)
    const match1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match1) {
        const day = match1[1].padStart(2, '0');
        const month = match1[2].padStart(2, '0');
        const year = match1[3];
        return `${year}-${month}-${day}`;
    }
    
    // 3️⃣ Formato YYYY/MM/DD o YYYY-MM-DD (con guiones)
    const match2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match2) {
        const year = match2[1];
        const month = match2[2].padStart(2, '0');
        const day = match2[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 4️⃣ Número de Excel (días desde 1899-12-30)
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0 && num < 100000) {
        try {
            // Fórmula de Excel: número de días desde 1899-12-30
            const excelDate = new Date((num - 25569) * 86400 * 1000);
            if (!isNaN(excelDate.getTime())) {
                const year = excelDate.getFullYear();
                const month = String(excelDate.getMonth() + 1).padStart(2, '0');
                const day = String(excelDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch (e) {
            console.error('Error parsing Excel date:', e);
        }
    }
    
    // 5️⃣ Formato de texto: "15 de marzo de 2015", "15 de Mar 2015", etc.
    const months = {
        enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
        julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08', october: '10', december: '12'
    };
    
    const monthMatch = str.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
    if (monthMatch) {
        const day = monthMatch[1].padStart(2, '0');
        const monthName = monthMatch[2].toLowerCase();
        const year = monthMatch[3];
        const month = months[monthName];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }
    
    // 6️⃣ Formato "2015/03/15" o "2015-03-15" (ISO alternativo)
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    
    console.warn('⚠️ No se pudo convertir la fecha:', str);
    return '';
}

// ========================================
// VISTA PREVIA
// ========================================

function showImportPreview() {
    const validPlayers = importedPlayersData.filter(p => p.isValid);
    const invalidPlayers = importedPlayersData.filter(p => !p.isValid);
    
    document.getElementById('importStep1').classList.add('hidden');
    document.getElementById('importStep2').classList.remove('hidden');
    document.getElementById('importPreview').classList.remove('hidden');
    
    document.getElementById('previewTotal').textContent = importedPlayersData.length;
    document.getElementById('previewValid').textContent = validPlayers.length;
    document.getElementById('previewInvalid').textContent = invalidPlayers.length;
    
    const tbody = document.getElementById('importPreviewBody');
    tbody.innerHTML = '';
    
    importedPlayersData.forEach((player, index) => {
        const row = document.createElement('tr');
        row.className = player.isValid 
            ? 'border-b border-gray-200 dark:border-gray-700' 
            : 'border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20';
        
        row.innerHTML = `
            <td class="p-2">
                <input type="checkbox" id="importCheck_${index}" ${player.isValid ? 'checked' : ''} class="import-checkbox rounded" onchange="updateImportCount()">
            </td>
            <td class="p-2 font-medium text-gray-800 dark:text-white">${escapeHtml(player.name) || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${player.birthDate || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${escapeHtml(player.category) || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${player.phone || '-'}</td>
            <td class="p-2">
                ${player.isValid 
                    ? '<span class="text-green-600">✓</span>' 
                    : '<span class="text-red-600 cursor-help" title="' + escapeHtml(player.errors.join(', ')) + '">❌</span>'
                }
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateImportCount();
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleAllImport(checkbox) {
    document.querySelectorAll('.import-checkbox').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateImportCount();
}

function updateImportCount() {
    const count = document.querySelectorAll('.import-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = count;
}

// ========================================
// IMPORTAR JUGADORES
// ========================================

async function startImport() {
    const checkboxes = document.querySelectorAll('.import-checkbox:checked');
    const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.id.split('_')[1]));
    
    if (selectedIndexes.length === 0) {
        if (typeof showToast === 'function') showToast('❌ Selecciona al menos un jugador');
        return;
    }
    
    const playersToImport = selectedIndexes.map(i => importedPlayersData[i]).filter(p => p && p.isValid);
    
    if (playersToImport.length === 0) {
        if (typeof showToast === 'function') showToast('❌ No hay jugadores válidos seleccionados');
        return;
    }
    
    // Cambiar a paso 3
    document.getElementById('importStep2').classList.add('hidden');
    document.getElementById('importStep3').classList.remove('hidden');
    
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    importStats = { total: playersToImport.length, success: 0, errors: 0 };
    const createdPlayers = [];
    
    for (let i = 0; i < playersToImport.length; i++) {
        const playerData = playersToImport[i];
        const progress = Math.round(((i + 1) / playersToImport.length) * 100);
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Procesando ${i + 1} de ${playersToImport.length}...`;
        
        try {
            const result = await createImportedPlayer(playerData);
            if (result.success) {
                importStats.success++;
                createdPlayers.push({
                    name: playerData.name,
                    category: playerData.category,
                    phone: playerData.phone,
                    code: result.code
                });
            } else {
                importStats.errors++;
                console.error('Error importando:', playerData.name, result.error);
            }
        } catch (error) {
            console.error('Error creando jugador:', error);
            importStats.errors++;
        }
        
        // Pequeña pausa para no saturar
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Mostrar resultados
    progressText.textContent = '¡Completado!';
    progressBar.style.width = '100%';
    
    document.getElementById('importResults').classList.remove('hidden');
    document.getElementById('resultSuccess').textContent = importStats.success;
    document.getElementById('resultErrors').textContent = importStats.errors;
    
    const errorsContainer = document.getElementById('resultErrorsContainer');
    if (errorsContainer) {
        errorsContainer.style.display = importStats.errors > 0 ? 'block' : 'none';
    }
    
    // Guardar para PDF
    window.lastImportedPlayers = createdPlayers;
    
    if (importStats.success > 0) {
        document.getElementById('downloadCodesBtn').classList.remove('hidden');
    }
    
    // Actualizar lista de jugadores
    if (typeof renderPlayersList === 'function') {
        renderPlayersList();
    }
    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }
    
    if (typeof showToast === 'function') {
        showToast(`✅ ${importStats.success} jugadores importados`);
    }
}

// Crear jugador individual con código de padre
async function createImportedPlayer(playerData) {
    try {
        const playerId = generateImportId();
        const parentCode = generateImportParentCode();
        
        // Construir objeto jugador (compatible con el sistema existente)
        const newPlayer = {
            id: playerId,
            name: playerData.name,
            birthDate: playerData.birthDate || '',
            category: playerData.category,
            position: playerData.position || '',
            jerseyNumber: playerData.jerseyNumber || '',
            uniformSize: playerData.uniformSize || '',
            phone: playerData.phone || '',
            email: playerData.email || '',
            address: playerData.address || '',
            emergencyContact: playerData.emergencyContact || '',
            documentType: playerData.documentType || '',
            documentNumber: playerData.documentNumber || '',
            medicalInfo: {
                bloodType: playerData.medicalInfo?.bloodType || '',
                allergies: playerData.medicalInfo?.allergies || '',
                medications: playerData.medicalInfo?.medications || '',
                conditions: playerData.medicalInfo?.conditions || '',
                eps: playerData.medicalInfo?.eps || '',
                sisben: playerData.medicalInfo?.sisben || ''
            },
            status: 'Activo',
            avatar: '',
            enrollmentDate: getImportCurrentDate()
        };
        
        // Guardar jugador usando función existente
        if (typeof savePlayer === 'function') {
            savePlayer(newPlayer);
        } else {
            // Fallback: guardar directo en localStorage
            const players = JSON.parse(localStorage.getItem('players') || '[]');
            players.push(newPlayer);
            localStorage.setItem('players', JSON.stringify(players));
        }
        
        // Guardar código de padre en Firebase si está disponible
        const clubId = localStorage.getItem('clubId');
        if (window.APP_STATE?.firebaseReady && window.firebase?.db && clubId) {
            try {
                // Guardar jugador en Firebase
                if (window.firebase.setDoc && window.firebase.doc) {
                    await window.firebase.setDoc(
                        window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId),
                        newPlayer
                    );
                }
                
                // Guardar código de padre
                if (window.firebase.addDoc && window.firebase.collection) {
                    await window.firebase.addDoc(
                        window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`),
                        {
                            code: parentCode,
                            playerId: playerId,
                            playerName: playerData.name,
                            phone: playerData.phone || '',
                            createdAt: new Date().toISOString(),
                            used: false
                        }
                    );
                }
                
                console.log(`✅ Jugador ${playerData.name} sincronizado con Firebase`);
            } catch (fbError) {
                console.warn('⚠️ Error sincronizando con Firebase:', fbError);
                // Continuar aunque falle Firebase - el jugador ya está en localStorage
            }
        }
        
        return { success: true, playerId, code: parentCode };
        
    } catch (error) {
        console.error('Error en createImportedPlayer:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// DESCARGAR PDF CON CÓDIGOS
// ========================================

async function downloadCodesPDF() {
    const players = window.lastImportedPlayers;
    if (!players || players.length === 0) {
        if (typeof showToast === 'function') showToast('❌ No hay códigos para descargar');
        return;
    }

    // Cargar jsPDF dinámicamente si no está disponible
    if (typeof window.jspdf === 'undefined') {
        if (typeof showToast === 'function') showToast('📄 Cargando librería PDF...');
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        }).catch(() => { showToast('❌ No se pudo cargar la librería PDF'); return; });
    }

    if (typeof showToast === 'function') showToast('📄 Generando PDF...');

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Obtener datos del club
        let clubName = 'Escuela de Fútbol';
        let clubId = localStorage.getItem('clubId') || '';
        
        if (typeof getSchoolSettings === 'function') {
            const settings = getSchoolSettings();
            clubName = settings.name || clubName;
            clubId = clubId || settings.clubId || '';
        }
        
        const portalUrl = window.location.origin + '/portal-padre.html';
        
        // Título
        doc.setFontSize(18);
        doc.setTextColor(13, 148, 136);
        doc.text(clubName, 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        doc.text('Códigos de Acceso - Portal de Padres', 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')}`, 105, 38, { align: 'center' });
        
        // Instrucciones
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(15, 45, 180, 25, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setTextColor(13, 148, 136);
        doc.text('INSTRUCCIONES PARA PADRES:', 20, 53);
        doc.setTextColor(60, 60, 60);
        doc.text(`1. Ingresa a: ${portalUrl}`, 20, 60);
        doc.text(`2. Club ID: ${clubId}`, 20, 66);
        
        let y = 85;
        
        players.forEach((player, index) => {
            // Nueva página si es necesario
            if (y > 260) {
                doc.addPage();
                y = 20;
            }
            
            // Recuadro del jugador
            doc.setDrawColor(13, 148, 136);
            doc.setLineWidth(0.5);
            doc.roundedRect(15, y, 180, 30, 3, 3, 'S');
            
            // Información
            doc.setFontSize(11);
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${player.name}`, 20, y + 10);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`Categoría: ${player.category}`, 20, y + 17);
            if (player.phone) {
                doc.text(`Tel: ${player.phone}`, 20, y + 24);
            }
            
            // Código grande
            doc.setFillColor(13, 148, 136);
            doc.roundedRect(140, y + 5, 50, 20, 2, 2, 'F');
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(player.code, 165, y + 18, { align: 'center' });
            
            y += 35;
        });
        
        // Descargar
        const fileName = `codigos_padres_${clubId || 'myclub'}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        if (typeof showToast === 'function') showToast('✅ PDF descargado correctamente');
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        if (typeof showToast === 'function') showToast('❌ Error al generar PDF');
    }
}

// ========================================
// COMPARTIR POR WHATSAPP
// ========================================

function shareByWhatsApp() {
    const players = window.lastImportedPlayers;
    if (!players || players.length === 0) {
        if (typeof showToast === 'function') showToast('❌ No hay códigos para compartir');
        return;
    }
    
    let clubName = 'Escuela de Fútbol';
    let clubId = localStorage.getItem('clubId') || '';
    
    if (typeof getSchoolSettings === 'function') {
        const settings = getSchoolSettings();
        clubName = settings.name || clubName;
        clubId = clubId || settings.clubId || '';
    }
    
    const portalUrl = window.location.origin + '/portal-padre.html';
    
    let message = `🏫 *${clubName}*\n`;
    message += `📱 *Códigos Portal de Padres*\n\n`;
    message += `🔗 Link: ${portalUrl}\n`;
    message += `🔐 Club ID: ${clubId}\n\n`;
    message += `👥 *Códigos por jugador:*\n`;
    
    players.forEach(p => {
        message += `\n• ${p.name}: *${p.code}*`;
    });
    
    message += `\n\n💡 _Cada padre debe usar su código para acceder al perfil de su hijo._`;
    
    const encodedMessage = encodeURIComponent(message).replace(/%20/g, '+');
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// ========================================
// EXPORTAR FUNCIONES GLOBALMENTE
// ========================================

window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.resetImportModal = resetImportModal;
window.downloadExcelTemplate = downloadExcelTemplate;
window.handleFileUpload = handleFileUpload;
window.toggleAllImport = toggleAllImport;
window.updateImportCount = updateImportCount;
window.startImport = startImport;
window.downloadCodesPDF = downloadCodesPDF;
window.shareByWhatsApp = shareByWhatsApp;

console.log('✅ Sistema de importación masiva listo');