# -*- coding: utf-8 -*-
"""Convierte las galerías generadas en public/propiedades en SQL para Supabase.

Uso:
  python3 scripts/galerias_sql.py            # informe de estado
  python3 scripts/galerias_sql.py --sql      # imprime el SQL de carga

Reglas:
  * Cada ficha tiene 5 fotos: prop-NN-1.jpg (fachada) … prop-NN-5.jpg (baño/patio).
  * Si una ficha no está completa se informa y no se toca.
  * El SQL borra las filas de inmueble_imagenes de esa ficha, las vuelve a crear y
    actualiza inmuebles.imagen_url con la fachada (portada en orden 0).
  * El DELETE y el INSERT van en sentencias separadas: dentro de una misma consulta
    las CTE de modificación no ven sus propios cambios (provocaba 23505 en
    inmueble_imagenes_inmueble_id_orden_key).
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COVER = '/propiedades/prop-{n:02d}.jpg'
GAL = '/propiedades/prop-{n:02d}-{i}.jpg'
TOTAL = 5


def estado():
    completas, incompletas = [], []
    for n in range(1, 51):
        fotos = [GAL.format(n=n, i=i) for i in range(1, TOTAL + 1)]
        faltan = [f for f in fotos if not (ROOT / 'public' / f.lstrip('/')).exists()]
        (completas if not faltan else incompletas).append((n, faltan))
    return completas, incompletas


def sql(completas):
    numeros = [n for n, _ in completas]
    if not numeros:
        return '-- ninguna ficha completa todavía'
    patrones = ' or '.join(
        [f"imagen_url like '/propiedades/prop-{n:02d}.jpg'" for n in numeros]
        + [f"imagen_url like '/propiedades/prop-{n:02d}-%.jpg'" for n in numeros]
    )
    filas = []
    for n in numeros:
        for i in range(1, TOTAL + 1):
            filas.append(
                f"  ('{COVER.format(n=n)}', {i - 1}, '{GAL.format(n=n, i=i)}', {str(i == 1).lower()})"
            )
    updates = '\n'.join(
        f"update public.inmuebles set imagen_url = '{GAL.format(n=n, i=1)}' "
        f"where imagen_url like '/propiedades/prop-{n:02d}.jpg' or imagen_url like '/propiedades/prop-{n:02d}-%.jpg';"
        for n in numeros
    )
    return (
        'begin;\n'
        f"delete from public.inmueble_imagenes where inmueble_id in (\n"
        f"  select id from public.inmuebles where {patrones}\n);\n"
        'insert into public.inmueble_imagenes (inmueble_id, url_imagen, orden, es_portada)\n'
        'select i.id, v.url, v.orden, v.portada\n'
        'from public.inmuebles i\n'
        'join (values\n' + ',\n'.join(filas) + '\n'
        ') as v(cubre, orden, url, portada) on i.imagen_url = v.cubre;\n'
        f'{updates}\n'
        'commit;'
    )


if __name__ == '__main__':
    completas, incompletas = estado()
    print(f'fichas completas: {len(completas)} -> {", ".join(f"prop-{n:02d}" for n, _ in completas) or "ninguna"}')
    print(f'fichas pendientes: {len(incompletas)}')
    for n, faltan in incompletas[:60]:
        print(f'  prop-{n:02d}: faltan {len(faltan)} -> {", ".join(f.split("/")[-1] for f in faltan)}')
    if '--sql' in sys.argv:
        print(sql(completas))
