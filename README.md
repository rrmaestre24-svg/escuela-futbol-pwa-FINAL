# ⚽ MY CLUB - PWA de Gestión de Escuelas de Fútbol

## 📋 Descripción

MY CLUB es una Progressive Web App (PWA) completa para la gestión de escuelas de fútbol infantil. Permite administrar jugadores, pagos, eventos, cumpleaños y contabilidad de manera integral.

## 🚀 Características Principales

✅ **Sistema de Autenticación**
- Login y registro de clubes
- Sesión persistente
- Perfiles personalizables

✅ **Gestión de Jugadores**
- CRUD completo
- Información médica
- Historial de pagos
- Estados activo/inactivo

✅ **Sistema de Pagos**
- Mensualidades y pagos extras
- Generación automática de facturas PDF
- Envío por WhatsApp
- Historial completo

✅ **Notificaciones Inteligentes**
- 10 días antes del vencimiento
- Período de gracia (30+10 días)
- Alertas de pagos vencidos

✅ **Calendario de Eventos**
- Partidos, entrenamientos, torneos
- Vista de calendario mensual
- Próximos eventos

✅ **Cumpleaños**
- Jugadores y staff
- Felicitaciones por WhatsApp
- Recordatorios automáticos

✅ **Contabilidad Completa**
- Gráficos interactivos (Chart.js)
- Reportes PDF
- Exportación CSV
- Estado por jugador

✅ **Integración WhatsApp**
- Envío de facturas
- Notificaciones
- Felicitaciones de cumpleaños

✅ **PWA Completa**
- Instalable en todos los dispositivos
- Funciona offline
- Sin barras del navegador

## 📦 Instalación

1. Descargar todos los archivos
2. Abrir `index.html` en un navegador
3. Instalar la PWA desde el menú del navegador

### Estructura de Archivos

# ⚽ MY CLUB - PWA de Gestión de Escuelas de Fútbol
## 💻 Tecnologías Utilizadas

- HTML5
- CSS3 (Tailwind CSS via CDN)
- JavaScript Vanilla (ES6+)
- Lucide Icons
- Chart.js (gráficos)
- jsPDF (generación de PDFs)
- LocalStorage (almacenamiento)
- Service Worker (offline)

## 🎨 Diseño

- **Colores:** Teal (#0d9488), Azul, Verde, Rojo, Amarillo
- **Responsive:** 100% adaptable (móvil, tablet, desktop)
- **Modo Oscuro:** Totalmente funcional
- **Animaciones:** Suaves y profesionales

## 📱 Funcionalidades PWA

- Instalable en Android, iOS, Windows, Mac
- Funciona completamente offline
- Sin barras del navegador (modo standalone)
- Ícono en pantalla de inicio
- Shortcuts a funciones principales

## 🔧 Uso

### Primer Uso

1. Registrar un club (formulario completo)
2. Subir logo del club
3. Configurar datos del administrador
4. ¡Listo para usar!

### Funciones Principales

- **Jugadores:** Agregar, editar, ver detalles
- **Pagos:** Registrar, marcar como pagado, generar PDFs
- **Calendario:** Crear eventos, ver mes a mes
- **Notificaciones:** Revisar pagos pendientes
- **Contabilidad:** Ver gráficos y reportes

## 📊 Reportes PDF

- Facturas individuales (auto-generadas)
- Notificaciones de vencimiento
- Estado de cuenta por jugador
- Reporte contable completo

## 💾 Almacenamiento

Todos los datos se guardan en LocalStorage del navegador:
- Usuarios
- Jugadores
- Pagos
- Eventos
- Configuración del club

**Importante:** Se recomienda hacer backups periódicos (Exportar Datos en Configuración)

## 🌐 Navegadores Compatibles

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ✅ Navegadores móviles

## 📞 Soporte

Para dudas o sugerencias, contactar al desarrollador.

## 📄 Licencia

Uso libre para escuelas de fútbol.

---

**Desarrollado con ⚽ para la gestión deportiva**


# ⚽ MY CLUB - PWA de Gestión de Escuelas de Fútbol

## 🚀 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/TU_USUARIO/my-club.git
cd my-club
```

2. Configura Firebase:
   - Copia `js/firebase-config.example.js` a `js/firebase-config.js`
   - Reemplaza las credenciales con las de tu proyecto Firebase

3. Abre `index.html` en Live Server o cualquier servidor local

## 🔥 Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita **Firestore Database**
3. Habilita **Authentication** (Email/Password)
4. Copia las credenciales a `firebase-config.js`

## 📋 Reglas de Firestore

Configura estas reglas en Firebase Console > Firestore Database > Reglas:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regla para usuarios - cada usuario solo puede acceder a sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subcolecciones del usuario
      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Denegar acceso a cualquier otra ruta no definida
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🛠️ Tecnologías

- HTML5 + Tailwind CSS
- JavaScript Vanilla (ES6+)
- Firebase (Firestore + Auth)
- Service Worker (PWA)
- Chart.js
- jsPDF

## 📱 Características

- ✅ PWA instalable
- ✅ Gestión de jugadores
- ✅ Sistema de pagos
- ✅ Calendario de eventos
- ✅ Sincronización multi-dispositivo
- ✅ Modo offline
- ✅ Modo oscuro