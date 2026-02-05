// ========================================
// 📥 IMPORTACIÓN MASIVA DE JUGADORES
// MY CLUB - Sistema de gestión
// ========================================

console.log('📥 Sistema de importación masiva cargado');

let importedPlayersData = [];
let importStats = { total: 0, success: 0, errors: 0 };

// Mostrar/Ocultar Modal
function showImportModal() {
    document.getElementById('importPlayersModal').classList.remove('hidden');
    resetImportModal();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeImportModal() {
    document.getElementById('importPlayersModal').classList.add('hidden');
    resetImportModal();
}

function resetImportModal() {
    importedPlayersData = [];
    importStats = { total: 0, success: 0, errors: 0 };
    document.getElementById('importFile').value = '';
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('importPreviewBody').innerHTML = '';
    document.getElementById('importResults').classList.add('hidden');
    document.getElementById('importStep1').classList.remove('hidden');
    document.getElementById('importStep2').classList.add('hidden');
    document.getElementById('importStep3').classList.add('hidden');
    document.getElementById('downloadCodesBtn').classList.add('hidden');
}

// Descargar plantilla Excel
function downloadExcelTemplate() {
    const templateData = [
        ['nombre', 'fecha_nacimiento', 'categoria', 'telefono_padre', 'posicion', 'numero_camiseta', 'documento', 'tipo_documento', 'direccion', 'contacto_emergencia', 'tipo_sangre', 'alergias', 'condiciones_medicas'],
        ['Juan Pérez García', '2015-03-15', 'Categoría 2015', '3001234567', 'Delantero Centro', '10', '1234567890', 'TI', 'Calle 123 #45-67', '3009876543', 'O+', 'Ninguna', 'Ninguna'],
        ['María López Ruiz', '2016-07-22', 'Categoría 2016', '3112345678', 'Portero', '1', '0987654321', 'RC', 'Carrera 45 #12-34', '3118765432', 'A+', 'Polen', 'Asma leve'],
        ['Carlos Rodríguez', '2014-11-08', 'Categoría 2014', '3203456789', 'Medio Centro', '8', '', '', '', '', '', '', '']
    ];
    
    const csvContent = templateData.map(row => 
        row.map(cell => {
            if (String(cell).includes(',') || String(cell).includes('"')) {
                return '"' + String(cell).replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',')
    ).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_jugadores_myclub.csv';
    link.click();
    
    showToast('📥 Plantilla descargada. Ábrela con Excel.');
}

// Manejar subida de archivo
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
        processCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        processExcel(file);
    } else {
        showToast('❌ Formato no soportado. Usa CSV o Excel');
        return;
    }
}

// Procesar CSV
function processCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const rows = parseCSV(text);
            
            if (rows.length < 2) {
                showToast('❌ El archivo está vacío');
                return;
            }
            
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const data = rows.slice(1).filter(row => row.some(cell => cell.trim()));
            
            importedPlayersData = data.map(row => mapRowToPlayer(headers, row));
            showImportPreview();
        } catch (error) {
            console.error('Error procesando CSV:', error);
            showToast('❌ Error al procesar el archivo');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

// Procesar Excel
function processExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            if (rows.length < 2) {
                showToast('❌ El archivo está vacío');
                return;
            }
            
            const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
            const dataRows = rows.slice(1).filter(row => row && row.some(cell => cell));
            
            importedPlayersData = dataRows.map(row => mapRowToPlayer(headers, row));
            showImportPreview();
        } catch (error) {
            console.error('Error procesando Excel:', error);
            showToast('❌ Error al procesar el archivo');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Parsear CSV
function parseCSV(text) {
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
                rows.push(currentRow);
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
        rows.push(currentRow);
    }
    
    return rows;
}

// Mapear fila a objeto jugador
function mapRowToPlayer(headers, row) {
    const player = {
        name: '', birthDate: '', category: '', phone: '', position: '',
        jerseyNumber: '', documentNumber: '', documentType: '', address: '',
        emergencyContact: '', medicalInfo: { bloodType: '', allergies: '', conditions: '' },
        isValid: true, errors: []
    };
    
    headers.forEach((header, index) => {
        const value = String(row[index] || '').trim();
        
        switch(header) {
            case 'nombre': case 'name': player.name = value; break;
            case 'fecha_nacimiento': case 'birthdate': case 'nacimiento': 
                player.birthDate = formatImportDate(value); break;
            case 'categoria': case 'category': player.category = value; break;
            case 'telefono': case 'telefono_padre': case 'phone': case 'celular': 
                player.phone = value; break;
            case 'posicion': case 'position': player.position = value; break;
            case 'numero_camiseta': case 'numero': case 'dorsal': 
                player.jerseyNumber = value; break;
            case 'documento': case 'numero_documento': player.documentNumber = value; break;
            case 'tipo_documento': player.documentType = value; break;
            case 'direccion': case 'address': player.address = value; break;
            case 'contacto_emergencia': case 'emergencia': player.emergencyContact = value; break;
            case 'tipo_sangre': case 'sangre': player.medicalInfo.bloodType = value; break;
            case 'alergias': player.medicalInfo.allergies = value; break;
            case 'condiciones_medicas': case 'condiciones': player.medicalInfo.conditions = value; break;
        }
    });
    
    if (!player.name) { player.isValid = false; player.errors.push('Nombre requerido'); }
    if (!player.category) { player.isValid = false; player.errors.push('Categoría requerida'); }
    
    return player;
}

// Formatear fecha para input
function formatImportDate(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    
    const match = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    }
    
    if (!isNaN(dateStr) && dateStr > 0) {
        const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
    }
    
    return dateStr;
}

// Mostrar vista previa
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
            <td class="p-2"><input type="checkbox" id="importCheck_${index}" ${player.isValid ? 'checked' : ''} class="import-checkbox rounded" onchange="updateImportCount()"></td>
            <td class="p-2 font-medium text-gray-800 dark:text-white">${player.name || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${player.birthDate || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${player.category || '-'}</td>
            <td class="p-2 text-gray-600 dark:text-gray-400">${player.phone || '-'}</td>
            <td class="p-2">${player.isValid ? '<span class="text-green-600">✓</span>' : '<span class="text-red-600" title="'+player.errors.join(', ')+'">❌</span>'}</td>
        `;
        tbody.appendChild(row);
    });
    
    updateImportCount();
}

function toggleAllImport(checkbox) {
    document.querySelectorAll('.import-checkbox').forEach(cb => cb.checked = checkbox.checked);
    updateImportCount();
}

function updateImportCount() {
    const count = document.querySelectorAll('.import-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = count;
}

// Iniciar importación
async function startImport() {
    const checkboxes = document.querySelectorAll('.import-checkbox:checked');
    const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.id.split('_')[1]));
    
    if (selectedIndexes.length === 0) {
        showToast('❌ Selecciona al menos un jugador');
        return;
    }
    
    const playersToImport = selectedIndexes.map(i => importedPlayersData[i]).filter(p => p.isValid);
    
    if (playersToImport.length === 0) {
        showToast('❌ No hay jugadores válidos seleccionados');
        return;
    }
    
    document.getElementById('importStep2').classList.add('hidden');
    document.getElementById('importStep3').classList.remove('hidden');
    
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    importStats = { total: playersToImport.length, success: 0, errors: 0 };
    const createdPlayers = [];
    
    for (let i = 0; i < playersToImport.length; i++) {
        const player = playersToImport[i];
        const progress = Math.round(((i + 1) / playersToImport.length) * 100);
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Procesando ${i + 1} de ${playersToImport.length}...`;
        
        try {
            const result = await createPlayerWithCode(player);
            if (result.success) {
                importStats.success++;
                createdPlayers.push({ name: player.name, category: player.category, phone: player.phone, code: result.code });
            } else {
                importStats.errors++;
            }
        } catch (error) {
            console.error('Error creando jugador:', error);
            importStats.errors++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    progressText.textContent = '¡Completado!';
    progressBar.style.width = '100%';
    
    document.getElementById('importResults').classList.remove('hidden');
    document.getElementById('resultSuccess').textContent = importStats.success;
    document.getElementById('resultErrors').textContent = importStats.errors;
    
    if (importStats.errors === 0) {
        document.getElementById('resultErrorsContainer').classList.add('hidden');
    }
    
    window.lastImportedPlayers = createdPlayers;
    
    if (importStats.success > 0) {
        document.getElementById('downloadCodesBtn').classList.remove('hidden');
    }
    
    if (typeof renderPlayersList === 'function') renderPlayersList();
    if (typeof updateDashboard === 'function') updateDashboard();
    
    showToast(`✅ ${importStats.success} jugadores importados`);
}

// Crear jugador con código de padre
async function createPlayerWithCode(playerData) {
    try {
        const playerId = generateId();
        
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
            medicalInfo: playerData.medicalInfo || {},
            status: 'Activo',
            avatar: '',
            enrollmentDate: getCurrentDate()
        };
        
        // Guardar localmente
        savePlayer(newPlayer);
        
        // Generar código de padre
        const parentCode = generateParentCode();
        
        // Guardar código en Firebase si está disponible
        const clubId = localStorage.getItem('clubId');
        if (window.APP_STATE?.firebaseReady && window.firebase?.db && clubId) {
            try {
                await window.firebase.setDoc(
                    window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId),
                    newPlayer
                );
                
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
            } catch (fbError) {
                console.error('Error Firebase:', fbError);
            }
        }
        
        return { success: true, playerId, code: parentCode };
        
    } catch (error) {
        console.error('Error creando jugador:', error);
        return { success: false, error: error.message };
    }
}

function generateParentCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Descargar PDF con códigos
async function downloadCodesPDF() {
    const players = window.lastImportedPlayers;
    if (!players || players.length === 0) {
        showToast('❌ No hay códigos para descargar');
        return;
    }
    
    showToast('📄 Generando PDF...');
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const settings = getSchoolSettings();
        const clubName = settings.name || 'Escuela de Fútbol';
        const clubId = localStorage.getItem('clubId') || '';
        const portalUrl = window.location.origin + '/portal-padre.html';
        
        doc.setFontSize(18);
        doc.setTextColor(13, 148, 136);
        doc.text(clubName, 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        doc.text('Códigos de Acceso - Portal de Padres', 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')}`, 105, 38, { align: 'center' });
        
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
            if (y > 260) {
                doc.addPage();
                y = 20;
            }
            
            doc.setDrawColor(13, 148, 136);
            doc.setLineWidth(0.5);
            doc.roundedRect(15, y, 180, 30, 3, 3, 'S');
            
            doc.setFontSize(11);
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${player.name}`, 20, y + 10);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`Categoría: ${player.category}`, 20, y + 17);
            if (player.phone) doc.text(`Tel: ${player.phone}`, 20, y + 24);
            
            doc.setFillColor(13, 148, 136);
            doc.roundedRect(140, y + 5, 50, 20, 2, 2, 'F');
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(player.code, 165, y + 18, { align: 'center' });
            
            y += 35;
        });
        
        doc.save(`codigos_padres_${clubId}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('✅ PDF descargado');
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        showToast('❌ Error al generar PDF');
    }
}

// Compartir por WhatsApp
function shareByWhatsApp() {
    const players = window.lastImportedPlayers;
    if (!players || players.length === 0) {
        showToast('❌ No hay códigos para compartir');
        return;
    }
    
    const clubId = localStorage.getItem('clubId') || '';
    const portalUrl = window.location.origin + '/portal-padre.html';
    
    let message = `🏫 *Códigos Portal de Padres*\n\n📱 Ingresa a: ${portalUrl}\n🔐 Club ID: ${clubId}\n\n👥 *Códigos:*\n`;
    players.forEach(p => { message += `\n• ${p.name}: *${p.code}*`; });
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

console.log('✅ Sistema de importación masiva listo');