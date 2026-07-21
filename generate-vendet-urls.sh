#!/bin/bash

# Script para generar lista de URLs de VendeT para inspeccionar en Google Search Console
# Genera URLs de landing pages por ciudad × categoría

BASE_URL="https://vendet.online"

# Ciudades
CIUDADES=(
  "caracas"
  "maracaibo"
  "valencia"
  "barquisimeto"
  "maracay"
  "ciudad-guayana"
  "cumaná"
  "mérida"
  "san-cristóbal"
  "petare"
  "baruta"
  "mayaque"
)

# Categorías del sitemap actual
CATEGORIAS=(
  "vehiculos"
  "tecnologia"
  "moda"
  "hogar"
  "herramientas"
  "materiales"
  "repuestos"
  "otros"
)

# Página 1: URLs principales + informativas
cat > vendet_urls_part1.txt <<EOF
${BASE_URL}/
${BASE_URL}/catalogo
${BASE_URL}/blog
${BASE_URL}/publicar
${BASE_URL}/login
${BASE_URL}/register
${BASE_URL}/dashboard
${BASE_URL}/creditos
${BASE_URL}/como-funciona
${BASE_URL}/faq
${BASE_URL}/sobre-nosotros
${BASE_URL}/contacto
${BASE_URL}/terminos-y-condiciones
${BASE_URL}/politica-de-privacidad
EOF

# Página 2: Landing pages por ciudad (sin categoría)
> vendet_urls_part2_ciudades.txt

for ciudad in "${CIUDADES[@]}"; do
  echo "${BASE_URL}/${ciudad}" >> vendet_urls_part2_ciudades.txt
done

# Página 3: Landing pages ciudad × categoría (~80-100 URLs)
> vendet_urls_part3_ciudad_categoria.txt

for ciudad in "${CIUDADES[@]}"; do
  for categoria in "${CATEGORIAS[@]}"; do
    echo "${BASE_URL}/${ciudad}/${categoria}" >> vendet_urls_part3_ciudad_categoria.txt
  done
done

# Página 4: Resumen
TOTAL_CIUDADES=${#CIUDADES[@]}
TOTAL_CATEGORIAS=${#CATEGORIAS[@]}
TOTAL_CIUDAD_CATEGORIA=$((TOTAL_CIUDADES * TOTAL_CATEGORIAS))

cat > vendet_urls_resumen.txt <<EOF
# RESUMEN DE Vendet.online URLs para Google Search Console
# Generado: $(date "+%Y-%m-%d %H:%M:%S")

=== PÁGINAS PRINCIPALES (14 URLs) ===
Contenido principal, páginas informativas críticas para SEO.

=== CIUDADES SOLO ($TOTAL_CIUDADES URLs) ===
Landing pages genéricas por ciudad, sin categoría específica.

=== CIUDAD × CATEGORÍA ($TOTAL_CIUDAD_CATEGORIA URLs) ===
Landing pages locales específicas — las más importantes para SEO local.
Ejemplo: ${BASE_URL}/caracas/tecnologia, ${BASE_URL}/maracaibo/materiales

TOTAL ESTIMADO: $((14 + TOTAL_CIUDADES + TOTAL_CIUDAD_CATEGORIA)) URLs
EOF

echo "✅ Archivos generados:"
echo "   - vendet_urls_part1.txt (14 URLs principales)"
echo "   - vendet_urls_part2_ciudades.txt ($TOTAL_CIUDADES URLs de ciudades)"
echo "   - vendet_urls_part3_ciudad_categoria.txt ($TOTAL_CIUDAD_CATEGORIA URLs ciudad×categoría)"
echo "   - vendet_urls_resumen.txt (este resumen)"
