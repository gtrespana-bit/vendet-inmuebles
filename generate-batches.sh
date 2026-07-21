#!/bin/bash
# Script para generar archivos individuales por batch de 10 URLs

BASE_URL="https://vendet.online"

# Lista completa de URLs
readarray -t URLs < vendet_urls_completas.txt

TOTAL=${#URLS[@]}
BATCH_SIZE=10
NUM_BATCHES=$(( (TOTAL + BATCH_SIZE - 1) / BATCH_SIZE ))

echo "📊 Generando $NUM_BATCHES batches de $BATCH_SIZE URLs cada uno..."
echo ""

for ((i=0; i<NUM_BATCHES; i++)); do
    START=$((i * BATCH_SIZE))
    END=$((START + BATCH_SIZE))
    NUM=$((END - START))
    
    # Crear archivo
    FILE="batch_${i+1}.txt"
    > "$FILE"
    
    for ((j=START; j<END; j++)); do
        echo "${URLS[$j]}" >> "$FILE"
    done
    
    echo "✅ batch_${i+1}.txt - $NUM URLs"
done

echo ""
echo "📦 Archivos creados:"
echo "   batch_1.txt  (URLs 1-10)"
echo "   batch_2.txt  (URLs 11-20)"
echo "   ..."
echo "   batch_${NUM_BATCHES}.txt (últimas URLs)"
echo ""
echo "👉 Usa estos archivos para copiar y pegar en Google Search Console"
