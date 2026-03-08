# MANUAL DE USUARIO
# MY CLUB — Sistema de Gestión de Escuelas de Fútbol

---

**Versión:** 1.0  
**Fecha:** Marzo 2026  
**Plataforma:** Web / PWA (Progressive Web App)  
**Compatibilidad:** Chrome, Firefox, Safari, Edge — Móvil y Escritorio

---

## ÍNDICE

1. Introducción
2. Primeros Pasos — Registro y Configuración
3. Panel Principal (Dashboard)
4. Gestión de Jugadores
5. Sistema de Pagos
6. Contabilidad
7. Calendario de Eventos
8. Cumpleaños
9. Configuración del Club
10. Portal de Padres
11. Instalación como App (PWA)
12. Funcionamiento Offline
13. Sistema de Sugerencias
14. Preguntas Frecuentes

---

## 1. INTRODUCCIÓN

**MY CLUB** es una aplicación web progresiva (PWA) diseñada para simplificar la gestión administrativa de escuelas de fútbol. Funciona desde cualquier navegador y puede instalarse en el celular o computador como una aplicación nativa.

### ¿Qué puede hacer MY CLUB?

| Módulo | Descripción |
|--------|-------------|
| 👥 Jugadores | Registro, búsqueda, edición y gestión de todos los jugadores |
| 💰 Pagos | Control de mensualidades, extras y estados de pago |
| 📊 Contabilidad | Ingresos, egresos y balance financiero del club |
| 📅 Calendario | Eventos, partidos, entrenamientos y torneos |
| 🎂 Cumpleaños | Alertas y felicitaciones automáticas |
| 👨‍👩‍👧 Portal de Padres | Acceso externo para que los padres consulten el perfil de su hijo |
| ⚙️ Configuración | Personalización completa del club |

### Tres aplicaciones en una

- **PWA Principal** (`/`) — Panel de administración para el equipo directivo
- **Portal de Padres** ([/portal-padre.html](file:///c:/Users/MARINO/PROYECTO3/escuela%20definitiva/escuela-futbol-pwa-FINAL/portal-padre.html)) — Acceso de padres y acudientes
- **Super Admin** (`/admin`) — Gestión de licencias (solo desarrollador)

---

## 2. PRIMEROS PASOS — REGISTRO Y CONFIGURACIÓN

### 2.1 Crear una cuenta

1. Ingresa a la URL de MY CLUB en tu navegador
2. En la pantalla de inicio de sesión, haz clic en la pestaña **"Registrarse"**
3. Completa:
   - **ID del Club:** Identificador único (ej: `escuela_norte`). Solo letras, números y guiones bajos. **No se puede cambiar después.**
   - **Correo electrónico:** El correo oficial de la escuela
   - **Contraseña:** Mínimo 6 caracteres
   - **Código de activación:** Proporcionado por el administrador del sistema
4. Haz clic en **"Crear Cuenta"**

> **Importante:** Guarda tu ID del Club y correo electrónico en un lugar seguro. Los necesitarás cada vez que inicies sesión.

### 2.2 Iniciar Sesión

1. En la pantalla de login ingresa tu **ID del Club** (opcional pero acelera el acceso), **correo** y **contraseña**
2. Haz clic en **"Ingresar"**
3. La sesión se mantiene activa automáticamente

### 2.3 Configuración inicial del club

Al ingresar por primera vez, ve a **Configuración** (ícono de engranaje) y completa:

- **Nombre del club** — Aparece en el encabezado y documentos generados
- **Logo** — Imagen o foto del escudo del club
- **Cuota mensual** — Valor predeterminado para nuevas mensualidades
- **Teléfono de contacto** — Número de WhatsApp del club para notificaciones
- **Colores del club** — Personalización visual (si disponible)

---

## 3. PANEL PRINCIPAL (DASHBOARD)

El Dashboard es la pantalla de inicio. Muestra un resumen rápido del estado del club.

### Secciones del Dashboard

| Tarjeta | Información que muestra |
|---------|------------------------|
| 👥 Jugadores | Total de jugadores activos registrados |
| ⚠️ Alertas | Jugadores con pagos vencidos o próximos a vencer |
| 📅 Eventos | Próximos eventos del mes |
| 💰 Estado financiero | Resumen de ingresos y pagos del mes |

### Notificaciones Recientes

La sección inferior del Dashboard muestra las alertas del día: pagos vencidos, cumpleaños próximos y eventos cercanos.

### Indicador de Sincronización

El punto verde en la esquina inferior derecha indica que la app está sincronizando en tiempo real con la nube. Si se ve amarillo, hay una actualización en progreso.

---

## 4. GESTIÓN DE JUGADORES

### 4.1 Agregar un jugador

1. Ve a la sección **"Jugadores"** desde el menú inferior
2. Haz clic en el botón **"+ Agregar Jugador"** (ícono de más)
3. Completa los datos del formulario:

**Información Personal:**
- Nombre completo
- Fecha de nacimiento (calcula la categoría automáticamente)
- Categoría (año de nacimiento: 2006 a 2021)
- Posición (Portero, Defensa, Mediocampista, Delantero)
- Dorsal (número de camiseta)
- Foto de perfil

**Documentos:**
- Tipo de documento (TI, RC, CC, CE, PA, NUIP)
- Número de documento

**Contacto:**
- Teléfono del acudiente
- Dirección

**Información Médica:**
- Tipo de sangre (A+, A-, B+, B-, AB+, AB-, O+, O-)
- Alergias conocidas
- Condiciones médicas relevantes
- Contacto de emergencia

4. Haz clic en **"Guardar"**

### 4.2 Buscar y filtrar jugadores

En la barra superior de la sección Jugadores puedes:
- **Buscar** por nombre, categoría, teléfono o número de documento
- **Filtrar** por estado: Activo / Inactivo
- **Filtrar** por categoría (año de nacimiento)

### 4.3 Editar un jugador

1. Toca o haz clic sobre la tarjeta del jugador
2. Se abre el perfil completo
3. Haz clic en el ícono de lápiz (**✏️ Editar**)
4. Modifica los datos y guarda

### 4.4 Cambiar estado del jugador

Desde el perfil del jugador puedes cambiar su estado entre **Activo** e **Inactivo**. Los jugadores inactivos no aparecen en los filtros predeterminados pero conservan todo su historial.

### 4.5 Importación masiva desde Excel

Para agregar muchos jugadores a la vez:

1. Ve a **Jugadores → "Importar Jugadores"**
2. Descarga la **plantilla Excel** provista
3. Completa los datos de cada jugador en la plantilla (una fila por jugador)
4. Guarda el archivo como `.xlsx` o `.csv`
5. Sube el archivo en la app
6. Revisa la **vista previa** de los datos antes de confirmar
7. Haz clic en **"Importar"**
8. El sistema genera automáticamente un **código de acceso de 6 caracteres** para cada jugador
9. Descarga el **PDF con los códigos** para entregar a los padres

> **Consejo:** Asegúrate de que los nombres y fechas de nacimiento estén correctos antes de importar.

### 4.6 Código de acceso para padres

Cada jugador tiene un código único de 6 caracteres (ej: `ABC123`) que le permite a su acudiente acceder al **Portal de Padres**. Para verlo o reimprimirlo:

1. Abre el perfil del jugador
2. Busca la sección **"Código de Padres"**
3. Puedes copiar el código o incluirlo en la comunicación al acudiente

---

## 5. SISTEMA DE PAGOS

### 5.1 Registrar un pago

1. Desde la sección **"Pagos"** o desde el perfil de un jugador
2. Haz clic en **"+ Nuevo Pago"**
3. Completa:
   - **Jugador:** Selecciona el jugador
   - **Tipo:** Mensualidad / Pago extra (uniforme, torneo, etc.)
   - **Concepto:** Descripción del pago (ej: "Mensualidad Marzo 2026")
   - **Monto:** Valor en pesos colombianos
   - **Fecha límite:** Fecha de vencimiento
   - **Estado:** Pagado / Pendiente
4. Guarda el pago

### 5.2 Estados de pago

| Estado | Descripción |
|--------|-------------|
| ✅ Pagado | El pago fue recibido |
| ⏳ Pendiente | Aún no se ha recibido el pago |
| 🚨 Vencido | La fecha límite pasó sin que se pagara |

### 5.3 Historial de pagos por jugador

Desde el perfil del jugador, en la parte inferior verás el historial completo de pagos con fecha, concepto, monto y estado.

### 5.4 Notificación de cobro por WhatsApp

Para enviar un recordatorio de pago directamente al acudiente:

1. Abre el pago pendiente
2. Haz clic en el ícono de WhatsApp 📱
3. Se abrirá WhatsApp con un mensaje prellenado con los datos del pago
4. Envía el mensaje

### 5.5 Generar factura en PDF

1. Abre un pago marcado como **Pagado**
2. Haz clic en **"Descargar Recibo"** o **"Generar Factura PDF"**
3. El PDF se descarga automáticamente con el logo del club, datos del jugador y del pago

---

## 6. CONTABILIDAD

La sección de Contabilidad da una visión financiera completa del club.

### 6.1 Ingresos

| Fuente | Descripción |
|--------|-------------|
| Mensualidades | Pagos de cuotas mensuales de jugadores |
| Pagos extras | Uniformes, torneos, eventos especiales |
| Ingresos de terceros | Patrocinios, rifas, otros ingresos |

### 6.2 Egresos (Gastos)

Para registrar un gasto del club:

1. Ve a **Contabilidad → "Registrar Gasto"**
2. Completa: concepto, monto, categoría y fecha
3. Guarda el egreso

### 6.3 Dashboard contable

El dashboard financiero muestra:
- **Total ingresos del mes**
- **Total egresos del mes**
- **Balance general** (ingresos - egresos)
- **Gráfico de barras** con comparativo por meses
- **Desglose por fuente** de ingresos

### 6.4 Reportes por período

Puedes filtrar todos los datos contables por período (semana, mes, rango personalizado) para generar reportes financieros.

---

## 7. CALENDARIO DE EVENTOS

### 7.1 Crear un evento

1. Ve a la sección **"Calendario"**
2. Haz clic en **"+ Nuevo Evento"** o en un día del calendario
3. Completa:
   - **Título** del evento
   - **Tipo:** Entrenamiento / Partido / Torneo / Reunión / Festivo / Otro
   - **Fecha** y hora
   - **Ubicación** (opcional)
   - **Descripción** (opcional)
4. Guarda el evento

### 7.2 Tipos de eventos y colores

| Tipo | Color |
|------|-------|
| ⚽ Entrenamiento | Verde |
| 🏆 Partido | Azul |
| 🎖️ Torneo | Amarillo/Naranja |
| 👥 Reunión | Morado |
| 🎉 Festivo | Rosa |

### 7.3 Vista del calendario

El calendario muestra todos los eventos del mes en una vista mensual. Los eventos se muestran en el día correspondiente con su color de categoría.

---

## 8. CUMPLEAÑOS

### 8.1 Lista de cumpleaños

La sección Cumpleaños muestra:
- **Hoy:** Jugadores que cumplen años hoy
- **Esta semana:** Próximos cumpleaños de los siguientes 7 días
- **Este mes:** Todos los cumpleaños del mes en curso

### 8.2 Felicitar por WhatsApp

1. En la tarjeta del jugador con cumpleaños, haz clic en el ícono de WhatsApp 📱
2. Se abrirá un mensaje de felicitación prellenado para enviar al acudiente

---

## 9. CONFIGURACIÓN DEL CLUB

### 9.1 Datos del club

- **Nombre del club**
- **Logo** (imagen PNG o JPG, recomendado cuadrado)
- **Cuota mensual base**
- **Teléfono de WhatsApp** del club

### 9.2 Gestión de usuarios

Desde la configuración puedes:
- Agregar otros administradores o directivos
- Asignar roles (Administrador, Entrenador, etc.)
- Ver la lista de usuarios con acceso al club

### 9.3 Modo claro / oscuro

En la parte superior de cualquier pantalla hay un ícono de luna/sol (🌙/☀️) para alternar entre modo claro y modo oscuro. La preferencia se guarda automáticamente.

---

## 10. PORTAL DE PADRES

El Portal de Padres es una aplicación separada donde los acudientes pueden consultar la información de su hijo sin necesidad de tener acceso administrativo.

### 10.1 Cómo ingresar al Portal de Padres

1. El acudiente debe acceder a la URL del portal: `[URL del portal]/portal-padre.html`
2. Ingresar el **Club ID** (el ID de la escuela, proporcionado por el administrador)
3. Ingresar el **Código de Acceso** de 6 caracteres del jugador (ej: `ABC123`)
4. Tocar **"Acceder al Perfil"**

> **Nota:** El Club ID y el Código de Acceso son entregados por el administrador de la escuela, generalmente en un documento impreso al momento de la matrícula.

### 10.2 Qué puede ver el padre

- ✅ Foto de perfil del jugador
- ✅ Nombre, categoría, posición y dorsal
- ✅ Estado (Activo / Inactivo)
- ✅ Resumen de pagos (total pagado y pendiente)
- ✅ **Próximo pago** con días restantes y urgencia visual
- ✅ Historial completo de pagos
- ✅ Información médica (tipo de sangre, alergias)
- ✅ Próximos eventos del club
- ✅ Botón de contacto WhatsApp con el club

### 10.3 Qué puede editar el padre

El padre puede actualizar cierta información de su hijo desde el botón **"✏️ Editar Datos del Jugador"**:

- Foto de perfil (tomada con cámara o desde galería)
- Nombre
- Fecha de nacimiento
- Dorsal
- Tipo y número de documento
- Teléfono
- Dirección
- Contacto de emergencia
- Tipo de sangre, alergias y condiciones médicas

### 10.4 Descargar carnet del jugador

1. En el portal de padres, haz scroll hasta el botón **"🪪 Descargar Carnet del Jugador"**
2. El sistema genera un PDF en formato tarjeta de crédito con:
   - **Lado frontal:** Logo del club, foto del jugador, nombre, categoría, posición, nacimiento, documento, dorsal
   - **Lado trasero:** Información médica, contacto de emergencia, teléfono del club
3. El PDF se descarga automáticamente

### 10.5 Botón de contacto con el club

Si el administrador configuró el teléfono del club, aparecerá un botón de **WhatsApp** que abre una conversación prellenada con los datos del jugador y la escuela.

### 10.6 Sesión del portal de padres

La sesión se guarda automáticamente en el dispositivo. La próxima vez que el padre abra el portal, ingresará directamente al perfil sin necesidad de volver a escribir el código.

Para **cerrar sesión**, tocar el ícono de salida (→) en la esquina superior derecha.

---

## 11. INSTALACIÓN COMO APP (PWA)

MY CLUB puede instalarse como una aplicación en el celular o computador para acceder más rápido, sin necesidad de abrir el navegador cada vez.

### Instalar en Android (Chrome)

1. Abre MY CLUB en Chrome
2. Toca el ícono de menú (⋮) en la esquina superior derecha
3. Selecciona **"Agregar a pantalla de inicio"** o **"Instalar aplicación"**
4. Confirma la instalación
5. El ícono de MY CLUB aparecerá en la pantalla de inicio

### Instalar en iPhone (Safari)

1. Abre MY CLUB en Safari
2. Toca el botón de compartir (📤) en la barra inferior
3. Selecciona **"Agregar a pantalla de inicio"**
4. Toca **"Agregar"**

### Instalar desde el banner de la app

MY CLUB muestra automáticamente una invitación de instalación en la parte inferior de la pantalla. Toca **"Instalar"** para agregarlo a tu dispositivo.

### Desinstalar

Para desinstalar, mantén presionado el ícono de MY CLUB en la pantalla de inicio y selecciona **"Desinstalar"** o **"Eliminar"**.

---

## 12. FUNCIONAMIENTO OFFLINE

MY CLUB funciona **sin conexión a internet** gracias a su tecnología PWA.

### ¿Qué funciona sin conexión?

- ✅ Ver jugadores, pagos y eventos ya cargados
- ✅ Navegar por todas las secciones
- ✅ Ver historial y reportes guardados en caché

### ¿Qué requiere conexión?

- ❌ Guardar cambios (se sincronizan automáticamente al reconectarse)
- ❌ Cargar datos nuevos de otros usuarios
- ❌ Acceder al Portal de Padres por primera vez

### Sincronización automática

Cuando la conexión se restaura, la app sincroniza automáticamente todos los cambios pendientes con la nube. El indicador verde en la esquina inferior derecha confirma que la sincronización está activa.

---

## 13. SISTEMA DE SUGERENCIAS

MY CLUB incluye un canal directo para enviar ideas, reportar errores o hacer preguntas al equipo de desarrollo.

### Cómo enviar una sugerencia

1. En la pantalla principal haz clic en el ícono de bombilla (💡) o busca el botón de sugerencias
2. Se abre el modal **"Mejoras de la App"**
3. Completa:
   - **Tu nombre**
   - **Tipo de mensaje:** Sugerencia / Error / Pregunta / Función nueva / Felicitación
   - **Tu mensaje** (mínimo 10 caracteres)
   - **Teléfono** (opcional, para que puedan contactarte)
4. Haz clic en **"Enviar al Desarrollador"**

### Ver el historial de mis sugerencias

En la pestaña **"Mis sugerencias"** del mismo modal puedes ver el estado de tus envíos anteriores y si el equipo ya te respondió.

---

## 14. PREGUNTAS FRECUENTES

**¿Puedo usar MY CLUB desde varios dispositivos?**  
Sí. Al ser una aplicación en la nube, puedes acceder desde cualquier dispositivo con tu correo y contraseña. Los datos se sincronizan automáticamente.

**¿Qué navegadores son compatibles?**  
Google Chrome 80+, Firefox 75+, Safari 13+, Microsoft Edge 80+ y Opera 67+. Se recomienda Chrome para la mejor experiencia.

**¿Cuántos jugadores puedo agregar?**  
Depende de la licencia asignada a tu club. Consulta con el administrador del sistema para conocer tu límite.

**¿Puedo recuperar mi contraseña?**  
Sí. En la pantalla de login toca **"¿Olvidaste tu contraseña?"** e ingresa tu correo para recibir el enlace de recuperación.

**¿Qué es el Club ID?**  
Es el identificador único de tu escuela (ej: `escuela_norte`). Se define al registrarse y no cambia. Es necesario tanto para el login del administrador como para que los padres accedan al Portal de Padres.

**¿Los padres pueden modificar los pagos?**  
No. Los padres solo pueden ver el historial de pagos y editar información personal del jugador (datos de contacto, foto, información médica). Los pagos solo pueden ser registrados o modificados por el administrador del club.

**¿Cómo genero el listado de códigos para entregar a los padres?**  
Al importar jugadores desde Excel, al final del proceso puedes descargar un PDF con todos los códigos de acceso listos para imprimir y entregar.

**¿Los datos son seguros?**  
Sí. MY CLUB utiliza Firebase (Google) para el almacenamiento, con autenticación segura y reglas de acceso estrictas. Solo los administradores del club y los padres con código válido pueden acceder a los datos.

**¿Qué hago si el portal de padres no carga el perfil?**  
Verifica que el Club ID y el código de acceso estén correctamente escritos (el código no distingue mayúsculas/minúsculas). Si el problema persiste, contacta al administrador de tu escuela para que verifique que el código está activo.

---

## CONTACTO Y SOPORTE

Para reportar errores, solicitar funciones nuevas o recibir soporte, utiliza el **sistema de sugerencias** integrado en la aplicación (ícono 💡).

---

*MY CLUB — Sistema de Gestión de Escuelas de Fútbol*  
*Versión 1.0 · Marzo 2026*
