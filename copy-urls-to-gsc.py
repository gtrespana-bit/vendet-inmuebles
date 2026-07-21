#!/usr/bin/env python3
# Script para obtener URLs de VendeT en batches de 10 para copiar a Google Search Console

import sys

def main():
    try:
        # Leer el archivo
        with open('vendet_urls_completas.txt', 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip()]
        
        print(f"📊 Total de URLs: {len(urls)}")
        print("=" * 60)
        print("👆 COPIA ESTOS BATCHES PARA GOOGLE SEARCH CONSOLE")
        print("=" * 60)
        
        # Procesar en batches de 10
        batch_size = 10
        num_batches = (len(urls) + batch_size - 1) // batch_size
        
        for i in range(num_batches):
            start = i * batch_size
            end = min(start + batch_size, len(urls))
            batch = urls[start:end]
            
            print(f"\n📦 BATCH {i+1}/{num_batches} ({len(batch)} URLs)")
            print("-" * 60)
            
            for j, url in enumerate(batch, 1):
                print(f"  {j:2}. {url}")
            
            copy_command = f"""
👆 PRESIONA Ctrl+C para copiar estas {len(batch)} URLs
Pégales en Google Search Console > Inspección de URL > Enter
"""
            print(copy_command)
            
            # Esperar que el usuario presione Enter para continuar
            if len(batch) >= batch_size:
                input("  [Presiona Enter para continuar al siguiente batch...]")
        
        print("\n✅ ¡Todas las URLs listadas!")
        print("\n💡 Tip: Para cada URL, si GSC dice 'URL no indexada',")
        print("   clic en 'Solicitar indexación' para acelerar el proceso.")
        
    except FileNotFoundError:
        print("❌ Error: No se encontró 'vendet_urls_completas.txt'")
        print("   Asegúrate de ejecutar este script desde la carpeta marketplace-vzla/")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
