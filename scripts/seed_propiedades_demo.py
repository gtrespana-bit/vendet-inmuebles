# -*- coding: utf-8 -*-
"""Genera el SQL y los archivos de imagen para 50 fichas de ejemplo realistas.

Las fotos proceden de anuncios públicos de inmuebles venezolanos (Valencia, San Diego
y Caracas) y se guardan en /public/propiedades. Los textos, precios, áreas y
ubicaciones se redactaron a partir de rangos de mercado reales (USD/m² y alquiler
mensual) para las tres ciudades.
"""
import json, os, shutil, subprocess, datetime, random

IMG = {
 1:'apartamento-alquiler-los-palos-grandes-c-2.jpg',
 8:'apartamento-amoblado-alquiler-valencia-c-3.jpg',
 9:'apartamento-amoblado-alquiler-valencia-c-4.jpg',
 10:'apartamento-amoblado-alquiler-valencia-c-5.jpg',
 11:'apartamento-en-alquiler-altamira-caracas-3.webp',
 12:'apartamento-en-alquiler-altamira-caracas-4.jpg',
 13:'apartamento-en-venta-chacao-caracas-sala-2.jpg',
 14:'apartamento-en-venta-chacao-caracas-sala-4.jpg',
 15:'apartamento-en-venta-chacao-caracas-sala-5.jpg',
 16:'apartamento-en-venta-la-trigale-a-valenc-1.jpg',
 20:'apartamento-en-venta-la-trigale-a-valenc-5.webp',
 25:'apartamento-en-venta-san-diego-carabobo--2.jpg',
 27:'apartamento-en-venta-san-diego-carabobo--5.jpg',
 28:'apartamento-en-venta-valencia-carabobo-s-1.jpg',
 29:'apartamento-en-venta-valencia-carabobo-s-2.jpg',
 30:'apartamento-en-venta-valencia-carabobo-s-4.jpg',
 31:'apartamento-en-venta-valencia-carabobo-s-5.jpg',
 32:'apartamento-en-venta-valencia-venezuela--1.jpg',
 33:'apartamento-en-venta-valencia-venezuela--2.jpg',
 34:'apartamento-en-venta-valencia-venezuela--3.jpg',
 35:'apartamento-en-venta-valencia-venezuela--4.jpg',
 36:'apartamento-en-venta-valencia-venezuela--5.jpg',
 37:'bienesonline-apartamento-venta-caracas-s-1.jpg',
 38:'bienesonline-apartamento-venta-caracas-s-2.jpg',
 39:'bienesonline-apartamento-venta-valencia--1.jpg',
 40:'bienesonline-apartamento-venta-valencia--2.jpg',
 41:'bienesonline-apartamento-venta-valencia--3.jpg',
 42:'bienesonline-apartamento-venta-valencia--4.jpg',
 43:'bienesonline-apartamento-venta-valencia--5.jpg',
 44:'bienesonline-com-apartamento-en-alquiler-1.jpg',
 45:'bienesonline-com-apartamento-en-alquiler-2.jpg',
 46:'bienesonline-com-apartamento-en-alquiler-3.jpg',
 47:'bienesonline-com-apartamento-en-alquiler-4.jpg',
 48:'bienesonline-com-apartamento-en-alquiler-5.jpg',
 49:'bienesonline-com-apartamento-venta-san-d-1.jpg',
 50:'bienesonline-com-apartamento-venta-san-d-2.jpg',
 51:'bienesonline-com-apartamento-venta-san-d-3.jpg',
 52:'bienesonline-com-apartamento-venta-san-d-4.jpg',
 53:'bienesonline-com-apartamento-venta-san-d-5.jpg',
 54:'bienesonline-com-casa-en-venta-caracas-d-1.jpg',
 55:'bienesonline-com-casa-en-venta-caracas-d-3.jpg',
 56:'casa-en-venta-san-diego-carabobo-sala-co-1.jpg',
 57:'casa-en-venta-san-diego-carabobo-sala-co-3.jpg',
 60:'casa-en-venta-valencia-carabobo-naguanag-3.jpg',
 62:'casa-en-venta-valencia-carabobo-naguanag-5.webp',
 63:'equiporemax-apartamento-venta-valencia-d-1.jpg',
 64:'equiporemax-apartamento-venta-valencia-d-2.jpg',
 65:'equiporemax-apartamento-venta-valencia-d-4.jpg',
 66:'equiporemax-apartamento-venta-valencia-d-5.jpg',
 67:'equiporemax-com-apartamento-alquiler-val-3.jpg',
 68:'equiporemax-com-apartamento-alquiler-val-4.jpg',
 69:'equiporemax-com-apartamento-alquiler-val-5.jpg',
 76:'remax-venezuela-apartamento-en-venta-car-2.webp',
 78:'remax-venezuela-apartamento-en-venta-car-4.webp',
 79:'remax-venezuela-apartamento-en-venta-car-5.jpg',
}

COORD = {
 ('Caracas','Chacao'):(10.4960,-66.8510), ('Caracas','Altamira'):(10.4965,-66.8480),
 ('Caracas','La Castellana'):(10.4985,-66.8555), ('Caracas','Los Palos Grandes'):(10.4985,-66.8435),
 ('Caracas','Las Mercedes'):(10.4780,-66.8540), ('Caracas','Bello Monte'):(10.4930,-66.8730),
 ('Caracas','Los Chaguaramos'):(10.4870,-66.8900), ('Caracas','Santa Mónica'):(10.4780,-66.8850),
 ('Caracas','El Paraíso'):(10.4800,-66.9300), ('Caracas','La Florida'):(10.4930,-66.9050),
 ('Caracas','El Hatillo'):(10.4240,-66.8260), ('Caracas','La Trinidad'):(10.4410,-66.8670),
 ('Caracas','Los Chorros'):(10.4930,-66.8280), ('Caracas','Sebucán'):(10.4950,-66.8330),
 ('Caracas','Campo Alegre'):(10.4990,-66.8470), ('Caracas','El Rosal'):(10.4900,-66.8600),
 ('Caracas','Santa Fe'):(10.4600,-66.8500), ('Caracas','La Candelaria'):(10.5060,-66.9100),
 ('Valencia','Prebo'):(10.1900,-68.0140), ('Valencia','El Viñedo'):(10.1960,-68.0110),
 ('Valencia','La Trigaleña'):(10.1900,-68.0030), ('Valencia','Guaparo'):(10.1950,-68.0190),
 ('Valencia','Trigal Norte'):(10.1870,-68.0170), ('Valencia','Trigal Centro'):(10.1830,-68.0140),
 ('Valencia','El Parral'):(10.1800,-68.0080), ('Valencia','El Bosque'):(10.1760,-68.0050),
 ('Valencia','San José'):(10.1700,-68.0100), ('Valencia','Los Colorados'):(10.1720,-68.0280),
 ('Valencia','Sabana Larga'):(10.1740,-68.0200), ('Valencia','Los Mangos'):(10.1850,-68.0300),
 ('Valencia','La Isabelica'):(10.2050,-68.0450), ('Valencia','Naguanagua'):(10.2450,-68.0150),
 ('Valencia','Centro'):(10.1660,-68.0040),
 ('San Diego','Terrazas de San Diego'):(10.2450,-67.9650), ('San Diego','Lomas de San Diego'):(10.2530,-67.9700),
 ('San Diego','Valle de Oro'):(10.2390,-67.9540), ('San Diego','El Remanso'):(10.2500,-67.9800),
 ('San Diego','Monte Mayor'):(10.2360,-67.9480), ('San Diego','Colinas de San Diego'):(10.2470,-67.9720),
 ('San Diego','Poblado de San Diego'):(10.2420,-67.9600), ('San Diego','La Esmeralda'):(10.2380,-67.9560),
}

MUNI = {'Caracas':{'Chacao':'Chacao','Altamira':'Chacao','La Castellana':'Chacao','Los Palos Grandes':'Chacao',
        'Las Mercedes':'Baruta','Bello Monte':'Baruta','Los Chaguaramos':'Libertador','Santa Mónica':'Libertador',
        'El Paraíso':'Libertador','La Florida':'Libertador','El Hatillo':'El Hatillo','La Trinidad':'Baruta',
        'Los Chorros':'Sucre','Sebucán':'Sucre','Campo Alegre':'Chacao','El Rosal':'Libertador','Santa Fe':'Baruta',
        'La Candelaria':'Libertador'},
        'Valencia':{k:'Valencia' for k in ['Prebo','El Viñedo','La Trigaleña','Guaparo','Trigal Norte','Trigal Centro',
        'El Parral','El Bosque','San José','Los Colorados','Sabana Larga','Los Mangos','La Isabelica','Naguanagua','Centro']},
        'San Diego':{k:'San Diego' for k in ['Terrazas de San Diego','Lomas de San Diego','Valle de Oro','El Remanso',
        'Monte Mayor','Colinas de San Diego','Poblado de San Diego','La Esmeralda']}}
ESTADO = {'Caracas':'Distrito Capital','Valencia':'Carabobo','San Diego':'Carabobo'}

# (img_id, op, tipo, ciudad, zona, titulo, descripcion, precio, area, hab, banos, puestos, piso, antiguedad, condicion, destacado)
L = [
 (28,'venta','Apartamento','Valencia','Prebo',
  'Apartamento de 3 habitaciones en Prebo, piso 5',
  'Ubicado en el edificio Prebo I, con 105 m² distribuidos en sala-comedor, cocina con desayunador, tres habitaciones (la principal con baño privado) y cuarto de servicio con área de lavado. El edificio tiene vigilancia 24 horas, ascensor y planta eléctrica. Se entrega con cocina empotrada y clósets en todas las habitaciones. Documentos al día.',
  98000,105,3,2,2,5,18,'Bueno',True),
 (16,'venta','Apartamento','Valencia','La Trigaleña',
  'Apartamento a estrenar en La Trigaleña, 98 m²',
  'Obra nueva en residencias Agua Viva, tercera etapa. 98 m² con sala-comedor amplia, cocina equipada, tres habitaciones y dos baños completos. Balcón con vista a la zona norte, piso 7. El conjunto cuenta con gimnasio, salón de fiestas, vigilancia y planta eléctrica para áreas comunes. Listo para habitar, con financiamiento directo del constructor.',
  128000,98,3,2,2,7,0,'A estrenar',True),
 (33,'venta','Apartamento','Valencia','Trigal Norte',
  'Apartamento 2 habitaciones en Trigal Norte, 72 m²',
  'Apartamento en piso 3 de un edificio de 8, con 72 m² y buena iluminación natural. Sala-comedor, cocina semiabierta, dos habitaciones con clósets y un baño. Un puesto de estacionamiento y área de lavado en la azotea. Zona residencial tranquila, a pocos minutos del CC Trigal Norte.',
  58000,72,2,1,1,3,12,'Bueno',False),
 (41,'venta','Apartamento','Valencia','El Parral',
  'Se vende apartamento en El Parral, 68 m²',
  'Piso 2 de 5, sin ascensor. Consta de sala-comedor, cocina, dos habitaciones y un baño. Incluye un puesto de estacionamiento descubierto y maletero. El edificio se encuentra en mantenimiento activo y las cuotas de condominio están al día. Ideal para primera vivienda o inversión en alquiler.',
  42000,68,2,1,1,2,25,'Bueno',False),
 (63,'venta','Apartamento','Valencia','Guaparo',
  'Apartamento de 4 habitaciones en Guaparo, 148 m²',
  'Amplio apartamento en piso 4, con 148 m² y vista abierta hacia el norte de la ciudad. Sala-comedor, familia, cocina con isla, cuatro habitaciones (dos con baño) y cuarto de servicio. Dos puestos de estacionamiento cubiertos y depósito. Edificio con vigilancia, ascensor de servicio y área social.',
  178000,148,4,3,2,4,14,'Excelente',True),
 (64,'venta','Apartamento','Valencia','El Bosque',
  'Apartamento en El Bosque con 74 m² y 2 habitaciones',
  'Ubicado en la calle principal de El Bosque, cerca de colegios y comercios. 74 m² con sala-comedor, cocina remodelada hace dos años, dos habitaciones y dos baños. Un puesto de estacionamiento. La cocina se entrega con tope de granito y muebles nuevos.',
  56000,74,2,2,1,6,20,'Bueno',False),
 (42,'venta','Apartamento','Valencia','San José',
  'Apartamento económico en San José, 60 m²',
  'Ideal para inversionistas: 60 m² en piso 1, con sala-comedor, dos habitaciones, un baño y cocina con espacio para lavadora. Recibe financiamiento bancario y Fondo de Ahorro. La zona cuenta con transporte público a pocos metros y mercado municipal a cinco minutos.',
  34000,60,2,1,1,1,30,'Regular',False),
 (60,'venta','Casa','Valencia','Naguanagua',
  'Casa de 3 habitaciones en Naguanagua, 160 m²',
  'Casa de dos niveles en urbanización cerrada con vigilancia. 160 m² construidos sobre terreno de 240 m²: sala-comedor, cocina con comedor diario, tres habitaciones, tres baños, patio trasero con área de ropa y estacionamiento techado para dos vehículos. Techos e impermeabilización recientes.',
  118000,160,3,3,2,None,16,'Bueno',False),
 (62,'venta','Townhouse','Valencia','El Viñedo',
  'Townhouse de 3 habitaciones en El Viñedo',
  'Townhouse en conjunto de seis unidades, con 150 m² de construcción. Tres habitaciones (la principal con vestier), dos baños y medio, family room, cocina equipada y patio interior. Estacionamiento para dos carros y depósito independiente. Cuota de condominio mensual de USD 60.',
  132000,150,3,2,2,None,10,'Excelente',False),
 (43,'venta','Apartamento','Valencia','La Isabelica',
  'Apartamento 2 habitaciones en La Isabelica, 57 m²',
  'Opción accesible en piso 8 con ascensor. 57 m², sala-comedor pequeña, cocina, dos habitaciones y un baño. Un puesto de estacionamiento. El edificio cuenta con vigilancia nocturna y el conjunto tiene cancha deportiva y parque infantil.',
  26500,57,2,1,1,8,28,'Regular',False),

 (8,'alquiler','Apartamento','Valencia','Prebo',
  'Apartamento amoblado en alquiler en Prebo, 78 m²',
  'Amoblado y equipado: sala, comedor, dos habitaciones (principal con cama queen), un baño completo, cocina con nevera, microondas y lavadora. Incluye aire acondicionado en habitaciones, agua caliente y un puesto de estacionamiento. Disponible para contratos de 12 meses, con depósito de un mes.',
  650,78,2,1,1,6,15,'Excelente',True),
 (44,'alquiler','Apartamento','Valencia','La Trigaleña',
  'Alquiler de apartamento de 3 habitaciones en La Trigaleña',
  'Apartamento sin amoblar de 100 m² en piso 5. Sala-comedor, cocina con desayunador, tres habitaciones, dos baños y cuarto de servicio. Un puesto de estacionamiento y vigilancia permanente. El edificio cuenta con planta eléctrica. Se solicita referencia laboral y depósito de un mes.',
  700,100,3,2,1,5,12,'Bueno',False),
 (45,'alquiler','Apartamento','Valencia','El Parral',
  'Apartamento en alquiler en El Parral, 70 m²',
  'Dos habitaciones, un baño, sala-comedor y cocina con instalación para lavadora. Piso 3 sin ascensor. Ubicado a dos cuadras de la avenida principal, con paradas de transporte cercanas. Se alquila sin muebles y sin puesto de estacionamiento.',
  380,70,2,1,0,3,22,'Bueno',False),
 (46,'alquiler','Apartamento','Valencia','San José',
  'Estudio en alquiler en San José, 45 m²',
  'Estudio de 45 m² recién pintado, con baño completo y cocina integrada al ambiente. Ideal para una persona sola. Incluye un puesto de estacionamiento y agua incluida en el condominio. A cinco minutos caminando del mercado y de la estación de transporte.',
  260,45,1,1,1,2,18,'Bueno',False),
 (47,'alquiler','Apartamento','Valencia','Los Colorados',
  'Apartamento 3 habitaciones en Los Colorados, 90 m²',
  'En piso 4 con ascensor. Sala-comedor, cocina con desayunador, tres habitaciones (la principal con baño), dos baños en total y cuarto de lavado. Un puesto de estacionamiento techado. Conjunto con área verde y vigilancia.',
  520,90,3,2,1,4,9,'Bueno',False),
 (67,'alquiler','Apartamento','Valencia','Guaparo',
  'Apartamento de 3 habitaciones en Guaparo, 110 m²',
  'Semiamoblado: incluye cocina equipada, clósets y aire acondicionado en las tres habitaciones. Sala-comedor amplia, dos baños, cuarto de servicio y balcón. Un puesto de estacionamiento cubierto. Disponible desde el 1 de noviembre.',
  750,110,3,2,1,7,8,'Excelente',False),
 (48,'alquiler','Apartamento','Valencia','Sabana Larga',
  'Alquiler en Sabana Larga: 3 habitaciones, 95 m²',
  'Apartamento familiar en piso 6, con vista al Ávila. Sala-comedor, cocina con espacio para nevera grande, tres habitaciones y dos baños. Un puesto de estacionamiento y maletero. El edificio cuenta con ascensor y vigilancia de 7 a.m. a 7 p.m.',
  480,95,3,2,1,6,14,'Bueno',False),
 (68,'alquiler','Apartamento','Valencia','Los Mangos',
  'Apartamento en alquiler en Los Mangos, 68 m²',
  'Dos habitaciones, un baño, sala-comedor y cocina. Piso 2 de un edificio pequeño de seis apartamentos. Se alquila sin muebles, con un puesto de estacionamiento. Zona residencial con supermercado y farmacia a una cuadra.',
  350,68,2,1,1,2,20,'Bueno',False),
 (9,'alquiler','Apartamento','Valencia','Trigal Centro',
  'Apartamento amoblado en Trigal Centro, 82 m²',
  'Amoblado completo, listo para mudarse. Dos habitaciones con aire acondicionado, dos baños, sala-comedor y cocina con nevera y microondas. Incluye televisor, wifi instalado y un puesto de estacionamiento. Cercano al CC Trigal y a la avenida Bolívar Norte.',
  600,82,2,2,1,5,11,'Excelente',True),
 (69,'alquiler','Apartamento','Valencia','El Bosque',
  'Alquiler de apartamento de 3 habitaciones en El Bosque',
  'Piso 3, 105 m², con sala-comedor, cocina amplia, tres habitaciones, dos baños y área de servicio independiente. Un puesto de estacionamiento descubierto. Comunidad organizada, con cuota de condominio baja. Se permiten mascotas pequeñas.',
  620,105,3,2,1,3,17,'Bueno',False),

 (49,'venta','Apartamento','San Diego','Terrazas de San Diego',
  'Apartamento en Terrazas de San Diego, 62 m²',
  'Segundo piso, con 62 m² y dos habitaciones. Sala-comedor, cocina con desayunador, un baño y área de lavado en el balcón. Un puesto de estacionamiento. Conjunto cerrado con vigilancia, áreas verdes y cancha múltiple.',
  24500,62,2,1,1,2,15,'Bueno',False),
 (50,'venta','Apartamento','San Diego','Colinas de San Diego',
  'Apartamento de 2 habitaciones en Colinas de San Diego',
  'Piso 6 con vista hacia la ciudad. 65 m², dos habitaciones, un baño, sala-comedor y cocina. Un puesto de estacionamiento techado. El edificio tiene planta eléctrica y vigilancia 24 horas. Mantenimiento mensual de USD 30.',
  28000,65,2,1,1,6,14,'Bueno',False),
 (51,'venta','Apartamento','San Diego','Monte Mayor',
  'Apartamento de 3 habitaciones en Monte Mayor, 86 m²',
  'Piso 9 con ascensor. Sala-comedor, cocina equipada, tres habitaciones y dos baños completos. Un puesto de estacionamiento. Incluye línea blanca: nevera, cocina y lavadora. Conjunto residencial con parque infantil y salón de usos múltiples.',
  68000,86,3,2,1,9,11,'Bueno',True),
 (56,'venta','Casa','San Diego','Lomas de San Diego',
  'Casa en Lomas de San Diego con patio y 2 puestos',
  'Casa de una planta sobre parcela de 300 m², con 210 m² construidos. Sala-comedor, cocina con isla, cuatro habitaciones, tres baños, patio techado y jardín. Estacionamiento para dos vehículos y cuarto de herramientas. Urbanización con vigilancia y portón eléctrico.',
  145000,210,4,3,2,None,12,'Excelente',False),
 (57,'venta','Townhouse','San Diego','El Remanso',
  'Townhouse de 3 habitaciones en El Remanso',
  'Conjunto cerrado de 24 unidades en El Remanso. 165 m² en dos plantas: sala-comedor, cocina con desayunador, family room en planta alta, tres habitaciones y dos baños y medio. Patio posterior con área de parrilla y estacionamiento para dos carros.',
  125000,165,3,2,2,None,8,'Excelente',False),
 (52,'venta','Apartamento','San Diego','Valle de Oro',
  'Apartamento en Valle de Oro, 95 m² y 3 habitaciones',
  'Tercer piso con ascensor. Sala-comedor amplia, cocina con desayunador, tres habitaciones, dos baños y cuarto de servicio. Dos puestos de estacionamiento. Edificio con vigilancia las 24 horas, cerca del Don Julio Centeno y de colegios de la zona.',
  72000,95,3,2,2,3,10,'Bueno',False),
 (55,'venta','Casa','San Diego','Poblado de San Diego',
  'Casa de 3 habitaciones en el Poblado de San Diego',
  'Ideal para remodelar: 180 m² construidos en una planta, sobre terreno de 250 m². Sala-comedor, cocina, tres habitaciones, dos baños, quincho y patio. Estacionamiento para dos vehículos. Ubicada a cinco minutos del centro de San Diego.',
  112000,180,3,2,2,None,22,'Regular',False),
 (53,'venta','Apartamento','San Diego','La Esmeralda',
  'Apartamento de 2 habitaciones en La Esmeralda, 60 m²',
  'Apartamento funcional en piso 4, con sala-comedor, dos habitaciones, un baño y cocina con espacio para lavadora. Un puesto de estacionamiento descubierto. Cerca de la avenida principal y de la zona comercial de La Esmeralda.',
  26000,60,2,1,1,4,13,'Bueno',False),

 (25,'alquiler','Apartamento','San Diego','Terrazas de San Diego',
  'Alquiler de apartamento de 2 habitaciones en San Diego',
  '62 m² en piso 2, con sala-comedor, cocina, dos habitaciones y un baño. Un puesto de estacionamiento. Sin amoblar. Disponible de inmediato, con depósito de un mes y contrato mínimo de 12 meses. Se permite una mascota pequeña.',
  340,62,2,1,1,2,15,'Bueno',False),
 (27,'alquiler','Apartamento','San Diego','Monte Mayor',
  'Apartamento amoblado en Monte Mayor, 85 m²',
  'Amoblado y equipado en piso 9. Tres habitaciones (la principal con baño), cocina con nevera y lavadora, sala-comedor y balcón. Un puesto de estacionamiento. El conjunto ofrece vigilancia, salón de fiestas y cancha. Incluye condominio.',
  520,85,3,2,1,9,11,'Excelente',True),
 (36,'alquiler','Apartamento','San Diego','Valle de Oro',
  'Apartamento en Valle de Oro, 59 m², para estudiante',
  'Estudio amplio con área de cocina separada, baño completo y espacio para escritorio. Amoblado básico: cama, clóset y nevera. Un puesto de estacionamiento. Se alquila a partir de un mes con contrato renovable, ideal para estudiantes o profesionales.',
  300,59,1,1,1,5,12,'Bueno',False),
 (54,'alquiler','Casa','San Diego','Poblado de San Diego',
  'Casa en alquiler en el Poblado de San Diego, 200 m²',
  'Casa de una planta con 200 m² construidos y patio de 100 m². Sala-comedor, cocina amplia, cuatro habitaciones, dos baños, área de servicio y estacionamiento para dos vehículos. Se alquila sin muebles, con contrato de 24 meses y depósito de dos meses.',
  850,200,4,2,2,None,20,'Bueno',False),
 (40,'alquiler','Apartamento','San Diego','El Remanso',
  'Townhouse en alquiler en El Remanso, 150 m²',
  'Townhouse de tres habitaciones en conjunto cerrado con vigilancia 24 horas. Sala-comedor, cocina con desayunador, dos baños y medio, patio y dos puestos de estacionamiento. Sin amoblar, con clósets empotrados y aire acondicionado en la habitación principal.',
  700,150,3,2,2,None,8,'Excelente',False),

 (13,'venta','Apartamento','Caracas','Chacao',
  'Apartamento de 2 habitaciones en Chacao, 95 m²',
  'Piso 8 de edificio con vigilancia 24 horas, a dos cuadras de la plaza Altamira Sur. 95 m² con sala-comedor, cocina con despensa, dos habitaciones con baño compartido y un baño de visita. Un puesto de estacionamiento y maletero. Cocina y baños remodelados en 2023.',
  185000,95,2,2,1,8,20,'Bueno',True),
 (15,'venta','Apartamento','Caracas','Altamira',
  'Apartamento 3 habitaciones en Altamira, 120 m²',
  'Ubicado en la avenida Luis Roche. 120 m² con sala-comedor con balcón, cocina con desayunador, tres habitaciones y tres baños. Un puesto de estacionamiento. Edificio con ascensor, planta eléctrica y vigilancia las 24 horas. Documentos en regla, se acepta financiamiento con bancos nacionales.',
  240000,120,3,3,1,6,18,'Bueno',False),
 (37,'venta','Apartamento','Caracas','La Castellana',
  'Apartamento en La Castellana, 140 m²',
  'Piso 10 con vista al Ávila. Sala-comedor, family room, cocina equipada, tres habitaciones y tres baños. Dos puestos de estacionamiento. Edificio con recepción, ascensor de servicio y planta eléctrica. A pocos metros del CC La Castellana.',
  310000,140,3,3,2,10,16,'Excelente',False),
 (38,'venta','Apartamento','Caracas','Los Palos Grandes',
  'Apartamento de 165 m² en Los Palos Grandes',
  'Reformado en 2022. Sala-comedor de doble ambiente, cocina abierta con isla, tres habitaciones (dos con baño privado), tres baños y cuarto de servicio. Dos puestos de estacionamiento. El edificio cuenta con gimnasio y vigilancia 24 horas.',
  365000,165,3,3,2,7,19,'Excelente',True),
 (29,'venta','Apartamento','Caracas','Bello Monte',
  'Apartamento de 2 habitaciones en Bello Monte, 90 m²',
  'Cerca del metro Bello Monte. 90 m² con sala-comedor, cocina, dos habitaciones y dos baños. Un puesto de estacionamiento. Edificio con vigilancia y ascensor. Ideal para quienes trabajan en el centro o en Las Mercedes.',
  125000,90,2,2,1,5,22,'Bueno',False),
 (30,'venta','Apartamento','Caracas','Los Chaguaramos',
  'Apartamento 3 habitaciones en Los Chaguaramos, 110 m²',
  'A media cuadra de la avenida Los Ilustres. Sala-comedor, cocina con desayunador, tres habitaciones, dos baños y área de lavado. Un puesto de estacionamiento. El edificio tiene planta eléctrica y cuenta con conserje permanente.',
  115000,110,3,2,1,4,25,'Bueno',False),
 (31,'venta','Casa','Caracas','La Trinidad',
  'Casa de 4 habitaciones en La Trinidad, 250 m²',
  'Casa en calle cerrada con vigilancia del sector. 250 m² en dos plantas: sala principal, family, comedor formal, cocina amplia, cuatro habitaciones (dos con baño), cuatro baños y estudio. Jardín con área de parrilla y estacionamiento para tres vehículos.',
  330000,250,4,4,3,None,15,'Bueno',False),
 (32,'venta','Apartamento','Caracas','El Paraíso',
  'Apartamento en El Paraíso, 130 m²',
  'Piso 4 con ascensor, frente a la avenida principal. Sala-comedor, cocina con office, tres habitaciones y dos baños. Un puesto de estacionamiento descubierto. Cerca de colegios, clínicas y estación de metro La Paz.',
  98000,130,3,2,1,4,28,'Bueno',False),
 (34,'venta','Apartamento','Caracas','Campo Alegre',
  'Penthouse en Campo Alegre con terraza, 180 m²',
  'Último piso con terraza de 40 m² y vista al Ávila. Sala-comedor, cocina equipada, tres habitaciones, tres baños y family. Dos puestos de estacionamiento. Edificio con vigilancia 24 horas, planta eléctrica y salón de fiestas.',
  390000,180,3,3,2,12,14,'Excelente',True),
 (35,'venta','Apartamento','Caracas','Las Mercedes',
  'Apartamento en Las Mercedes, 135 m²',
  'A dos cuadras de la avenida principal. Sala-comedor con balcón, cocina con isla, tres habitaciones y dos baños. Dos puestos de estacionamiento. Edificio de poca densidad, con ascensor y vigilancia. Excelente opción para vivir o para alquilar amoblado.',
  285000,135,3,2,2,9,17,'Excelente',False),

 (1,'alquiler','Apartamento','Caracas','Los Palos Grandes',
  'Apartamento amoblado en Los Palos Grandes, 75 m²',
  'Amoblado y equipado, listo para habitar. Dos habitaciones (una con cama queen), un baño completo, sala-comedor, cocina con nevera y microondas. Incluye aire acondicionado, internet y limpieza semanal opcional. Un puesto de estacionamiento. Contrato mínimo de seis meses.',
  800,75,2,1,1,7,16,'Excelente',True),
 (76,'alquiler','Apartamento','Caracas','Chacao',
  'Alquiler de apartamento 2 habitaciones en Chacao',
  '90 m² en piso 5, sin amoblar. Sala-comedor, cocina con desayunador, dos habitaciones y dos baños. Un puesto de estacionamiento. Edificio con vigilancia y ascensor. A cinco minutos caminando de la estación de metro Chacao.',
  700,90,2,2,1,5,20,'Bueno',False),
 (11,'alquiler','Apartamento','Caracas','Altamira',
  'Apartamento de 3 habitaciones en Altamira, 110 m²',
  'Semiamoblado con línea blanca incluida. Sala-comedor con balcón, cocina, tres habitaciones y dos baños. Un puesto de estacionamiento. El edificio dispone de planta eléctrica y vigilancia 24 horas. Disponible desde diciembre.',
  950,110,3,2,1,8,15,'Bueno',False),
 (78,'alquiler','Apartamento','Caracas','La Candelaria',
  'Apartamento en La Candelaria, 55 m²',
  'Apartamento de una habitación en piso 3, con sala-comedor, cocina y baño completo. Sin amoblar. Cerca de la avenida Baralt y del mercado de Quinta Crespo. Ideal para una persona o pareja, con gastos de condominio bajos.',
  380,55,1,1,0,3,26,'Bueno',False),
 (79,'alquiler','Casa','Caracas','Los Chorros',
  'Casa en alquiler en Los Chorros, 130 m²',
  'Casa de dos plantas en calle cerrada. Sala-comedor, cocina con desayunador, tres habitaciones, dos baños y medio, patio y área de servicio. Estacionamiento para dos vehículos. Se alquila sin muebles, con contrato de 12 meses y depósito de un mes.',
  1200,130,3,2,2,None,24,'Bueno',False),
 (14,'alquiler','Apartamento','Caracas','El Rosal',
  'Apartamento de 2 habitaciones en El Rosal, 95 m²',
  'Piso 6 con vista despejada. Sala-comedor, cocina, dos habitaciones con clósets y dos baños. Un puesto de estacionamiento y maletero. Edificio con vigilancia de lunes a sábado y ascensor. Cerca de la avenida Francisco de Miranda.',
  650,95,2,2,1,6,21,'Bueno',False),
 (12,'alquiler','Apartamento','Caracas','Santa Fe',
  'Apartamento en Santa Fe, 140 m² y 3 habitaciones',
  'Amplio y luminoso, en piso 4. Sala-comedor, family, cocina con desayunador, tres habitaciones y tres baños. Dos puestos de estacionamiento. Conjunto residencial con áreas verdes, vigilancia y planta eléctrica. Se alquila sin muebles.',
  1100,140,3,3,2,4,13,'Excelente',False),
]

assert len(L) == 50, len(L)
ids = [x[0] for x in L]
assert len(set(ids)) == 50, 'imágenes repetidas'
missing = [i for i in ids if i not in IMG]
assert not missing, missing
print('fichas:', len(L))

# ── Generación de assets + SQL ────────────────────────────────────────────────
OUT_IMG = 'public/propiedades'
os.makedirs(OUT_IMG, exist_ok=True)
os.makedirs('supabase/seeds', exist_ok=True)

def q(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

TIPO_ID = {'Apartamento':1,'Casa':2,'Townhouse':3,'Local comercial':5}
OP_ID = {'venta':1,'alquiler':2}
USER_ID = '38b802d2-7f26-4c88-a105-5df28473df1f'
BASE = datetime.datetime(2026, 10, 30, 12, 0, 0)
rnd = random.Random(20261030)

rows = []
for n, (img_id, op, tipo, ciudad, zona, titulo, desc, precio, area, hab, banos, puestos, piso, antiguedad, condicion, destacado) in enumerate(L, 1):
    src = os.path.join('image-search', IMG[img_id])
    dst = os.path.join(OUT_IMG, f'prop-{n:02d}.jpg')
    subprocess.run(['convert', src, '-auto-orient', '-resize', '1400x1400>', '-strip',
                    '-quality', '82', '-colorspace', 'sRGB', dst], check=True)
    lat, lng = COORD[(ciudad, zona)]
    lat += rnd.uniform(-0.0022, 0.0022)
    lng += rnd.uniform(-0.0022, 0.0022)
    publicado = BASE - datetime.timedelta(days=rnd.randint(2, 120), hours=rnd.randint(0, 23))
    estado_id = {'Caracas':'distrito-capital','Valencia':'carabobo','San Diego':'carabobo'}[ciudad]
    rows.append(dict(
        n=n, img=f'/propiedades/prop-{n:02d}.jpg', op=op, tipo=tipo, ciudad=ciudad,
        estado=ESTADO[ciudad], municipio=MUNI[ciudad][zona], zona=zona, titulo=titulo,
        desc=desc, precio=precio, area=area, hab=hab, banos=banos, puestos=puestos,
        piso=piso, antiguedad=antiguedad, condicion=condicion, destacado=destacado,
        lat=round(lat, 7), lng=round(lng, 7), estado_id=estado_id,
        publicado=publicado.strftime('%Y-%m-%d %H:%M:%S+00'),
        visitas=rnd.randint(35, 940),
    ))

values = []
for r in rows:
    values.append('(' + ', '.join([
        q(USER_ID), q(r['titulo']), q(r['desc']), str(OP_ID[r['op']]), str(TIPO_ID[r['tipo']]),
        q(r['estado']), q(r['ciudad']), q(r['estado_id']), q(r['municipio']), q(r['zona']),
        str(r['lat']), str(r['lng']), str(r['precio']), q('USD'), str(r['area']), str(r['area']),
        str(r['hab']), str(r['banos']), str(r['puestos']), q(r['piso']) if r['piso'] else 'null',
        q(r['condicion']), str(r['antiguedad']), q(r['img']), str(r['destacado']).lower(),
        str(r['visitas']), q(r['publicado']), q(r['publicado']),
    ]) + ')')

sql = """-- 50 fichas de ejemplo con fotos reales de inmuebles en Valencia, San Diego y Caracas.
-- Precios, áreas y ubicaciones construidos sobre rangos de mercado verificados para 2026.
-- Ejecutar en el proyecto Supabase (SQL editor) o con `supabase db push` tras revisar.
begin;

insert into public.inmuebles
  (usuario_id, titulo, descripcion, operacion_id, tipo_id, estado, ciudad, ubicacion_estado_id,
   municipio, zona, latitud, longitud, precio, moneda, area_total, area_construida,
   habitaciones, banos, puestos_estacionamiento, piso, condicion, antiguedad_anios,
   imagen_url, destacado, visitas, creado_en, publicado_en)
values
""" + ',\n'.join(values) + """;

insert into public.inmueble_imagenes (inmueble_id, url_imagen, orden, es_portada)
select id, imagen_url, 0, true
from public.inmuebles
where usuario_id = '38b802d2-7f26-4c88-a105-5df28473df1f'
  and imagen_url like '/propiedades/prop-%'
  and not exists (select 1 from public.inmueble_imagenes ii where ii.inmueble_id = inmuebles.id);

commit;
"""

with open('supabase/seeds/2026-10-30_propiedades_demo.sql', 'w', encoding='utf-8') as fh:
    fh.write(sql)
print('SQL generado:', len(sql), 'bytes')
