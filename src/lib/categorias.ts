export interface CatField {
  label: string
  type: 'text' | 'number' | 'select'
  placeholder: string
  options?: string[]
}

export interface CatSub {
  label: string
  icon: string
  marcas: string[]
  campos: CatField[]
}

let _anos: string[] | undefined
function aniosSelect(): string[] {
  if (!_anos) {
    const c = new Date().getFullYear()
    _anos = Array.from({ length: 30 }, (_, i) => String(c - i))
  }
  return _anos
}

const campoAnio = { label: 'Año', type: 'select' as const, placeholder: 'Selecciona...' }
const campoColor = { label: 'Color', type: 'text' as const, placeholder: 'Ej: Blanco' }

export const categoriasData: Record<string, { label: string; icon: string; subs: CatSub[] }> = {
  vehiculos: {
    label: 'Vehículos',
    icon: '🚗',
    subs: [
      { label: 'Carros', icon: '🚗', marcas: ['Toyota', 'Ford', 'Chevrolet', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'BMW', 'Mercedes-Benz', 'Mazda', 'Renault', 'Peugeot', 'Suzuki', 'Volkswagen', 'Audi', 'Seat', 'Fiat', 'Skoda', 'Volvo', 'Subaru', 'Chery', 'Great Wall'], campos: [campoAnio, { label: 'Kilometraje (km)', type: 'number' as const, placeholder: 'Ej: 45000' }, { label: 'Transmisión', type: 'select' as const, placeholder: 'Selecciona...', options: ['Automática', 'Manual', 'CVT'] }, { label: 'Combustible', type: 'select' as const, placeholder: 'Selecciona...', options: ['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'] }, campoColor] },
      { label: 'Camionetas/SUV', icon: '🚙', marcas: ['Toyota', 'Ford', 'Chevrolet', 'Jeep', 'Nissan', 'Hyundai', 'Kia', 'Mitsubishi', 'Honda', 'VW', 'BMW', 'Mercedes-Benz', 'Mazda', 'Land Rover', 'Great Wall', 'Chery', 'Haval'], campos: [campoAnio, { label: 'Tracción', type: 'select' as const, placeholder: 'Selecciona...', options: ['4x2', '4x4', 'AWD'] }, { label: 'Transmisión', type: 'select' as const, placeholder: 'Selecciona...', options: ['Automática', 'Manual'] }, campoColor] },
      { label: 'Motos', icon: '🏍️', marcas: ['Yamaha', 'Bera', 'Empire', 'Venom', 'Honda', 'Suzuki', 'Bajaj', 'Keeway', 'Haolue', 'Italika', 'Vento', 'KTM', 'Hero', 'Zongshen', 'Benelli', 'TVS', 'AKT'], campos: [campoAnio, { label: 'Cilindraje', type: 'select' as const, placeholder: 'Selecciona...', options: ['50cc', '110cc', '125cc', '150cc', '200cc', '250cc', '300cc+', 'Eléctrica'] }, { label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Calletera', 'Deportiva', 'Cross/Enduro', 'Scooter', 'Triciclo', 'De trabajo'] }, campoColor] },
      { label: 'Camiones', icon: '🚛', marcas: ['Hino', 'Isuzu', 'Freightliner', 'Hyundai', 'Foton', 'Ford', 'Toyota', 'International'], campos: [{ label: 'Capacidad de carga (ton)', type: 'number' as const, placeholder: 'Ej: 5' }, { label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Furgón', 'Plataforma', 'Volteo', 'Cisterna', 'Refrigerado'] }] },
      { label: 'Furgonetas', icon: '🚐', marcas: ['Ford', 'Chevrolet', 'VW', 'Renault', 'Iveco', 'Hyundai', 'Foton'], campos: [campoAnio, campoColor] },
      { label: 'Autobuses/Buses', icon: '🚌', marcas: ['Yutong', 'King Long', 'VW', 'Chevrolet'], campos: [{ label: 'Pasajeros', type: 'number' as const, placeholder: 'Ej: 40' }, campoAnio] },
      { label: 'Repuestos y Accesorios', icon: '⚙️', marcas: ['OEM', 'Genérico', 'Original'], campos: [{ label: 'Compatible con', type: 'text' as const, placeholder: 'Ej: Toyota Corolla 2015' }] },
    ],
  },
  tecnologia: {
    label: 'Tecnología',
    icon: '💻',
    subs: [
      { label: 'Celulares', icon: '📱', marcas: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Motorola', 'Oppo', 'Realme', 'Nokia', 'Infinix', 'Tecno', 'ZTE', 'OnePlus'], campos: [{ label: 'Modelo', type: 'text' as const, placeholder: 'Ej: iPhone 15 Pro Max' }, { label: 'Almacenamiento', type: 'select' as const, placeholder: 'Selecciona...', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] }, { label: 'RAM', type: 'select' as const, placeholder: 'Selecciona...', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB'] }, campoColor] },
      { label: 'Laptops', icon: '💻', marcas: ['Apple', 'HP', 'Lenovo', 'Dell', 'Asus', 'Acer', 'MSI', 'Samsung', 'Huawei'], campos: [{ label: 'Procesador', type: 'text' as const, placeholder: 'Ej: M2, i7-12700H' }, { label: 'RAM', type: 'select' as const, placeholder: 'Selecciona...', options: ['8GB', '16GB', '32GB'] }, { label: 'Almacenamiento', type: 'select' as const, placeholder: 'Selecciona...', options: ['256GB SSD', '512GB SSD', '1TB SSD', '1TB+'] }] },
      { label: 'Tablets', icon: '📲', marcas: ['Apple', 'Samsung', 'Huawei', 'Lenovo', 'Xiaomi', 'Amazon'], campos: [{ label: 'Modelo', type: 'text' as const, placeholder: 'Ej: iPad Air 5' }, { label: 'Pantalla', type: 'text' as const, placeholder: 'Ej: 10.9"' }] },
      { label: 'PC de Escritorio', icon: '🖥️', marcas: ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Armado', 'Genérico'], campos: [{ label: 'Procesador', type: 'text' as const, placeholder: 'Ej: R5 5600X' }, { label: 'RAM', type: 'select' as const, placeholder: 'Selecciona...', options: ['8GB', '16GB', '32GB', '64GB'] }, { label: 'GPU', type: 'text' as const, placeholder: 'Ej: RTX 3060' }] },
      { label: 'Monitores', icon: '🖥️', marcas: ['Samsung', 'LG', 'AOC', 'Asus', 'Dell', 'BenQ', 'MSI'], campos: [{ label: 'Tamaño', type: 'select' as const, placeholder: 'Selecciona...', options: ['21"', '23-24"', '27"', '32"', '34"+'] }, { label: 'Resolución', type: 'select' as const, placeholder: 'Selecciona...', options: ['1080p', '1440p', '4K'] }] },
      { label: 'Consolas', icon: '🎮', marcas: ['PlayStation', 'Xbox', 'Nintendo'], campos: [{ label: 'Modelo', type: 'select' as const, placeholder: 'Selecciona...', options: ['PS5', 'PS5 Digital', 'PS4 Pro', 'Xbox Series X', 'Xbox Series S', 'Nintendo Switch', 'Switch OLED', 'Steam Deck'] }] },
      { label: 'Audio', icon: '🎧', marcas: ['JBL', 'Bose', 'Sony', 'Apple', 'Xiaomi', 'Anker', 'Sennheiser'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Audífonos cable', 'Audífonos BT', 'Bocina', 'Barra de sonido', 'Parlantes', 'Micrófono'] }] },
      { label: 'Cámaras', icon: '📷', marcas: ['Canon', 'Nikon', 'Sony', 'GoPro', 'DJI', 'Fujifilm'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['DSLR', 'Mirrorless', 'Acción', 'Drone', 'IPC'] }] },
      { label: 'Impresoras', icon: '🖨️', marcas: ['HP', 'Epson', 'Canon', 'Brother'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Inyección tinta', 'Láser', 'Multifuncional', '3D'] }] },
      { label: 'Redes', icon: '📡', marcas: ['TP-Link', 'Mercusys', 'Tenda', 'Netgear', 'D-Link', 'Huawei'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Router', 'Mesh', 'Repetidor', 'Switch', 'Access Point'] }] },
      { label: 'Accesorios y Periféricos', icon: '🖱️', marcas: ['Logitech', 'Razer', 'Corsair', 'Redragon', 'Anker'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Teclado mecánico, mouse...' }] },
      { label: 'Smartwatches', icon: '⌚', marcas: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Garmin', 'Amazfit'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Smartwatch', 'Banda fitness', 'Deportivo'] }] },
    ],
  },
  moda: {
    label: 'Moda',
    icon: '👗',
    subs: [
      { label: 'Ropa Hombre', icon: '👔', marcas: ['Zara', 'H&M', 'Nike', 'Adidas', 'Calvin Klein', 'Tommy Hilfiger', 'Levi\'s', 'Ralph Lauren', 'Under Armour', 'Puma'], campos: [{ label: 'Talla', type: 'select' as const, placeholder: 'Selecciona...', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }, campoColor] },
      { label: 'Ropa Mujer', icon: '👗', marcas: ['Zara', 'H&M', 'Mango', 'Shein', 'Nike', 'Adidas', 'Guess', 'Victoria\'s Secret'], campos: [{ label: 'Talla', type: 'select' as const, placeholder: 'Selecciona...', options: ['XS', 'S', 'M', 'L', 'XL'] }, campoColor] },
      { label: 'Calzado Hombre', icon: '👞', marcas: ['Nike', 'Adidas', 'New Balance', 'Puma', 'Converse', 'Vans', 'Timberland', 'Skechers', 'Crocs'], campos: [{ label: 'Talla', type: 'select' as const, placeholder: 'Selecciona...', options: ['38', '39', '40', '41', '42', '43', '44', '45'] }, { label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Deportivo', 'Casual', 'Formal', 'Botas', 'Sandalias'] }, campoColor] },
      { label: 'Calzado Mujer', icon: '👠', marcas: ['Nike', 'Adidas', 'New Balance', 'Steve Madden', 'Zara', 'Birkenstock', 'Skechers', 'Crocs'], campos: [{ label: 'Talla', type: 'select' as const, placeholder: 'Selecciona...', options: ['34', '35', '36', '37', '38', '39', '40'] }, { label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Deportivo', 'Tacón', 'Sandalia', 'Bota', 'Plataforma', 'Flat'] }, campoColor] },
      { label: 'Relojes', icon: '⌚', marcas: ['Casio', 'Citizen', 'Seiko', 'Rolex', 'G-Shock', 'Michael Kors', 'Fossil', 'Apple', 'Samsung'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Analógico', 'Digital', 'Smartwatch', 'Deportivo'] }] },
      { label: 'Bolsos y Mochilas', icon: '🎒', marcas: ['Coach', 'Michael Kors', 'Nike', 'Adidas', 'JanSport', 'Samsonite'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Mochila', 'Bolso', 'Bandolera', 'Maleta', 'Cartera'] }] },
      { label: 'Accesorios', icon: '🧣', marcas: ['Ray-Ban', 'Oakley', 'Gucci'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Gafas, gorra, cinturón...' }] },
      { label: 'Ropa Niños', icon: '👶', marcas: ['Zara Kids', 'H&M Kids', 'Carters'], campos: [{ label: 'Edad/Talla', type: 'text' as const, placeholder: 'Ej: 4 años' }] },
      { label: 'Joyería', icon: '💍', marcas: ['Pandora', 'Swarovski', 'Artesanal', 'Genérico'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Anillo, collar...' }] },
    ],
  },
  hogar: {
    label: 'Hogar',
    icon: '🏠',
    subs: [
      { label: 'Muebles', icon: '🛋️', marcas: ['Genérico', 'Artesanal', 'IKEA'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Sofá/Cama', 'Mesa', 'Silla', 'Closet', 'Escritorio', 'Repisa', 'Mesa de noche'] }, { label: 'Material', type: 'text' as const, placeholder: 'Ej: Madera, cuero...' }] },
      { label: 'Electrodomésticos', icon: '📺', marcas: ['Samsung', 'LG', 'Mabe', 'Daewoo', 'Whirlpool', 'Indurama', 'Philips', 'Oster'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Lavadora', 'Secadora', 'Nevera', 'Cocina', 'Horno', 'Microondas', 'Aire acondicionado', 'Licuadora', 'Aspiradora'] }, { label: 'Capacidad', type: 'text' as const, placeholder: 'Ej: 18kg, 400L' }] },
      { label: 'Decoración', icon: '🖼️', marcas: ['Genérico', 'Artesanal'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Cuadro, lámpara, jarrón...' }] },
      { label: 'Cocina', icon: '🍳', marcas: ['Tramontina', 'Oster', 'T-fal', 'Imusa'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Olla, sartén, cuchillo...' }] },
      { label: 'Electrónica del Hogar', icon: '💡', marcas: ['Philips', 'Samsung', 'LG', 'Xiaomi', 'TP-Link'], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['TV', 'Bombillo inteligente', 'Cámara seguridad', 'Router', 'Aspirador robot'] }] },
      { label: 'Jardín', icon: '🌿', marcas: ['Genérico'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Manguera, maceta...' }] },
    ],
  },
  herramientas: {
    label: 'Herramientas',
    icon: '🔧',
    subs: [
      { label: 'Manuales', icon: '🔧', marcas: ['Stanley', 'Truper', 'Craftsman', 'Vorel', 'DeWalt'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Llave, destornillador...' }] },
      { label: 'Eléctricas', icon: '⚡', marcas: ['DeWalt', 'Makita', 'Bosch', 'Milwaukee', 'Black+Decker'], campos: [{ label: 'Voltaje', type: 'text' as const, placeholder: 'Ej: 18V, 110V' }, { label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Taladro, sierra...' }] },
      { label: 'De Jardín', icon: '🌱', marcas: ['Stihl', 'Husqvarna', 'Truper'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Cortacésped, motosierra...' }] },
    ],
  },
  repuestos: {
    label: 'Repuestos',
    icon: '⚙️',
    subs: [
      { label: 'Carros', icon: '🚗', marcas: ['Toyota', 'Ford', 'Chevrolet', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'BMW', 'Mercedes-Benz', 'Mazda', 'Renault', 'Peugeot', 'Suzuki', 'Volkswagen', 'Audi', 'Seat', 'Fiat', 'Chery', 'Great Wall'], campos: [{ label: 'Marca', type: 'select' as const, placeholder: 'Selecciona marca...' }, { label: 'Modelo', type: 'text' as const, placeholder: 'Ej: Corolla' }, { label: 'Tipo de repuesto', type: 'text' as const, placeholder: 'Ej: Filtro, pastillas de freno...' }] },
      { label: 'Motos', icon: '🏍️', marcas: ['Yamaha', 'Bera', 'Empire', 'Venom', 'Honda', 'Suzuki', 'Bajaj', 'Keeway', 'Haolue', 'Italika', 'TVS', 'AKT'], campos: [{ label: 'Marca', type: 'select' as const, placeholder: 'Selecciona marca...' }, { label: 'Modelo', type: 'text' as const, placeholder: 'Ej: FZ 150' }, { label: 'Tipo de repuesto', type: 'text' as const, placeholder: 'Ej: Cadena, carburador...' }] },
    ],
  },
  materiales: {
    label: 'Materiales',
    icon: '🧱',
    subs: [
      { label: 'Construcción', icon: '🏗️', marcas: [], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Cemento, arena, bloques, cabillas...' }] },
      { label: 'Eléctricos', icon: '⚡', marcas: [], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Cable, breaker, tomacorriente...' }] },
      { label: 'Plomería', icon: '🔧', marcas: [], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Tubo PVC, grifería, válvula...' }] },
    ],
  },
  otros: {
    label: 'Otros',
    icon: '📦',
    subs: [
      { label: 'Deportes y Fitness', icon: '🏋️', marcas: ['Nike', 'Adidas', 'Under Armour', 'Reebok'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Mancuerna, bicicleta, pelota...' }] },
      { label: 'Música', icon: '🎸', marcas: ['Yamaha', 'Fender', 'Roland', 'Korg'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Guitarra, sintetizador...' }] },
      { label: 'Libros', icon: '📚', marcas: ['Editorial'], campos: [{ label: 'Género', type: 'text' as const, placeholder: 'Ej: Ficción, técnica...' }] },
      { label: 'Juguetes', icon: '🧸', marcas: ['Lego', 'Hasbro', 'Funko'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: LEGO, muñeco, juego de mesa...' }] },
      { label: 'Mascotas', icon: '🐶', marcas: ['Genérico'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Correa, juguete, cama...' }] },
      { label: 'Inmuebles', icon: '🏢', marcas: [], campos: [{ label: 'Tipo', type: 'select' as const, placeholder: 'Selecciona...', options: ['Apartamento', 'Casa', 'Local', 'Terreno', 'Oficina'] }, { label: 'm²', type: 'number' as const, placeholder: 'Ej: 120' }] },
      { label: 'Servicios', icon: '🔨', marcas: [], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Plomería, electricidad...' }] },
      { label: 'Coleccionables', icon: '🏆', marcas: ['Funko'], campos: [{ label: 'Tipo', type: 'text' as const, placeholder: 'Ej: Funko Pop, moneda antigua...' }] },
      { label: 'Otro', icon: '📦', marcas: [], campos: [] },
    ],
  },
}

// Flat list of all subcategories by category key for quick lookup
export function getSubByCategory(catKey: string): { label: string; icon: string }[] {
  const cat = categoriasData[catKey]
  return cat ? cat.subs.map(s => ({ label: s.label, icon: s.icon })) : []
}

export function getSubConfig(catKey: string, subLabel: string): CatSub | undefined {
  const cat = categoriasData[catKey]
  if (!cat) return undefined
  return cat.subs.find(s => s.label === subLabel)
}

export function getMarcaOptions(catKey: string, subLabel: string): string[] {
  const sub = getSubConfig(catKey, subLabel)
  return sub ? sub.marcas : []
}
