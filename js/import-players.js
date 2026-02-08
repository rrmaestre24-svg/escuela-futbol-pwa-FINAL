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
    const templateData = [
        ['nombre', 'fecha_nacimiento', 'categoria', 'telefono_padre', 'posicion', 'numero_camiseta', 'documento', 'tipo_documento', 'direccion', 'contacto_emergencia', 'tipo_sangre', 'alergias', 'condiciones_medicas'],
        ['AQUI VA EL NOMBRE LO DEMAS DATOS SON EJEMPLOS DE COMO LLENARLOS , DEBEN ELIMINARLOS PARA PONER LOS REALES ', '2015-03-15', 'Categoría 2015', '3001234567', 'Delantero Centro', '10', '1234567890', 'TI', 'Calle 123 #45-67', '3009876543', 'O+', 'Ninguna', 'Ninguna']
    ];
    if (format === 'excel') {
        downloadAsExcel(templateData);
    } else {
        downloadAsCSV(templateData);
    }
}

// Descargar como Excel (.xlsx)
function downloadAsExcel(data) {
    if (typeof XLSX === 'undefined') {
        if (typeof showToast === 'function') {
            showToast('⚠️ Librería Excel no disponible. Descargando CSV...');
        }
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
    if (typeof XLSX === 'undefined') {
        if (typeof showToast === 'function') {
            showToast('❌ Librería Excel no disponible. Usa archivo CSV.');
        }
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

// Mapear fila a objeto jugador
function mapRowToPlayer(headers, row) {
    const player = {
        name: '',
        birthDate: '',
        category: '',
        phone: '',
        position: '',
        jerseyNumber: '',
        documentNumber: '',
        documentType: '',
        address: '',
        emergencyContact: '',
        medicalInfo: { bloodType: '', allergies: '', conditions: '' },
        isValid: true,
        errors: []
    };
    
    headers.forEach((header, index) => {
        const value = String(row[index] || '').trim();
        
        switch(header) {
            case 'nombre':
            case 'name':
            case 'nombre_completo':
                player.name = value;
                break;
            case 'fecha_nacimiento':
            case 'birthdate':
            case 'birth_date':
            case 'nacimiento':
            case 'fecha':
                player.birthDate = formatImportDate(value);
                break;
            case 'categoria':
            case 'category':
                player.category = value;
                break;
            case 'telefono':
            case 'telefono_padre':
            case 'phone':
            case 'celular':
            case 'tel':
                player.phone = value;
                break;
            case 'posicion':
            case 'position':
                player.position = value;
                break;
            case 'numero_camiseta':
            case 'numero':
            case 'dorsal':
            case 'jersey':
                player.jerseyNumber = value;
                break;
            case 'documento':
            case 'numero_documento':
            case 'doc':
                player.documentNumber = value;
                break;
            case 'tipo_documento':
            case 'tipo_doc':
                player.documentType = value;
                break;
            case 'direccion':
            case 'address':
            case 'dir':
                player.address = value;
                break;
            case 'contacto_emergencia':
            case 'emergencia':
            case 'emergency':
                player.emergencyContact = value;
                break;
            case 'tipo_sangre':
            case 'sangre':
            case 'blood':
                player.medicalInfo.bloodType = value;
                break;
            case 'alergias':
            case 'allergies':
                player.medicalInfo.allergies = value;
                break;
            case 'condiciones_medicas':
            case 'condiciones':
            case 'conditions':
                player.medicalInfo.conditions = value;
                break;
        }
    });
    
    // Validaciones
    if (!player.name) {
        player.isValid = false;
        player.errors.push('Nombre requerido');
    }
    if (!player.category) {
        player.isValid = false;
        player.errors.push('Categoría requerida');
    }
    if (!player.phone) {
        player.isValid = false;
        player.errors.push('Teléfono requerido');
    }
    
    return player;
}

// Formatear fecha para input
function formatImportDate(dateStr) {
    if (!dateStr) return '';
    
    const str = String(dateStr).trim();
    
    // Ya está en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    // Formato DD/MM/YYYY o DD-MM-YYYY
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    }
    
    // Número de Excel (días desde 1899-12-30)
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0 && num < 100000) {
        const excelDate = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
            return excelDate.toISOString().split('T')[0];
        }
    }
    
    return str;
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
            phone: playerData.phone || '',
            address: playerData.address || '',
            emergencyContact: playerData.emergencyContact || '',
            documentType: playerData.documentType || '',
            documentNumber: playerData.documentNumber || '',
            medicalInfo: {
                bloodType: playerData.medicalInfo?.bloodType || '',
                allergies: playerData.medicalInfo?.allergies || '',
                medications: '',
                conditions: playerData.medicalInfo?.conditions || ''
            },
            status: 'Activo',
            avatar: '',
            enrollmentDate: getImportCurrentDate(),
            email: ''
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
    
    if (typeof showToast === 'function') showToast('📄 Generando PDF...');
    
    try {
        // Verificar jsPDF
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            if (typeof showToast === 'function') showToast('❌ Librería PDF no disponible');
            return;
        }
        
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
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
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