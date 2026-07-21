# ============================================================
# Script: convert-to-webp.ps1
# Descripción: Convierte referencias PNG a WebP en el código
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "`n=== CONVERSIÓN PNG → WEBP ===" -ForegroundColor Cyan
Write-Host "Este script actualizará las referencias de PNG a WebP`n"

# Definir reemplazos
$replacements = @(
    @{ File = "public/manifest.json"; Find = "icon-192.png"; Replace = "icon-192.webp" },
    @{ File = "public/manifest.json"; Find = "icon-512.png"; Replace = "icon-512.webp" },
    @{ File = "public/manifest.json"; Find = "pwa-tagline.png"; Replace = "pwa-tagline.webp" },
    @{ File = "public/manifest.json"; Find = "image/png"; Replace = "image/webp" },
    @{ File = "src/app/layout.tsx"; Find = "icon-192.png"; Replace = "icon-192.webp" },
    @{ File = "src/app/layout.tsx"; Find = "og-image.png"; Replace = "og-image.webp" },
    @{ File = "src/app/page.tsx"; Find = "placeholder-product.png"; Replace = "placeholder-product.webp" },
    @{ File = "src/app/catalogo/CatalogoPage.tsx"; Find = "placeholder-product.png"; Replace = "placeholder-product.webp" },
    @{ File = "src/app/buscar/BuscarPage.tsx"; Find = "placeholder-product.png"; Replace = "placeholder-product.webp" },
    @{ File = "src/components/ProductCard.tsx"; Find = "placeholder-product.png"; Replace = "placeholder-product.webp" }
)

# Mostrar resumen de cambios
Write-Host "Archivos que serán modificados:" -ForegroundColor Yellow
$groupedFiles = $replacements | Group-Object File
foreach ($group in $groupedFiles) {
    Write-Host "  • $($group.Name)" -ForegroundColor Gray
    foreach ($change in $group.Group) {
        Write-Host "    - $($change.Find) → $($change.Replace)" -ForegroundColor DarkGray
    }
}

# Confirmar antes de proceder
$confirm = Read-Host "`n¿Proceder con los cambios? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Operación cancelada" -ForegroundColor Red
    exit
}

# Aplicar reemplazos
Write-Host "`nAplicando cambios..." -ForegroundColor Cyan
$changesApplied = 0

foreach ($replacement in $replacements) {
    $filePath = $replacement.File
    $find = $replacement.Find
    $replace = $replacement.Replace
    
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        if ($content -match [regex]::Escape($find)) {
            $newContent = $content -replace [regex]::Escape($find), $replace
            Set-Content $filePath $newContent -NoNewline
            Write-Host "✓ $filePath" -ForegroundColor Green
            $changesApplied++
        } else {
            Write-Host "⊘ $filePath (patrón no encontrado)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ $filePath (archivo no encontrado)" -ForegroundColor Red
    }
}

Write-Host "`n=== RESUMEN ===" -ForegroundColor Cyan
Write-Host "Cambios aplicados: $changesApplied" -ForegroundColor Green

# Verificar imágenes WebP
Write-Host "`n=== VERIFICACIÓN DE IMÁGENES WEBP ===" -ForegroundColor Cyan
$webpFiles = @(
    "public/icon-192.webp",
    "public/icon-512.webp",
    "public/pwa-tagline.webp",
    "public/og-image.webp",
    "public/placeholder-product.webp"
)

$missingFiles = @()
foreach ($file in $webpFiles) {
    if (Test-Path $file) {
        $size = [math]::Round((Get-Item $file).Length / 1KB, 1)
        Write-Host "✓ $file ($size KB)" -ForegroundColor Green
    } else {
        Write-Host "✗ $file (FALTA)" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`n⚠ ADVERTENCIA: Faltan archivos WebP" -ForegroundColor Yellow
    Write-Host "Convierte estas imágenes antes de hacer deploy:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Yellow
    }
}

Write-Host "`n=== PRÓXIMOS PASOS ===" -ForegroundColor Cyan
Write-Host "1. Convierte las imágenes PNG a WebP (Squoosh.app recomendado)"
Write-Host "2. Ejecuta: npm run build"
Write-Host "3. Si compila OK: git add . && git commit -m 'perf: convert PNGs to WebP'"
Write-Host "4. Deploy: git push origin main"