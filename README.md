# MY CLUB - Sistema de Gestion de Escuelas de Futbol

Sistema web progresivo (PWA) para la gestion integral de escuelas de futbol infantil con sincronizacion en la nube, portal para padres y panel de super administrador.

## Descripcion General

MY CLUB es una solucion completa que permite a las escuelas de futbol gestionar jugadores, pagos, eventos, contabilidad y comunicacion con los padres de familia. El sistema funciona como aplicacion instalable en dispositivos moviles y de escritorio, con capacidad de trabajo offline.

## Arquitectura del Sistema

El proyecto consta de tres aplicaciones principales:

| Aplicacion | Descripcion | URL |
|------------|-------------|-----|
| PWA Principal | Panel de administracion para la escuela | /index.html |
| Portal de Padres | Acceso para padres de familia | /portal-padre.html |
| Super Admin | Gestion de licencias y clubes | /admin/index.html |

## Funcionalidades

### Gestion de Jugadores

- Registro completo de jugadores con informacion personal
- Documento de identidad (TI, CC, CE, RC, Pasaporte, NUIP)
- Informacion medica (tipo de sangre, alergias, condiciones)
- Foto de perfil
- Categorias desde 2006 hasta 2021
- Estados: Activo / Inactivo
- Filtros por estado y categoria
- Busqueda por nombre, categoria, telefono, documento
- Importacion masiva desde Excel/CSV
- Generacion automatica de codigos para padres

### Sistema de Pagos

- Registro de mensualidades
- Pagos extras (uniformes, torneos, etc.)
- Estados de pago: Pagado, Pendiente, Vencido
- Historial de pagos por jugador
- Notificaciones de cobro por WhatsApp
- Generacion de facturas en PDF

### Contabilidad

- Dashboard con graficos interactivos
- Ingresos por mensualidades
- Ingresos de terceros
- Registro de gastos
- Balance general
- Reportes por periodo

### Calendario de Eventos

- Entrenamientos
- Partidos
- Torneos
- Eventos especiales
- Vista mensual

### Gestion de Cumpleaños

- Lista de cumpleaños del mes
- Recordatorios automaticos
- Envio de felicitaciones por WhatsApp

### Portal de Padres

- Acceso mediante codigo unico por jugador
- Autenticacion anonima con Firebase
- Visualizacion de datos del hijo
- Edicion de informacion basica
- Subida de foto de perfil
- Historial de pagos
- Instalable como PWA

### Panel Super Admin

- Gestion de licencias por club
- Activacion/desactivacion de clubes
- Monitoreo de uso
- Estadisticas globales

### Integraciones

- WhatsApp: Envio de notificaciones, cobros y documentos
- Firebase: Sincronizacion en tiempo real
- jsPDF: Generacion de documentos PDF
- Chart.js: Graficos interactivos

## Tecnologias Utilizadas

### Frontend
- HTML5
- CSS3 con Tailwind CSS
- JavaScript ES6+
- Lucide Icons

### Backend/Servicios
- Firebase Authentication
- Firebase Firestore
- Firebase Hosting (opcional)

### Librerias
- Chart.js 4.4.0 - Graficos
- jsPDF 2.5.1 - Generacion de PDFs
- SheetJS (XLSX) 0.18.5 - Lectura de archivos Excel

### PWA
- Service Worker para cache y offline
- Web App Manifest
- Instalable en dispositivos

## Estructura del Proyecto

```
my-club/
├── index.html                    # Aplicacion principal
├── portal-padre.html             # Portal para padres
├── login.html                    # Pagina de inicio de sesion
├── offline.html                  # Pagina sin conexion
├── manifest.json                 # Configuracion PWA
├── parent-manifest.json          # Manifest del portal de padres
├── sw.js                         # Service Worker
├── vercel.json                   # Configuracion de Vercel
├── .gitignore                    # Archivos ignorados en Git
├── README.md                     # Este archivo
│
├── admin/                        # Panel Super Admin
│   ├── index.html
│   ├── admin.js
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
│
├── css/
│   └── styles.css                # Estilos personalizados
│
└── js/
    ├── firebase-config.js        # Configuracion de Firebase
    ├── firebase-sync.js          # Sincronizacion con Firestore
    ├── realtime-sync.js          # Sincronizacion en tiempo real
    ├── auth.js                   # Autenticacion
    ├── storage.js                # Gestion de localStorage
    ├── app.js                    # Aplicacion principal
    ├── players.js                # Gestion de jugadores
    ├── payments.js               # Sistema de pagos
    ├── expenses.js               # Gestion de gastos
    ├── third-party-income.js     # Ingresos de terceros
    ├── accounting.js             # Contabilidad
    ├── calendar.js               # Calendario de eventos
    ├── birthdays.js              # Gestion de cumpleaños
    ├── dashboard.js              # Panel principal
    ├── settings.js               # Configuracion del club
    ├── club-settings-protection.js # Proteccion de configuracion
    ├── license-system.js         # Sistema de licencias
    ├── notifications.js          # Sistema de notificaciones
    ├── pdf.js                    # Generacion de PDFs
    ├── whatsapp.js               # Integracion WhatsApp
    ├── theme.js                  # Tema claro/oscuro
    ├── utils.js                  # Funciones utilitarias
    ├── phone-utils.js            # Utilidades para telefonos
    ├── modals.js                 # Gestion de modales
    ├── install.js                # Instalacion PWA
    ├── cache.js                  # Gestion de cache
    ├── pwa-icons.js              # Iconos dinamicos
    ├── import-players.js         # Importacion masiva de jugadores
    ├── super-admin-sugerencias.js # Sistema de sugerencias
    └── admin-chat-sugerencias.js  # Chat de sugerencias
```

## Instalacion

### Requisitos Previos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Cuenta de Firebase (gratuita)
- Servidor web local o hosting (Vercel, Netlify, etc.)

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/TU_USUARIO/escuela-futbol-pwa.git
cd escuela-futbol-pwa
```

### Paso 2: Configurar Firebase

1. Crear proyecto en Firebase Console (https://console.firebase.google.com)
2. Habilitar Authentication con metodo Email/Password y Anonymous
3. Crear base de datos Firestore
4. Obtener credenciales de configuracion web

### Paso 3: Configurar Credenciales

Editar el archivo `js/firebase-config.js` con las credenciales de Firebase:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

### Paso 4: Configurar Reglas de Firestore

Copiar las reglas del archivo `firestore.rules` en la consola de Firebase.

### Paso 5: Desplegar

#### Opcion A: Vercel (Recomendado)

1. Conectar repositorio de GitHub con Vercel
2. Despliegue automatico en cada push

#### Opcion B: Servidor Local

```bash
# Con Python
python -m http.server 8080

# Con Node.js
npx http-server

# Con PHP
php -S localhost:8080
```

## Configuracion de Firebase

### Reglas de Seguridad de Firestore

El sistema utiliza reglas de seguridad que permiten:

- Lectura/escritura para miembros del club autenticados
- Acceso de solo lectura para padres autenticados anonimamente
- Actualizacion de campos especificos por parte de los padres

### Colecciones de Firestore

| Coleccion | Descripcion |
|-----------|-------------|
| clubs | Informacion de los clubes |
| clubs/{clubId}/players | Jugadores del club |
| clubs/{clubId}/payments | Pagos registrados |
| clubs/{clubId}/expenses | Gastos del club |
| clubs/{clubId}/events | Eventos del calendario |
| clubs/{clubId}/parentCodes | Codigos de acceso para padres |
| licenses | Licencias de los clubes |
| superAdmins | Administradores del sistema |

## Uso del Sistema

### Registro Inicial

1. Acceder a la aplicacion
2. Crear cuenta con email y contrasena
3. Configurar datos del club (nombre, logo, cuota mensual)
4. Agregar jugadores

### Importacion Masiva de Jugadores

1. Ir a la seccion Jugadores
2. Click en boton "Importar"
3. Descargar plantilla Excel
4. Completar datos de jugadores
5. Subir archivo CSV o XLSX
6. Revisar vista previa
7. Confirmar importacion
8. Descargar PDF con codigos de acceso para padres

### Generacion de Codigos para Padres

Cada jugador importado recibe automaticamente un codigo de 6 caracteres que permite a sus padres acceder al portal.

### Portal de Padres

Los padres pueden:
1. Ingresar a /portal-padre.html
2. Introducir el Club ID y su codigo de acceso
3. Ver y editar informacion de su hijo
4. Consultar historial de pagos

## Sistema de Licencias

El sistema incluye control de licencias por club:

- Estado: Activo / Inactivo
- Fecha de vencimiento
- Limite de jugadores
- Funcionalidades habilitadas

## Soporte Offline

La aplicacion funciona sin conexion a internet:

- Los datos se almacenan en localStorage
- El Service Worker cachea los recursos estaticos
- La sincronizacion se realiza automaticamente al recuperar conexion

## Personalizacion

### Tema

- Modo claro y oscuro
- Color principal configurable
- Logo personalizado del club

### Categorias

Las categorias de jugadores van desde 2006 hasta 2021 y pueden filtrarse en la vista de jugadores.

## Seguridad

- Autenticacion mediante Firebase Auth
- Reglas de seguridad en Firestore
- Tokens de sesion
- Codigos unicos para acceso de padres
- Proteccion de rutas sensibles

## Navegadores Compatibles

- Google Chrome 80+
- Mozilla Firefox 75+
- Safari 13+
- Microsoft Edge 80+
- Opera 67+

## Contribucion

1. Fork del repositorio
2. Crear rama para la funcionalidad
3. Realizar cambios
4. Crear Pull Request

## Licencia

Proyecto de codigo abierto para uso en escuelas de futbol.

## Contacto

Para soporte o sugerencias, crear un issue en el repositorio de GitHub.

---

MY CLUB - Sistema de Gestion de Escuelas de Futbol
Version 1.0