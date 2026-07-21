#!/usr/bin/env python3
"""Generar archivos de batch para copiar a Google Search Console"""

def main():
    try:
        # Leer URLs
        with open('vendet_urls_completas.txt', 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip()]
        
        print(f"📊 Total: {len(urls)} URLs")
        
        # Split en batches de 10
        batch_size = 10
        for i in range(0, len(urls), batch_size):
            batch = urls[i:i+batch_size]
            filename = f"batch_{i//batch_size + 1:03d}.txt"
            
            with open(filename, 'w', encoding='utf-8') as f:
                f.write('\n'.join(batch))
            
            print(f"  ✓ {filename} ({len(batch)} URLs)")
        
        print(f"\n✅ Generados {len(urls)//batch_size + 1} archivos de batch listas para GSC")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
