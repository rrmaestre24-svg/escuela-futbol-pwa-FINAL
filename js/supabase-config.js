window.MODO_SUPABASE = true;
window.SUPA_URL  = 'https://lcyebvfvolepcqzsqxfk.supabase.co';
window.SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeWVidmZ2b2xlcGNxenNxeGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTA1OTUsImV4cCI6MjA5NDk4NjU5NX0.ZVd4uIYqv8TPIbezOqe8PmA6ZK9yLJ2tybLYz9NYriM';

// APP_STATE debe existir en TODAS las páginas (incluida login.html, que NO carga
// app.js). Antes lo definía firebase-config.js; al borrarlo quedó undefined en el
// login y el handler crasheaba con "Cannot set properties of undefined (currentUser)".
// Se usa || para no pisar el APP_STATE de app.js cuando este ya cargó (index.html).
window.APP_STATE = window.APP_STATE || {
  currentUser: null,
  authRestored: false,
  version: '1.3.2'
};
if (!window._appStartTime) window._appStartTime = Date.now();
