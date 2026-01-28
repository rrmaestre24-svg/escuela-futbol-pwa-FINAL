#!/bin/bash
# ========================================
# SCRIPT DE VERIFICACIÓN - SUPER ADMIN PWA
# ========================================

echo "🔍 Verificando estructura del proyecto..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar archivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 existe${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 NO EXISTE${NC}"
        return 1
    fi
}

# Función para verificar directorios
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ Carpeta $1 existe${NC}"
        return 0
    else
        echo -e "${RED}❌ Carpeta $1 NO EXISTE${NC}"
        return 1
    fi
}

echo "📁 Verificando estructura de carpetas..."
check_dir "admin"
check_dir "admin/icons"

echo ""
echo "📄 Verificando archivos principales..."
check_file "admin/index.html"
check_file "admin/admin.js"
check_file "admin/manifest.json"
check_file "admin/sw.js"

echo ""
echo "🖼️  Verificando iconos..."
check_file "admin/icons/icon-72x72.png"
check_file "admin/icons/icon-96x96.png"
check_file "admin/icons/icon-128x128.png"
check_file "admin/icons/icon-144x144.png" || echo -e "${YELLOW}⚠️  Necesitas crear icon-144x144.png${NC}"
check_file "admin/icons/icon-152x152.png"
check_file "admin/icons/icon-192x192.png"
check_file "admin/icons/icon-384x384.png"
check_file "admin/icons/icon-512x512.png"

echo ""
echo "🔧 Verificando rutas en index.html..."

if [ -f "admin/index.html" ]; then
    # Verificar ruta del script admin.js
    if grep -q 'src="/admin/admin.js"' admin/index.html; then
        echo -e "${RED}❌ PROBLEMA: Ruta absoluta detectada en admin.js${NC}"
        echo -e "${YELLOW}   Línea encontrada: src=\"/admin/admin.js\"${NC}"
        echo -e "${GREEN}   Debe ser: src=\"./admin.js\"${NC}"
    elif grep -q 'src="./admin.js"' admin/index.html || grep -q 'src="admin.js"' admin/index.html; then
        echo -e "${GREEN}✅ Ruta de admin.js correcta${NC}"
    else
        echo -e "${YELLOW}⚠️  No se encontró referencia a admin.js${NC}"
    fi
fi

echo ""
echo "🔧 Verificando manifest.json..."

if [ -f "admin/manifest.json" ]; then
    # Verificar start_url
    if grep -q '"start_url": "/admin/index.html"' admin/manifest.json; then
        echo -e "${RED}❌ PROBLEMA: start_url usa ruta absoluta${NC}"
        echo -e "${YELLOW}   Encontrado: \"/admin/index.html\"${NC}"
        echo -e "${GREEN}   Debe ser: \"./index.html\"${NC}"
    elif grep -q '"start_url": "./index.html"' admin/manifest.json; then
        echo -e "${GREEN}✅ start_url correcto${NC}"
    fi
    
    # Verificar scope
    if grep -q '"scope": "/admin/"' admin/manifest.json; then
        echo -e "${RED}❌ PROBLEMA: scope usa ruta absoluta${NC}"
        echo -e "${YELLOW}   Encontrado: \"/admin/\"${NC}"
        echo -e "${GREEN}   Debe ser: \"./\"${NC}"
    elif grep -q '"scope": "./"' admin/manifest.json; then
        echo -e "${GREEN}✅ scope correcto${NC}"
    fi
fi

echo ""
echo "================================"
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "================================"

ERRORS=0

# Contar problemas
if [ ! -f "admin/icons/icon-144x144.png" ]; then
    ((ERRORS++))
fi

if grep -q 'src="/admin/admin.js"' admin/index.html 2>/dev/null; then
    ((ERRORS++))
fi

if grep -q '"start_url": "/admin/index.html"' admin/manifest.json 2>/dev/null; then
    ((ERRORS++))
fi

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ¡TODO CORRECTO! No se encontraron problemas.${NC}"
else
    echo -e "${RED}❌ Se encontraron $ERRORS problema(s)${NC}"
    echo ""
    echo "📝 PASOS PARA SOLUCIONAR:"
    echo ""
    
    if grep -q 'src="/admin/admin.js"' admin/index.html 2>/dev/null; then
        echo "1. En admin/index.html, línea ~508:"
        echo "   Cambiar: src=\"/admin/admin.js\""
        echo "   Por:     src=\"./admin.js\""
        echo ""
    fi
    
    if grep -q '"start_url": "/admin/index.html"' admin/manifest.json 2>/dev/null; then
        echo "2. En admin/manifest.json:"
        echo "   Cambiar rutas absolutas por relativas"
        echo "   Usa los archivos corregidos proporcionados"
        echo ""
    fi
    
    if [ ! -f "admin/icons/icon-144x144.png" ]; then
        echo "3. Crear icono faltante:"
        echo "   cd admin/icons/"
        echo "   cp icon-152x152.png icon-144x144.png"
        echo ""
    fi
fi

echo ""
echo "💡 SIGUIENTE PASO:"
echo "   1. Aplica las correcciones necesarias"
echo "   2. Limpia el caché del navegador"
echo "   3. Recarga la aplicación (Ctrl + Shift + R)"
echo ""
echo "🚀 ¡Buena suerte!"