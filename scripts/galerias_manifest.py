# -*- coding: utf-8 -*-
"""Manifiesto de galerías generadas por inmueble.

Cada ficha de demostración debe tener 5 fotos coherentes entre sí: fachada,
sala-comedor, cocina, habitación principal y baño (o patio en las casas).
Las fotos se generan por lotes de 10 por turno (límite de la herramienta) y se
guardan como public/propiedades/prop-NN-1..5.jpg.

`nivel` fija los acabados y el estilo, de modo que las cinco fotos de una misma
ficha describan siempre la misma vivienda:

  A  popular / Regular        cerámica gastada, muebles de los 80-90, luz dura
  B  clase media              cerámica clara, madera, cortinas, luz de tarde
  C  clase media alta         porcelanato, muebles modernos, ventanales
  D  alto / lujo              mármol, maderas oscuras, iluminación cálida
  E  casa familiar            ambientes amplios, jardín o patio
  F  townhouse                escalera interior, family room, patio pequeño

Cómo se generan las fotos (procedimiento fijado en la sesión del 30/10/2026):
  1. Las peticiones sin `offer_options` fallan con 403 del proveedor de imagen.
     Hay que usar `offer_options: true` y que el usuario elija entre las dos
     propuestas; así entra el modelo que sí responde.
  2. Dentro de una misma ficha, la fachada se genera primero y las demás fotos
     la pasan como imagen de referencia; la sala se usa como referencia para
     cocina, habitación y baño. Eso mantiene piso, paredes y tonos de madera.
  3. Después se normaliza con ImageMagick a 1400 px de ancho (recortando a 4:3
     las que vengan cuadradas) para que pesen como el resto de la galería.
"""

# prop: (tipo, nivel, ciudad, hab, m2, piso, notas de estilo)
FICHAS = {
    1:  ('apartamento', 'B', 'Valencia', 3, 105, 5, 'edificio de los 90, sala-comedor amplia'),
    2:  ('apartamento', 'C', 'Valencia', 3, 98, 4, 'a estrenar, obra blanca, porcelanato brillante'),
    3:  ('apartamento', 'B', 'Valencia', 2, 72, 3, 'edificio de los 2000, sencillo y cuidado'),
    4:  ('apartamento', 'A', 'Valencia', 2, 68, 2, 'edificio antiguo, remodelado hace años'),
    5:  ('apartamento', 'D', 'Valencia', 4, 148, 7, 'zona norte, doble altura, vista a la montaña'),
    6:  ('apartamento', 'B', 'Valencia', 2, 74, 6, 'cocina remodelada con tope de granito'),
    7:  ('apartamento', 'A', 'Valencia', 2, 60, 1, 'planta baja, acabados originales'),
    8:  ('casa', 'E', 'Valencia', 3, 160, None, 'una planta, patio y estacionamiento'),
    9:  ('townhouse', 'C', 'Valencia', 3, 150, None, 'conjunto de seis unidades, family room'),
    10: ('apartamento', 'A', 'Valencia', 2, 57, 4, 'edificio popular, colores claros'),
    11: ('apartamento', 'C', 'Valencia', 2, 78, 6, 'amoblado, aire acondicionado, moderno'),
    12: ('apartamento', 'B', 'Valencia', 3, 100, 3, 'edificio de los 90, buena luz'),
    13: ('apartamento', 'B', 'Valencia', 2, 70, 3, 'piso 3 sin ascensor, sencillo'),
    14: ('apartamento', 'A', 'Valencia', 1, 45, 2, 'estudio, cocina integrada'),
    15: ('apartamento', 'B', 'Valencia', 3, 90, 5, 'familiar, cerámica beige'),
    16: ('apartamento', 'C', 'Valencia', 3, 110, 8, 'amoblado, iluminado, vista abierta'),
    17: ('apartamento', 'B', 'Valencia', 3, 95, 4, 'amoblado sencillo, cortinas claras'),
    18: ('apartamento', 'A', 'Valencia', 2, 68, 3, 'edificio de los 80, cocina pequeña'),
    19: ('apartamento', 'C', 'Valencia', 2, 82, 7, 'remodelado, porcelanato, cocina abierta'),
    20: ('apartamento', 'B', 'Valencia', 3, 105, 3, 'familiar, área de servicio'),
    21: ('apartamento', 'A', 'San Diego', 2, 62, 2, 'conjunto residencial, sencillo'),
    22: ('apartamento', 'A', 'San Diego', 2, 65, 6, 'vista a la ciudad, acabados originales'),
    23: ('apartamento', 'B', 'San Diego', 3, 86, 9, 'conjunto con parque infantil'),
    24: ('casa', 'E', 'San Diego', 4, 210, None, 'parcela de 300 m², patio techado, jardín'),
    25: ('townhouse', 'C', 'San Diego', 3, 165, None, 'conjunto cerrado, vigilancia, patio'),
    26: ('apartamento', 'B', 'San Diego', 3, 95, 5, 'cocina equipada, línea blanca'),
    27: ('casa', 'E', 'San Diego', 3, 180, None, 'aspecto sencillo, patio grande, sin reformar'),
    28: ('apartamento', 'A', 'San Diego', 2, 60, 3, 'económico, cerámica básica'),
    29: ('apartamento', 'A', 'San Diego', 2, 62, 2, 'sin amoblar, listo para entrar'),
    30: ('apartamento', 'C', 'San Diego', 3, 85, 9, 'amoblado, conjunto con salón de fiestas'),
    31: ('apartamento', 'A', 'San Diego', 1, 59, 4, 'un ambiente, cocina integrada'),
    32: ('casa', 'E', 'San Diego', 4, 200, None, 'una planta, patio de 100 m², sin amoblar'),
    33: ('townhouse', 'C', 'San Diego', 3, 150, None, 'conjunto cerrado, tres habitaciones'),
    34: ('apartamento', 'C', 'Caracas', 2, 95, 10, 'Chacao, edificio con vigilancia, vista urbana'),
    35: ('apartamento', 'C', 'Caracas', 3, 120, 8, 'Altamira, luminoso, ventanales'),
    36: ('apartamento', 'D', 'Caracas', 3, 140, 12, 'La Castellana, acabados de lujo'),
    37: ('apartamento', 'D', 'Caracas', 3, 165, 9, 'Los Palos Grandes, amplio, vista al Ávila'),
    38: ('apartamento', 'B', 'Caracas', 2, 90, 6, 'Bello Monte, edificio de los 90'),
    39: ('apartamento', 'B', 'Caracas', 3, 110, 5, 'Los Chaguaramos, familiar, cuidado'),
    40: ('casa', 'E', 'Caracas', 4, 250, None, 'La Trinidad, dos plantas, jardín y parrilla'),
    41: ('apartamento', 'B', 'Caracas', 3, 130, 3, 'El Paraíso, amplio, muebles clásicos'),
    42: ('apartamento', 'D', 'Caracas', 3, 180, 14, 'Campo Alegre, penthouse, terraza con vista'),
    43: ('apartamento', 'D', 'Caracas', 3, 135, 9, 'Las Mercedes, cocina con isla, balcón'),
    44: ('apartamento', 'C', 'Caracas', 2, 75, 7, 'Los Palos Grandes, amoblado y equipado'),
    45: ('apartamento', 'B', 'Caracas', 2, 90, 4, 'Chacao, edificio clásico, ascensor'),
    46: ('apartamento', 'C', 'Caracas', 3, 110, 11, 'Altamira, amoblado, vista a la ciudad'),
    47: ('apartamento', 'A', 'Caracas', 1, 55, 2, 'La Candelaria, edificio antiguo, sencillo'),
    48: ('casa', 'E', 'Caracas', 3, 130, None, 'Los Chorros, dos plantas, calle cerrada'),
    49: ('apartamento', 'B', 'Caracas', 2, 95, 6, 'El Rosal, oficina y vivienda, cuidado'),
    50: ('apartamento', 'D', 'Caracas', 3, 140, 15, 'Santa Fe, piso alto, vista panorámica'),
}

NIVEL = {
    'A': ('acabados modestos y algo usados, cerámica beige gastada, muebles de madera oscura de los años 80 y 90, '
          'cortinas sencillas, iluminación básica, ambiente popular venezolano'),
    'B': ('acabados de clase media, cerámica clara o porcelanato, muebles de madera clara, sofá de tela beige, '
          'cortinas de gasa, lámparas sencillas, ambiente habitado y ordenado'),
    'C': ('acabados modernos, porcelanato claro, muebles de líneas rectas, sofá gris, cocina con tope de cuarzo, '
          'ventanales con cortinas roller, iluminación cálida'),
    'D': ('acabados de lujo, mármol o porcelanato brillante, maderas oscuras, sofás claros de diseño, '
          'ventanales amplios con vista a la ciudad, iluminación cálida indirecta'),
    'E': ('casa familiar venezolana, ambientes amplios, cerámica rústica, muebles de madera, grandes ventanas '
          'con vista al jardín o al patio, vegetación tropical'),
    'F': ('townhouse en conjunto cerrado, escalera interior, family room, cerámica clara, muebles modernos, '
          'patio pequeño con plantas'),
}

ESTILO_FOTO = ('Fotografía real tomada con un teléfono móvil por un agente inmobiliario, sin retoque profesional, '
               'encuadre horizontal ligeramente torcido, grano suave de cámara de celular, luz natural, colores '
               'apagados y creíbles. Sin personas, sin texto, sin marcas de agua, sin aspecto de revista.')


def habitaciones(prop: int) -> list[str]:
    """Devuelve las cinco fotos que debe tener la ficha, en orden."""
    tipo, nivel, ciudad, n_hab, m2, piso, notas = FICHAS[prop]
    base = f'{NIVEL[nivel]}. {notas}. Vivienda de {m2} m² en {ciudad}, Venezuela.'
    planta = f'piso {piso}' if piso else 'casa de dos plantas'
    if tipo == 'casa':
        return [
            f'Fachada de {base} Casa de una o dos plantas, portón de reja, estacionamiento al frente, '
            f'árboles y cielo despejado. {ESTILO_FOTO}',
            f'Sala-comedor amplia de {base} Ventanas grandes con vista al jardín. {ESTILO_FOTO}',
            f'Cocina de {base} Muebles de madera, tope de granito, estufa, nevera, puerta al patio. {ESTILO_FOTO}',
            f'Habitación principal de {base} Cama matrimonial, clóset empotrado, ventana con cortina. {ESTILO_FOTO}',
            f'Patio o jardín trasero de {base} Área de parrilla, plantas tropicales, paredes de bloque pintadas. '
            f'{ESTILO_FOTO}',
        ]
    if tipo == 'townhouse':
        return [
            f'Fachada de {base} Townhouse en conjunto cerrado de dos plantas, portón, jardineras. {ESTILO_FOTO}',
            f'Sala-comedor y family room de {base} Escalera interior visible al fondo. {ESTILO_FOTO}',
            f'Cocina de {base} Muebles claros, tope de cuarzo o granito, desayunador. {ESTILO_FOTO}',
            f'Habitación principal de {base} Cama king, clóset, ventana con vista al conjunto. {ESTILO_FOTO}',
            f'Patio pequeño de {base} Plantas en macetas, piso de cerámica, pared de bloque. {ESTILO_FOTO}',
        ]
    return [
        f'Fachada del edificio donde está {base} Torre residencial venezolana de varias plantas, entrada con '
        f'vigilancia, jardineras y árboles. {ESTILO_FOTO}',
        f'Sala-comedor de {base} {planta}. {ESTILO_FOTO}',
        f'Cocina de {base} {planta}. {ESTILO_FOTO}',
        f'Habitación principal de {base} {planta}. {ESTILO_FOTO}',
        f'Baño de {base} {planta}. Lavamanos, espejo, poceta y ducha. {ESTILO_FOTO}',
    ]


if __name__ == '__main__':
    import sys
    for p in sorted(FICHAS):
        print(f'--- prop-{p:02d} ---')
        for i, texto in enumerate(habitaciones(p), 1):
            print(f'  prop-{p:02d}-{i}.jpg :: {texto[:150]}...')
        if p >= (int(sys.argv[1]) if len(sys.argv) > 1 else 2):
            break
