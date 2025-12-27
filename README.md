# ⚽ MY CLUB - PWA de Gestión de Escuelas de Fútbol

Progressive Web App completa para la gestión integral de escuelas de fútbol infantil con sincronización en la nube.

## 🚀 Características

- ✅ **PWA Instalable** - Funciona como app nativa en móviles y desktop
- ✅ **Gestión de Jugadores** - CRUD completo con información médica
- ✅ **Sistema de Pagos** - Mensualidades, extras, notificaciones automáticas
- ✅ **Calendario de Eventos** - Partidos, entrenamientos, torneos
- ✅ **Cumpleaños** - Recordatorios automáticos
- ✅ **Contabilidad** - Gráficos interactivos y reportes
- ✅ **PDFs Automáticos** - Facturas, notificaciones, reportes
- ✅ **Integración WhatsApp** - Envío de documentos y notificaciones
- ✅ **Multi-Usuario** - Hasta 6 usuarios por escuela
- ✅ **Sincronización Cloud** - Firebase Firestore
- ✅ **Modo Offline** - Funciona sin conexión
- ✅ **Modo Oscuro** - Interfaz adaptable
- ✅ **Personalización** - Colores y logo del club

## 📋 Requisitos Previos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Servidor local (Live Server, XAMPP, etc.)
- Cuenta de Firebase (gratis)

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/my-club.git
cd my-club
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita **Firestore Database**
4. Habilita **Authentication** → Email/Password
5. Ve a **Configuración del proyecto** → **Tus apps** → **Web**
6. Copia las credenciales

### 3. Configurar credenciales

1. Copia el archivo de ejemplo:
```bash
   cp js/firebase-config.example.js js/firebase-config.js
```

2. Abre `js/firebase-config.js` y reemplaza con tus credenciales:
```javascript
   const firebaseConfig = {
     apiKey: "TU_API_KEY",
     authDomain: "TU_AUTH_DOMAIN",
     projectId: "TU_PROJECT_ID",
     storageBucket: "TU_STORAGE_BUCKET",
     messagingSenderId: "TU_SENDER_ID",
     appId: "TU_APP_ID",
     measurementId: "TU_MEASUREMENT_ID"
   };
```

### 4. Configurar reglas de Firestore

En Firebase Console → Firestore Database → Reglas, pega:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Colecciones por escuela
    match /{collection}/{document} {
      allow read, write: if request.resource.data.schoolId == request.auth.uid;
    }
    
    // Configuración de escuelas
    match /schools/{schoolId} {
      allow read, write: if request.auth != null;
    }
    
    // Usuarios
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Ejecutar la aplicación
```bash
# Con Live Server (VS Code)
# Click derecho en index.html → "Open with Live Server"

# O con Python
python -m http.server 5500

# O con Node.js
npx http-server
```

Abre en el navegador: `http://localhost:5500`

## 📱 Instalación como PWA

### Android / Chrome:
1. Abre la app en Chrome
2. Menú (⋮) → "Instalar aplicación"
3. ¡Listo!

### iOS / Safari:
1. Abre la app en Safari
2. Botón compartir (↑)
3. "Agregar a pantalla de inicio"

### Desktop:
1. Icono de instalación en la barra de direcciones
2. Click → "Instalar"

## 🎯 Uso

### Primer Uso

1. **Registrar tu club**:
   - Completa el formulario de registro
   - Sube el logo del club
   - Configura la cuota mensual

2. **Agregar jugadores**:
   - Ve a la sección "Jugadores"
   - Click en "Agregar"
   - Completa la información

3. **Sincronizar con Firebase**:
   - Ve a "Configuración"
   - Click en "Subir a Firebase"
   - Tus datos estarán en la nube

### Multi-Dispositivo

1. En el **primer dispositivo**: Sube datos a Firebase
2. En **otros dispositivos**: 
   - Inicia sesión con el mismo usuario
   - Click en "Descargar de Firebase"
   - ¡Todos tus datos estarán sincronizados!

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3 (Tailwind), JavaScript ES6+
- **Backend**: Firebase (Firestore + Auth)
- **PWA**: Service Worker, Web Manifest
- **Gráficos**: Chart.js
- **PDFs**: jsPDF
- **Iconos**: Lucide Icons

## 📂 Estructura del Proyecto
```
my-club/
├── index.html                      # Página principal
├── manifest.json                   # Configuración PWA
├── sw.js                          # Service Worker
├── offline.html                    # Página sin conexión
├── .gitignore                     # Archivos ignorados
├── README.md                      # Este archivo
├── css/
│   └── styles.css                 # Estilos personalizados
└── js/
    ├── firebase-config.example.js # Plantilla de configuración
    ├── firebase-config.js         # ⚠️ TUS CREDENCIALES (no se sube)
    ├── firebase-sync.js           # Sincronización
    ├── app.js                     # Aplicación principal
    ├── auth.js                    # Autenticación
    ├── storage.js                 # LocalStorage
    ├── players.js                 # Gestión de jugadores
    ├── payments.js                # Sistema de pagos
    ├── calendar.js                # Calendario
    ├── birthdays.js               # Cumpleaños
    ├── accounting.js              # Contabilidad
    ├── notifications.js           # Notificaciones
    ├── dashboard.js               # Dashboard
    ├── settings.js                # Configuración
    ├── pdf.js                     # Generación PDFs
    ├── whatsapp.js                # Integración WhatsApp
    ├── theme.js                   # Personalización
    ├── utils.js                   # Utilidades
    ├── install.js                 # Instalación PWA
    ├── cache.js                   # Gestión de caché
    └── pwa-icons.js              # Iconos dinámicos
```

## 🔒 Seguridad

- Las credenciales de Firebase están protegidas por `.gitignore`
- Cada usuario debe configurar sus propias credenciales
- Los datos están protegidos por reglas de Firestore
- Autenticación por email/contraseña

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto para escuelas de fútbol.

## 👨‍💻 Autor

Desarrollado con ⚽ para la gestión deportiva

## 📞 Soporte

Para dudas o sugerencias, abre un issue en GitHub.

---

**¡Gracias por usar MY CLUB!** ⚽🎉
```

---

## 📋 **PASO 10: Verificar estructura de archivos**

### **Tu estructura DEBE verse así:**
```
my-club/
├── .gitignore                          ✅ NUEVO
├── README.md                           ✅ NUEVO
├── index.html                          ✅ Ya existe
├── manifest.json                       ✅ Ya existe
├── sw.js                              ✅ Ya existe
├── offline.html                        ✅ Ya existe
├── .vscode/
│   └── settings.json                  ✅ Ya existe
├── css/
│   └── styles.css                     ✅ Ya existe
└── js/
    ├── firebase-config.example.js      ✅ NUEVO
    ├── firebase-config.js              ✅ CON TUS CREDENCIALES (NO se sube)
    ├── firebase-sync.js                ✅ NUEVO o verificar
    ├── accounting.js                   ✅ Ya existe
    ├── app.js                          ✅ MODIFICADO (async initApp)
    ├── auth.js                         ✅ Ya existe
    ├── birthdays.js                    ✅ Ya existe
    ├── cache.js                        ✅ Ya existe
    ├── calendar.js                     ✅ Ya existe
    ├── dashboard.js                    ✅ Ya existe
    ├── install.js                      ✅ Ya existe
    ├── notifications.js                ✅ Ya existe
    ├── payments.js                     ✅ Ya existe
    ├── pdf.js                          ✅ Ya existe
    ├── players.js                      ✅ Ya existe
    ├── pwa-icons.js                    ✅ Ya existe
    ├── settings.js                     ✅ Ya existe
    ├── storage.js                      ✅ Ya existe
    ├── theme.js                        ✅ Ya existe
    ├── utils.js                        ✅ Ya existe
    └── whatsapp.js                     ✅ Ya existe