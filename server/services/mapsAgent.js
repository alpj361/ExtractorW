// ===================================================================
// AGENTE MAPS - EXPERTO EN GEOGRAFÍA GUATEMALTECA
// Maneja normalización, detección y mapeo de ubicaciones
// ===================================================================

const { geminiChat } = require('./geminiHelper');

/**
 * DOCUMENTO DE MAPEO COMPLETO DE GUATEMALA
 * Incluye departamentos, municipios, aliases culturales y zonas
 */
const GUATEMALA_MAPPING = {
  // Departamentos con sus municipios principales
  departments: {
    'Alta Verapaz': {
      municipalities: [
        'Cobán', 'Santa Cruz Verapaz', 'San Cristóbal Verapaz', 'Tactic', 'Tamahú',
        'Tucurú', 'Panzós', 'Senahú', 'San Pedro Carchá', 'San Juan Chamelco',
        'Lanquín', 'Cahabón', 'Chisec', 'Chahal', 'Fray Bartolomé de las Casas',
        'Santa Catalina la Tinta', 'San Agustín Lanquín'
      ],
      aliases: ['las verapaces', 'av', 'coban region'],
      zones: {
        'Zona 1': ['Cobán Centro'],
        'Zona 2': ['Cobán Norte']
      }
    },
    'Baja Verapaz': {
      municipalities: [
        'Salamá', 'San Miguel Chicaj', 'Rabinal', 'Cubulco', 'Granados',
        'El Chol', 'San Jerónimo', 'Purulhá'
      ],
      aliases: ['bv', 'salama region'],
      zones: {}
    },
    'Chimaltenango': {
      municipalities: [
        'Chimaltenango', 'San José Poaquil', 'San Martín Jilotepeque', 'Comalapa',
        'Santa Apolonia', 'Tecpán Guatemala', 'Patzún', 'Pochuta', 'Patzicía',
        'Santa Cruz Balanyá', 'Acatenango', 'Yepocapa', 'San Andrés Itzapa',
        'Parramos', 'Zaragoza', 'El Tejar'
      ],
      aliases: ['chimal', 'tecpan region'],
      zones: {}
    },
    'Chiquimula': {
      municipalities: [
        'Chiquimula', 'San José la Arada', 'San Juan Ermita', 'Jocotán',
        'Camotán', 'Olopa', 'Esquipulas', 'Concepción Las Minas',
        'Quezaltepeque', 'San Jacinto', 'Ipala'
      ],
      aliases: ['ch', 'esquipulas region'],
      zones: {}
    },
    'El Progreso': {
      municipalities: [
        'El Jícaro', 'Morazán', 'San Agustín Acasaguastlán', 'San Cristóbal Acasaguastlán',
        'El Progreso', 'Sansare', 'Guastatoya', 'Sanarate'
      ],
      aliases: ['progreso', 'guastatoya region'],
      zones: {}
    },
    'Escuintla': {
      municipalities: [
        'Escuintla', 'Santa Lucía Cotzumalguapa', 'La Democracia', 'Siquinalá',
        'Masagua', 'Tiquisate', 'La Gomera', 'Guanagazapa', 'San José',
        'Iztapa', 'Palín', 'San Vicente Pacaya', 'Nueva Concepción', 'Taxisco'
      ],
      aliases: ['puerto san jose', 'costa sur'],
      zones: {}
    },
    'Guatemala': {
      municipalities: [
        'Guatemala', 'Santa Catarina Pinula', 'San José Pinula', 'San José del Golfo',
        'Palencia', 'Chinautla', 'San Pedro Ayampuc', 'Mixco', 'San Pedro Sacatepéquez',
        'San Juan Sacatepéquez', 'San Raymundo', 'Chuarrancho', 'Fraijanes',
        'Amatitlán', 'Villa Nueva', 'Villa Canales', 'Petapa'
      ],
      aliases: ['la capital', 'ciudad de guatemala', 'guate', 'la ciudad'],
      zones: {
        'Zona 1': ['Centro Histórico', 'Palacio Nacional', 'Catedral'],
        'Zona 2': ['Zona 2'],
        'Zona 3': ['Zona 3'],
        'Zona 4': ['Centro Cívico', 'Banco de Guatemala'],
        'Zona 5': ['Zona 5'],
        'Zona 6': ['Zona 6'],
        'Zona 7': ['Zona 7', 'Kaminal Juyú'],
        'Zona 8': ['Zona 8'],
        'Zona 9': ['Zona 9'],
        'Zona 10': ['Zona Viva', 'Zona Rosa', 'Oakland Mall'],
        'Zona 11': ['Zona 11'],
        'Zona 12': ['Zona 12'],
        'Zona 13': ['Zona 13', 'Aeropuerto Internacional'],
        'Zona 14': ['Zona 14'],
        'Zona 15': ['Zona 15'],
        'Zona 16': ['Zona 16'],
        'Zona 17': ['Zona 17'],
        'Zona 18': ['Zona 18'],
        'Zona 19': ['Zona 19'],
        'Zona 21': ['Zona 21'],
        'Zona 24': ['Zona 24'],
        'Zona 25': ['Zona 25']
      }
    },
    'Huehuetenango': {
      municipalities: [
        'Huehuetenango', 'Chiantla', 'Malacatancito', 'Cuilco', 'Nentón',
        'San Pedro Necta', 'Jacaltenango', 'San Pedro Soloma', 'San Ildefonso Ixtahuacán',
        'Santa Bárbara', 'La Libertad', 'La Democracia', 'San Miguel Acatán',
        'San Rafael La Independencia', 'Todos Santos Cuchumatán', 'San Juan Atitán',
        'Santa Eulalia', 'San Mateo Ixtatán', 'Colotenango', 'San Sebastián Huehuetenango',
        'Tectitán', 'Concepción Huista', 'San Juan Ixcoy', 'San Antonio Huista',
        'San Sebastián Coatán', 'Barillas', 'Aguacatán', 'San Rafael Petzal',
        'San Gaspar Ixchil', 'Santiago Chimaltenango', 'Santa Ana Huista'
      ],
      aliases: ['huehue', 'frontera mexico'],
      zones: {}
    },
    'Izabal': {
      municipalities: [
        'Puerto Barrios', 'Livingston', 'El Estor', 'Morales', 'Los Amates'
      ],
      aliases: ['el puerto', 'caribe guatemala', 'costa atlantica'],
      zones: {}
    },
    'Jalapa': {
      municipalities: [
        'Jalapa', 'San Pedro Pinula', 'San Luis Jilotepeque', 'San Manuel Chaparrón',
        'San Carlos Alzatate', 'Monjas', 'Mataquescuintla'
      ],
      aliases: ['jalapa region'],
      zones: {}
    },
    'Jutiapa': {
      municipalities: [
        'Jutiapa', 'El Progreso', 'Santa Catarina Mita', 'Agua Blanca',
        'Asunción Mita', 'Yupiltepeque', 'Atescatempa', 'Jerez',
        'El Adelanto', 'Zapotitlán', 'Comapa', 'Jalpatagua',
        'Conguaco', 'Moyuta', 'Pasaco', 'San José Acatempa', 'Quesada'
      ],
      aliases: ['frontera el salvador'],
      zones: {}
    },
    'Petén': {
      municipalities: [
        'Flores', 'San José', 'San Benito', 'San Andrés', 'La Libertad',
        'San Francisco', 'Santa Ana', 'Dolores', 'San Luis', 'Sayaxché',
        'Melchor de Mencos', 'Poptún'
      ],
      aliases: ['el norte', 'tikal', 'flores region'],
      zones: {}
    },
    'Quetzaltenango': {
      municipalities: [
        'Quetzaltenango', 'Salcajá', 'Olintepeque', 'San Carlos Sija', 'Sibilia',
        'Cabricán', 'Cajolá', 'San Miguel Sigüilá', 'Ostuncalco', 'San Mateo',
        'Concepción Chiquirichapa', 'San Martín Sacatepéquez', 'Almolonga',
        'Cantel', 'Huitán', 'Zunil', 'Colomba Costa Cuca', 'San Francisco La Unión',
        'El Palmar', 'Coatepeque', 'Génova', 'Flores Costa Cuca', 'La Esperanza',
        'Palestina de Los Altos'
      ],
      aliases: ['xela', 'occidente', 'altiplano'],
      zones: {}
    },
    'Quiché': {
      municipalities: [
        'Santa Cruz del Quiché', 'Chiché', 'Chinique', 'Zacualpa', 'Chajul',
        'Chichicastenango', 'Patzité', 'San Antonio Ilotenango', 'San Pedro Jocopilas',
        'Cunén', 'San Juan Cotzal', 'Joyabaj', 'Nebaj', 'San Andrés Sajcabajá',
        'San Miguel Uspantán', 'Sacapulas', 'San Bartolomé Jocotenango',
        'Canillá', 'Chicamán', 'Ixcán', 'Pachalum'
      ],
      aliases: ['quiche', 'triangulo ixil'],
      zones: {}
    },
    'Retalhuleu': {
      municipalities: [
        'Retalhuleu', 'San Sebastián', 'Santa Cruz Muluá', 'San Martín Zapotitlán',
        'San Felipe', 'San Andrés Villa Seca', 'Champerico', 'Nuevo San Carlos',
        'El Asintal'
      ],
      aliases: ['reu', 'champerico', 'costa sur'],
      zones: {}
    },
    'Sacatepéquez': {
      municipalities: [
        'Antigua Guatemala', 'Jocotenango', 'Pastores', 'Sumpango',
        'Santo Domingo Xenacoj', 'Santiago Sacatepéquez', 'San Bartolomé Milpas Altas',
        'San Lucas Sacatepéquez', 'Santa Lucía Milpas Altas', 'Magdalena Milpas Altas',
        'Santa María de Jesús', 'Ciudad Vieja', 'San Miguel Dueñas',
        'Alotenango', 'San Antonio Aguas Calientes', 'Santa Catarina Barahona'
      ],
      aliases: ['antigua', 'colonial', 'volcan de agua'],
      zones: {}
    },
    'San Marcos': {
      municipalities: [
        'San Marcos', 'San Pedro Sacatepéquez', 'San Antonio Sacatepéquez',
        'Comitancillo', 'San Miguel Ixtahuacán', 'Concepción Tutuapa',
        'Tacaná', 'Sibinal', 'Tajumulco', 'Tejutla', 'San Rafael Pie de la Cuesta',
        'Nuevo Progreso', 'El Tumbador', 'El Rodeo', 'Malacatán',
        'Catarina', 'Ayutla', 'Ocós', 'San Pablo', 'El Quetzal',
        'La Reforma', 'Pajapita', 'Ixchiguán', 'San José Ojetenam',
        'San Cristóbal Cucho', 'Sipacapa', 'Esquipulas Palo Gordo',
        'Río Blanco', 'San Lorenzo'
      ],
      aliases: ['frontera mexico', 'volcan tajumulco'],
      zones: {}
    },
    'Santa Rosa': {
      municipalities: [
        'Cuilapa', 'Barberena', 'Santa Rosa de Lima', 'Casillas',
        'San Rafael Las Flores', 'Oratorio', 'San Juan Tecuaco',
        'Chiquimulilla', 'Taxisco', 'Santa María Ixhuatán',
        'Guazacapán', 'Santa Cruz Naranjo', 'Pueblo Nuevo Viñas',
        'Nueva Santa Rosa'
      ],
      aliases: ['cuilapa', 'costa sur'],
      zones: {}
    },
    'Sololá': {
      municipalities: [
        'Sololá', 'San José Chacayá', 'Santa María Visitación', 'Santa Lucía Utatlán',
        'Nahualá', 'Santa Catarina Ixtahuacán', 'Santa Clara La Laguna',
        'Concepción', 'San Andrés Semetabaj', 'Panajachel', 'Santa Catarina Palopó',
        'San Antonio Palopó', 'San Lucas Tolimán', 'Santa Cruz La Laguna',
        'San Pablo La Laguna', 'San Marcos La Laguna', 'San Juan La Laguna',
        'San Pedro La Laguna', 'Santiago Atitlán'
      ],
      aliases: ['lago atitlan', 'panajachel', 'atitlan'],
      zones: {}
    },
    'Suchitepéquez': {
      municipalities: [
        'Mazatenango', 'Cuyotenango', 'San Francisco Zapotitlán', 'San Bernardino',
        'San José El Ídolo', 'Santo Domingo Suchitepéquez', 'San Lorenzo',
        'Samayac', 'San Pablo Jocopilas', 'San Antonio Suchitepéquez',
        'Santo Tomás La Unión', 'Zunilito', 'Pueblo Nuevo', 'Río Bravo',
        'San Miguel Panán', 'San Gabriel', 'Chicacao', 'Patulul',
        'Santa Bárbara', 'San Juan Bautista', 'Zunilito'
      ],
      aliases: ['mazate', 'costa sur'],
      zones: {}
    },
    'Totonicapán': {
      municipalities: [
        'Totonicapán', 'San Cristóbal Totonicapán', 'San Francisco El Alto',
        'San Andrés Xecul', 'Momostenango', 'Santa María Chiquimula',
        'Santa Lucía La Reforma', 'San Bartolo'
      ],
      aliases: ['toto', 'momostenango'],
      zones: {}
    },
    'Zacapa': {
      municipalities: [
        'Zacapa', 'Estanzuela', 'Río Hondo', 'Gualán', 'Teculután',
        'Usumatlán', 'Cabañas', 'San Diego', 'La Unión', 'Huité'
      ],
      aliases: ['zacapa region'],
      zones: {}
    }
  },

  // Aliases culturales y nombres comunes
  cultural_aliases: {
    'guatemala': { name: 'Guatemala', type: 'city', department: 'Guatemala' }, // Prioridad ciudad
    'xela': { name: 'Quetzaltenango', type: 'city', department: 'Quetzaltenango' },
    'la capital': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'la ciudad': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'guate': { name: 'Guatemala', type: 'city', department: 'Guatemala' },
    'zona viva': { name: 'Zona 10', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'zona rosa': { name: 'Zona 10', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'el centro': { name: 'Zona 1', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'centro histórico': { name: 'Zona 1', type: 'zone', city: 'Guatemala', department: 'Guatemala' },
    'antigua': { name: 'Antigua Guatemala', type: 'city', department: 'Sacatepéquez' },
    'el puerto': { name: 'Puerto Barrios', type: 'city', department: 'Izabal' },
    'la imperial': { name: 'Cobán', type: 'city', department: 'Alta Verapaz' },
    'las verapaces': { name: 'Alta Verapaz', type: 'department' },
    'el norte': { name: 'Petén', type: 'department' },
    'huehue': { name: 'Huehuetenango', type: 'city', department: 'Huehuetenango' },
    'flores': { name: 'Flores', type: 'city', department: 'Petén' },
    'tikal': { name: 'Flores', type: 'city', department: 'Petén' },
    'champerico': { name: 'Champerico', type: 'city', department: 'Retalhuleu' },
    'panajachel': { name: 'Panajachel', type: 'city', department: 'Sololá' },
    'atitlan': { name: 'Sololá', type: 'department' },
    'mixco': { name: 'Mixco', type: 'city', department: 'Guatemala' },
    'villa nueva': { name: 'Villa Nueva', type: 'city', department: 'Guatemala' },
    'villanueva': { name: 'Villa Nueva', type: 'city', department: 'Guatemala' },
    'amatitlan': { name: 'Amatitlán', type: 'city', department: 'Guatemala' },
    'escuintla': { name: 'Escuintla', type: 'city', department: 'Escuintla' },
    'chimaltenango': { name: 'Chimaltenango', type: 'city', department: 'Chimaltenango' },
    'mazatenango': { name: 'Mazatenango', type: 'city', department: 'Suchitepéquez' },
    'mazate': { name: 'Mazatenango', type: 'city', department: 'Suchitepéquez' },
    'huehuetenango': { name: 'Huehuetenango', type: 'city', department: 'Huehuetenango' },
    'coban': { name: 'Cobán', type: 'city', department: 'Alta Verapaz' },
    'quetzaltenango': { name: 'Quetzaltenango', type: 'city', department: 'Quetzaltenango' },
    'jalapa': { name: 'Jalapa', type: 'city', department: 'Jalapa' },
    'jutiapa': { name: 'Jutiapa', type: 'city', department: 'Jutiapa' },
    'chiquimula': { name: 'Chiquimula', type: 'city', department: 'Chiquimula' },
    'zacapa': { name: 'Zacapa', type: 'city', department: 'Zacapa' },
    'izabal': { name: 'Puerto Barrios', type: 'city', department: 'Izabal' },
    'retalhuleu': { name: 'Retalhuleu', type: 'city', department: 'Retalhuleu' },
    'reu': { name: 'Retalhuleu', type: 'city', department: 'Retalhuleu' },
    'san marcos': { name: 'San Marcos', type: 'city', department: 'San Marcos' },
    'santa rosa': { name: 'Cuilapa', type: 'city', department: 'Santa Rosa' },
    'cuilapa': { name: 'Cuilapa', type: 'city', department: 'Santa Rosa' },
    'solola': { name: 'Sololá', type: 'city', department: 'Sololá' },
    'totonicapan': { name: 'Totonicapán', type: 'city', department: 'Totonicapán' },
    'toto': { name: 'Totonicapán', type: 'city', department: 'Totonicapán' },
    'quiche': { name: 'Santa Cruz del Quiché', type: 'city', department: 'Quiché' },
    'el progreso': { name: 'Guastatoya', type: 'city', department: 'El Progreso' },
    'baja verapaz': { name: 'Salamá', type: 'city', department: 'Baja Verapaz' },
    'salama': { name: 'Salamá', type: 'city', department: 'Baja Verapaz' },
    'sacatepequez': { name: 'Antigua Guatemala', type: 'city', department: 'Sacatepéquez' },
    'suchitepequez': { name: 'Mazatenango', type: 'city', department: 'Suchitepéquez' },
    'peten': { name: 'Flores', type: 'city', department: 'Petén' },
    'livingston': { name: 'Livingston', type: 'city', department: 'Izabal' },
    'el estor': { name: 'El Estor', type: 'city', department: 'Izabal' },
    'morales': { name: 'Morales', type: 'city', department: 'Izabal' },
    'los amates': { name: 'Los Amates', type: 'city', department: 'Izabal' },
    'puerto barrios': { name: 'Puerto Barrios', type: 'city', department: 'Izabal' },
    'esquipulas': { name: 'Esquipulas', type: 'city', department: 'Chiquimula' },
    'tecpan': { name: 'Tecpán Guatemala', type: 'city', department: 'Chimaltenango' },
    'patzun': { name: 'Patzún', type: 'city', department: 'Chimaltenango' },
    'comalapa': { name: 'Comalapa', type: 'city', department: 'Chimaltenango' },
    'chichicastenango': { name: 'Chichicastenango', type: 'city', department: 'Quiché' },
    'nebaj': { name: 'Nebaj', type: 'city', department: 'Quiché' },
    'todos santos': { name: 'Todos Santos Cuchumatán', type: 'city', department: 'Huehuetenango' },
    'jacaltenango': { name: 'Jacaltenango', type: 'city', department: 'Huehuetenango' },
    'barillas': { name: 'Barillas', type: 'city', department: 'Huehuetenango' },
    'coatepeque': { name: 'Coatepeque', type: 'city', department: 'Quetzaltenango' },
    'colomba': { name: 'Colomba Costa Cuca', type: 'city', department: 'Quetzaltenango' },
    'salcaja': { name: 'Salcajá', type: 'city', department: 'Quetzaltenango' },
    'almolonga': { name: 'Almolonga', type: 'city', department: 'Quetzaltenango' },
    'zunil': { name: 'Zunil', type: 'city', department: 'Quetzaltenango' },
    'cantel': { name: 'Cantel', type: 'city', department: 'Quetzaltenango' },
    'santiago atitlan': { name: 'Santiago Atitlán', type: 'city', department: 'Sololá' },
    'san pedro la laguna': { name: 'San Pedro La Laguna', type: 'city', department: 'Sololá' },
    'san lucas toliman': { name: 'San Lucas Tolimán', type: 'city', department: 'Sololá' },
    'santa cruz la laguna': { name: 'Santa Cruz La Laguna', type: 'city', department: 'Sololá' },
    'san juan la laguna': { name: 'San Juan La Laguna', type: 'city', department: 'Sololá' },
    'san marcos la laguna': { name: 'San Marcos La Laguna', type: 'city', department: 'Sololá' },
    'san pablo la laguna': { name: 'San Pablo La Laguna', type: 'city', department: 'Sololá' },
    'momostenango': { name: 'Momostenango', type: 'city', department: 'Totonicapán' },
    'san francisco el alto': { name: 'San Francisco El Alto', type: 'city', department: 'Totonicapán' },
    'barbena': { name: 'Barberena', type: 'city', department: 'Santa Rosa' },
    'chiquimulilla': { name: 'Chiquimulilla', type: 'city', department: 'Santa Rosa' },
    'taxisco': { name: 'Taxisco', type: 'city', department: 'Santa Rosa' },
    'guazacapan': { name: 'Guazacapán', type: 'city', department: 'Santa Rosa' },
    'san bernardino': { name: 'San Bernardino', type: 'city', department: 'Suchitepéquez' },
    'patulul': { name: 'Patulul', type: 'city', department: 'Suchitepéquez' },
    'san antonio suchitepequez': { name: 'San Antonio Suchitepéquez', type: 'city', department: 'Suchitepéquez' },
    'rio hondo': { name: 'Río Hondo', type: 'city', department: 'Zacapa' },
    'estanzuela': { name: 'Estanzuela', type: 'city', department: 'Zacapa' },
    'gualan': { name: 'Gualán', type: 'city', department: 'Zacapa' },
    'teculutan': { name: 'Teculután', type: 'city', department: 'Zacapa' },
    'jocotan': { name: 'Jocotán', type: 'city', department: 'Chiquimula' },
    'camotan': { name: 'Camotán', type: 'city', department: 'Chiquimula' },
    'olopa': { name: 'Olopa', type: 'city', department: 'Chiquimula' },
    'ipala': { name: 'Ipala', type: 'city', department: 'Chiquimula' },
    'concepcion las minas': { name: 'Concepción Las Minas', type: 'city', department: 'Chiquimula' },
    'asuncion mita': { name: 'Asunción Mita', type: 'city', department: 'Jutiapa' },
    'agua blanca': { name: 'Agua Blanca', type: 'city', department: 'Jutiapa' },
    'atescatempa': { name: 'Atescatempa', type: 'city', department: 'Jutiapa' },
    'jerez': { name: 'Jerez', type: 'city', department: 'Jutiapa' },
    'yupiltepeque': { name: 'Yupiltepeque', type: 'city', department: 'Jutiapa' },
    'monjas': { name: 'Monjas', type: 'city', department: 'Jalapa' },
    'san pedro pinula': { name: 'San Pedro Pinula', type: 'city', department: 'Jalapa' },
    'mataquescuintla': { name: 'Mataquescuintla', type: 'city', department: 'Jalapa' },
    'san luis jilotepeque': { name: 'San Luis Jilotepeque', type: 'city', department: 'Jalapa' },
    'san manuel chaparron': { name: 'San Manuel Chaparrón', type: 'city', department: 'Jalapa' },
    'san carlos alzatate': { name: 'San Carlos Alzatate', type: 'city', department: 'Jalapa' },
    'sayaxche': { name: 'Sayaxché', type: 'city', department: 'Petén' },
    'melchor de mencos': { name: 'Melchor de Mencos', type: 'city', department: 'Petén' },
    'poptun': { name: 'Poptún', type: 'city', department: 'Petén' },
    'san andres': { name: 'San Andrés', type: 'city', department: 'Petén' },
    'san benito': { name: 'San Benito', type: 'city', department: 'Petén' },
    'san jose': { name: 'San José', type: 'city', department: 'Petén' },
    'santa ana': { name: 'Santa Ana', type: 'city', department: 'Petén' },
    'la libertad': { name: 'La Libertad', type: 'city', department: 'Petén' },
    'dolores': { name: 'Dolores', type: 'city', department: 'Petén' },
    'san luis': { name: 'San Luis', type: 'city', department: 'Petén' },
    'san francisco': { name: 'San Francisco', type: 'city', department: 'Petén' },
    // NUEVAS ALDEAS Y COMUNIDADES (2025-07-15)
    'xeputul 2': { name: 'Xeputul 2', type: 'city', department: 'Huehuetenango' },
    'xeputul ii': { name: 'Xeputul 2', type: 'city', department: 'Huehuetenango' },
    'ixquisis': { name: 'Ixquisis', type: 'city', department: 'Huehuetenango' },
    'quisache': { name: 'Quisaché', type: 'city', department: 'Chimaltenango' },
    'cidabenque': { name: 'Cidabenque', type: 'city', department: 'Huehuetenango' },
    'chana': { name: 'Chana', type: 'city', department: 'Quiché' }
  },

  // Países de la región
  countries: {
    'guatemala': { name: 'Guatemala', code: 'GT', aliases: ['guate', 'republica de guatemala'] },
    'mexico': { name: 'México', code: 'MX', aliases: ['mexico', 'estados unidos mexicanos'] },
    'belice': { name: 'Belice', code: 'BZ', aliases: ['belize'] },
    'el salvador': { name: 'El Salvador', code: 'SV', aliases: ['salvador'] },
    'honduras': { name: 'Honduras', code: 'HN', aliases: ['honduras'] },
    'nicaragua': { name: 'Nicaragua', code: 'NI', aliases: ['nicaragua'] },
    'costa rica': { name: 'Costa Rica', code: 'CR', aliases: ['costa rica'] },
    'panama': { name: 'Panamá', code: 'PA', aliases: ['panama'] },
    'estados unidos': { name: 'Estados Unidos', code: 'US', aliases: ['usa', 'eeuu', 'united states'] },
    'canada': { name: 'Canadá', code: 'CA', aliases: ['canada'] },
    'espana': { name: 'España', code: 'ES', aliases: ['españa', 'spain'] },
    'colombia': { name: 'Colombia', code: 'CO', aliases: ['colombia'] },
    'venezuela': { name: 'Venezuela', code: 'VE', aliases: ['venezuela'] },
    'brasil': { name: 'Brasil', code: 'BR', aliases: ['brazil'] },
    'argentina': { name: 'Argentina', code: 'AR', aliases: ['argentina'] },
    'chile': { name: 'Chile', code: 'CL', aliases: ['chile'] },
    'peru': { name: 'Perú', code: 'PE', aliases: ['peru'] },
    'ecuador': { name: 'Ecuador', code: 'EC', aliases: ['ecuador'] },
    'bolivia': { name: 'Bolivia', code: 'BO', aliases: ['bolivia'] },
    'paraguay': { name: 'Paraguay', code: 'PY', aliases: ['paraguay'] },
    'uruguay': { name: 'Uruguay', code: 'UY', aliases: ['uruguay'] }
  }
};

/**
 * Normaliza texto para búsqueda
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^\w\s]/g, ' ') // Remover puntuación
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim();
}

/**
 * Busca ubicación en el mapeo interno
 */
function findLocationInMapping(location) {
  const normalized = normalizeText(location);
  
  // 1. Buscar en aliases culturales (mayor prioridad)
  if (GUATEMALA_MAPPING.cultural_aliases[normalized]) {
    return GUATEMALA_MAPPING.cultural_aliases[normalized];
  }
  
  // 2. Buscar en departamentos (antes que países para Guatemala)
  for (const [dept, info] of Object.entries(GUATEMALA_MAPPING.departments)) {
    if (normalizeText(dept) === normalized) {
      return { name: dept, type: 'department' };
    }
    
    // Buscar en aliases de departamento
    if (info.aliases && info.aliases.some(alias => normalizeText(alias) === normalized)) {
      return { name: dept, type: 'department' };
    }
    
    // Buscar en municipios
    if (info.municipalities && info.municipalities.some(muni => normalizeText(muni) === normalized)) {
      const municipality = info.municipalities.find(muni => normalizeText(muni) === normalized);
      return { name: municipality, type: 'city', department: dept };
    }
    
    // Buscar en zonas
    if (info.zones) {
      for (const [zone, areas] of Object.entries(info.zones)) {
        if (normalizeText(zone) === normalized) {
          return { name: zone, type: 'zone', city: dept === 'Guatemala' ? 'Guatemala' : null, department: dept };
        }
        
        if (areas.some(area => normalizeText(area) === normalized)) {
          return { name: zone, type: 'zone', city: dept === 'Guatemala' ? 'Guatemala' : null, department: dept };
        }
      }
    }
  }
  
  // 3. Buscar en países (menor prioridad)
  if (GUATEMALA_MAPPING.countries[normalized]) {
    return {
      name: GUATEMALA_MAPPING.countries[normalized].name,
      type: 'country',
      code: GUATEMALA_MAPPING.countries[normalized].code
    };
  }
  
  return null;
}

/**
 * Normaliza nombre de país
 */
function normalizeCountryName(country) {
  if (!country) return null;
  
  const normalized = normalizeText(country);
  
  // Buscar en mapeo de países
  if (GUATEMALA_MAPPING.countries[normalized]) {
    return GUATEMALA_MAPPING.countries[normalized].name;
  }
  
  // Buscar en aliases de países
  for (const [key, info] of Object.entries(GUATEMALA_MAPPING.countries)) {
    if (info.aliases && info.aliases.some(alias => normalizeText(alias) === normalized)) {
      return info.name;
    }
  }
  
  // Si no se encuentra, capitalizar la primera letra
  return country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
}

/**
 * Obtiene departamento para una ciudad
 */
function getDepartmentForCity(city) {
  if (!city) return null;
  
  const normalized = normalizeText(city);
  
  // Buscar en aliases culturales
  const aliasMatch = GUATEMALA_MAPPING.cultural_aliases[normalized];
  if (aliasMatch && aliasMatch.department) {
    return aliasMatch.department;
  }
  
  // Buscar en departamentos
  for (const [dept, info] of Object.entries(GUATEMALA_MAPPING.departments)) {
    if (info.municipalities && info.municipalities.some(muni => normalizeText(muni) === normalized)) {
      return dept;
    }
  }
  
  return null;
}

/**
 * Normaliza información geográfica completa
 */
async function normalizeGeographicInfo(geoInfo) {
  let { city, department, pais, country } = geoInfo;
  
  // FILTRO DE INSTITUCIONES CON IA: Rechazar si algún campo es una institución
  if (city && await isInstitutionNotLocationWithAI(city)) {
    console.log(`🚫 [MAPS] Rechazando ciudad por ser institución: "${city}"`);
    city = null;
  }
  
  if (department && await isInstitutionNotLocationWithAI(department)) {
    console.log(`🚫 [MAPS] Rechazando departamento por ser institución: "${department}"`);
    department = null;
  }
  
  // Si no queda información geográfica válida, retornar objeto vacío
  if (!city && !department && !pais && !country) {
    return {
      city: null,
      department: null,
      pais: null,
      detection_method: 'institution_filtered',
      confidence: 0
    };
  }
  
  // Normalizar país
  const countryToProcess = country || pais;
  if (countryToProcess) {
    pais = normalizeCountryName(countryToProcess);
  }
  
  // Si tenemos ciudad pero no departamento, intentar detectarlo
  if (city && !department) {
    const detectedDept = getDepartmentForCity(city);
    if (detectedDept) {
      department = detectedDept;
      console.log(`🗺️ [MAPS] Departamento detectado: ${city} → ${detectedDept}`);
    }
  }
  
  // Normalizar ciudad usando aliases
  if (city) {
    const cityMatch = findLocationInMapping(city);
    if (cityMatch && cityMatch.type === 'city') {
      city = cityMatch.name;
      if (cityMatch.department && !department) {
        department = cityMatch.department;
      }
    }
  }
  
  // Normalizar departamento
  if (department) {
    const deptMatch = findLocationInMapping(department);
    if (deptMatch && deptMatch.type === 'department') {
      department = deptMatch.name;
    }
  }
  
  // Si no hay país especificado pero hay departamento guatemalteco, asumir Guatemala
  if (department && !pais) {
    if (Object.keys(GUATEMALA_MAPPING.departments).includes(department)) {
      pais = 'Guatemala';
    }
  }
  
  return {
    city: city?.trim() || null,
    department: department?.trim() || null,
    pais: pais?.trim() || null,
    country: pais?.trim() || null
  };
}

/**
 * Versión síncrona de normalización geográfica (usa fallback de patrones)
 * Para casos donde no se puede usar async
 */
function normalizeGeographicInfoSync(geoInfo) {
  let { city, department, pais, country } = geoInfo;
  
  // FILTRO DE INSTITUCIONES CON FALLBACK: Rechazar si algún campo es una institución
  if (city && isInstitutionNotLocationFallback(city)) {
    console.log(`🚫 [MAPS-SYNC] Rechazando ciudad por ser institución: "${city}"`);
    city = null;
  }
  
  if (department && isInstitutionNotLocationFallback(department)) {
    console.log(`🚫 [MAPS-SYNC] Rechazando departamento por ser institución: "${department}"`);
    department = null;
  }
  
  // Si no queda información geográfica válida, retornar objeto vacío
  if (!city && !department && !pais && !country) {
    return {
      city: null,
      department: null,
      pais: null,
      detection_method: 'institution_filtered_sync',
      confidence: 0
    };
  }
  
  // Normalizar país
  const countryToProcess = country || pais;
  if (countryToProcess) {
    pais = normalizeCountryName(countryToProcess);
  }
  
  // Si tenemos ciudad pero no departamento, intentar detectarlo
  if (city && !department) {
    const detectedDept = getDepartmentForCity(city);
    if (detectedDept) {
      department = detectedDept;
      console.log(`🗺️ [MAPS-SYNC] Departamento detectado: ${city} → ${detectedDept}`);
    }
  }
  
  // Normalizar ciudad usando aliases
  if (city) {
    const cityMatch = findLocationInMapping(city);
    if (cityMatch && cityMatch.type === 'city') {
      city = cityMatch.name;
      if (cityMatch.department && !department) {
        department = cityMatch.department;
      }
    }
  }
  
  // Normalizar departamento
  if (department) {
    const deptMatch = findLocationInMapping(department);
    if (deptMatch && deptMatch.type === 'department') {
      department = deptMatch.name;
    }
  }
  
  // Si no hay país especificado pero hay departamento guatemalteco, asumir Guatemala
  if (department && !pais) {
    if (Object.keys(GUATEMALA_MAPPING.departments).includes(department)) {
      pais = 'Guatemala';
    }
  }
  
  return {
    city: city || null,
    department: department || null,
    pais: pais || null,
    detection_method: 'manual_sync',
    confidence: city || department ? 0.85 : 0.5
  };
}

/**
 * Detecta tipo de ubicación
 */
function detectLocationType(location) {
  if (!location) return null;
  
  const match = findLocationInMapping(location);
  if (match) {
    return match.type;
  }
  
  return null;
}

/**
 * Busca ubicaciones similares
 */
function findSimilarLocations(location, maxResults = 5) {
  if (!location) return [];
  
  const normalized = normalizeText(location);
  const results = [];
  
  // Buscar coincidencias parciales en aliases culturales
  for (const [key, info] of Object.entries(GUATEMALA_MAPPING.cultural_aliases)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      results.push({
        name: info.name,
        type: info.type,
        department: info.department,
        similarity: calculateSimilarity(normalized, key)
      });
    }
  }
  
  // Buscar en departamentos
  for (const [dept, info] of Object.entries(GUATEMALA_MAPPING.departments)) {
    if (normalizeText(dept).includes(normalized) || normalized.includes(normalizeText(dept))) {
      results.push({
        name: dept,
        type: 'department',
        similarity: calculateSimilarity(normalized, normalizeText(dept))
      });
    }
    
    // Buscar en municipios
    if (info.municipalities) {
      for (const muni of info.municipalities) {
        if (normalizeText(muni).includes(normalized) || normalized.includes(normalizeText(muni))) {
          results.push({
            name: muni,
            type: 'city',
            department: dept,
            similarity: calculateSimilarity(normalized, normalizeText(muni))
          });
        }
      }
    }
  }
  
  // Buscar en países
  for (const [key, info] of Object.entries(GUATEMALA_MAPPING.countries)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      results.push({
        name: info.name,
        type: 'country',
        code: info.code,
        similarity: calculateSimilarity(normalized, key)
      });
    }
  }
  
  // Ordenar por similaridad y retornar los mejores
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * Calcula similaridad entre dos strings
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distancia de Levenshtein
 */
function levenshteinDistance(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  
  return track[str2.length][str1.length];
}

/**
 * Usa IA para detectar geografía cuando el mapeo manual falla
 */
async function detectGeographyWithAI(location, context = '') {
  try {
    const prompt = `
Como experto en geografía guatemalteca, analiza la siguiente ubicación:
"${location}" ${context ? `en contexto: "${context}"` : ''}

Responde SOLO en el siguiente formato JSON:
{
  "city": "nombre_ciudad_o_null",
  "department": "nombre_departamento_o_null", 
  "country": "nombre_pais_o_null",
  "type": "city|department|country|zone|unknown",
  "confidence": "high|medium|low",
  "reasoning": "explicación_breve"
}

Reglas:
1. Si es una zona de Guatemala Ciudad, usar: city: "Guatemala", department: "Guatemala"
2. Para aliases como "Xela" = "Quetzaltenango"
3. Para "El Puerto" = "Puerto Barrios", "Izabal" 
4. Para "Antigua" = "Antigua Guatemala", "Sacatepéquez"
5. Si no es de Guatemala, indicar el país correcto
6. Solo usar confidence "high" si estás 95% seguro
7. Si no puedes determinar, usar type: "unknown"`;

    const messages = [
      { role: 'user', content: prompt }
    ];
    
    const response = await geminiChat(messages, {
      temperature: 0.1,
      maxTokens: 512
    });
    
    if (!response || !response.trim()) {
      throw new Error('Respuesta vacía de IA');
    }
    
    // Limpiar respuesta para extraer JSON
    const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
    const result = JSON.parse(cleanResponse);
    
    // Validar estructura
    if (!result || typeof result !== 'object') {
      throw new Error('Respuesta de IA no es objeto válido');
    }
    
    console.log(`🤖 [MAPS] IA detectó: ${location} → ${JSON.stringify(result)}`);
    return result;
    
  } catch (error) {
    console.error('🚨 [MAPS] Error en detección con IA:', error);
    return {
      city: null,
      department: null,
      country: null,
      type: 'unknown',
      confidence: 'low',
      reasoning: 'Error en procesamiento con IA'
    };
  }
}

/**
 * Normaliza lote de ubicaciones geográficas
 */
async function batchNormalizeGeography(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }
  
  console.log(`🗺️ [MAPS] Procesando lote de ${locations.length} ubicaciones...`);
  
  const results = [];
  
  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    
    try {
      // Primero intentar con mapeo manual
      let normalized = normalizeGeographicInfo(location);
      let detectionMethod = 'manual';
      let confidence = 'medium';
      let reasoning = 'Detección manual con mapeo interno';
      
      // Si faltan datos importantes, usar IA
      if (location.city && !normalized.department) {
        console.log(`🤖 [MAPS] Usando IA para completar: ${location.city}`);
        
        const aiResult = await detectGeographyWithAI(location.city, location.department || location.pais || '');
        
        if (aiResult && aiResult.department && aiResult.confidence !== 'low') {
          normalized = {
            city: aiResult.city || normalized.city,
            department: aiResult.department || normalized.department,
            pais: aiResult.country || normalized.pais,
            country: aiResult.country || normalized.pais
          };
          detectionMethod = 'ai';
          confidence = aiResult.confidence;
          reasoning = aiResult.reasoning;
        }
      }
      
      results.push({
        ...normalized,
        detection_method: detectionMethod,
        confidence: confidence,
        reasoning: reasoning
      });
      
    } catch (error) {
      console.error(`🚨 [MAPS] Error procesando ubicación ${i}:`, error);
      results.push({
        ...location,
        detection_method: 'error',
        confidence: 'low',
        reasoning: 'Error en procesamiento'
      });
    }
  }
  
  console.log(`✅ [MAPS] Lote procesado: ${results.length} ubicaciones`);
  return results;
}

/**
 * Valida si una ubicación pertenece a Guatemala
 */
function isGuatemalan(location) {
  if (!location) return false;
  
  const normalized = normalizeGeographicInfo(location);
  
  // Si el país es Guatemala
  if (normalized.pais === 'Guatemala') return true;
  
  // Si el departamento es guatemalteco
  if (normalized.department && Object.keys(GUATEMALA_MAPPING.departments).includes(normalized.department)) {
    return true;
  }
  
  // Si la ciudad está en el mapeo guatemalteco
  if (normalized.city) {
    const cityMatch = findLocationInMapping(normalized.city);
    if (cityMatch && cityMatch.department) {
      return true;
    }
  }
  
  return false;
}

/**
 * Obtiene información completa de una ubicación
 */
function getLocationInfo(location) {
  if (!location) return null;
  
  const normalized = normalizeGeographicInfo(location);
  const match = findLocationInMapping(location.city || location.department || location.pais || location);
  
  return {
    normalized,
    match,
    isGuatemalan: isGuatemalan(location),
    type: match ? match.type : 'unknown',
    suggestions: findSimilarLocations(location.city || location.department || location.pais || location)
  };
}

/**
 * Detecta si un texto se refiere a una institución/organización usando IA (Gemini)
 * @param {string} text - Texto a analizar
 * @returns {Promise<boolean>} - true si es una institución, false si puede ser geográfico
 */
async function isInstitutionNotLocationWithAI(text) {
    if (!text || typeof text !== 'string') return false;
    
    try {
        const prompt = `Analiza el siguiente texto y determina si se refiere a:\nA) Una UBICACIÓN GEOGRÁFICA (ciudad, municipio, departamento, aldea, caserío, lugar físico)\nB) Una INSTITUCIÓN/ORGANIZACIÓN (empresa, banco, ministerio, comisión, departamento gubernamental, oficina)\n\nTexto a analizar: \"${text}\"\n\nResponde ÚNICAMENTE con:\n- \"GEOGRAFICO\" si es una ubicación física/geográfica\n- \"INSTITUCION\" si es una organización/institución\n\nEjemplos:\n- \"Quetzaltenango\" → GEOGRAFICO\n- \"Departamento de Finanzas\" → INSTITUCION\n- \"Huehuetenango\" → GEOGRAFICO\n- \"Comisión de Agricultura\" → INSTITUCION\n- \"Aldea San Juan\" → GEOGRAFICO\n- \"Banco Central\" → INSTITUCION`;

        const response = await geminiChat([
            { role: 'user', content: prompt }
        ]);
        
        if (!response || typeof response !== 'string') {
            console.log(`⚠️ [AI-INSTITUTION-FILTER] Respuesta inválida de IA para \"${text}\", usando fallback`);
            return isInstitutionNotLocationFallback(text);
        }
        
        const classification = response.trim().toUpperCase();
        
        if (classification.includes('INSTITUCION')) {
            console.log(`🚫 [AI-INSTITUTION-FILTER] \"${text}\" clasificado como INSTITUCIÓN por IA`);
            return true;
        } else if (classification.includes('GEOGRAFICO')) {
            console.log(`✅ [AI-INSTITUTION-FILTER] \"${text}\" clasificado como GEOGRÁFICO por IA`);
            return false;
        } else {
            console.log(`⚠️ [AI-INSTITUTION-FILTER] Respuesta ambigua de IA: \"${response}\" para \"${text}\", usando fallback`);
            return isInstitutionNotLocationFallback(text);
        }
        
    } catch (error) {
        console.error(`❌ [AI-INSTITUTION-FILTER] Error al clasificar \"${text}\":`, error.message);
        // Fallback a lógica de patrones si falla la IA
        return isInstitutionNotLocationFallback(text);
    }
}

/**
 * Fallback con patrones regex cuando la IA no está disponible
 * @param {string} text - Texto a analizar
 * @returns {boolean} - true si es una institución, false si puede ser geográfico
 */
function isInstitutionNotLocationFallback(text) {
    if (!text || typeof text !== 'string') return false;
    
    const normalized = text.toLowerCase().trim();
    
    // Patrones que indican claramente instituciones (no lugares geográficos)
    const institutionPatterns = [
        // Departamentos gubernamentales/empresariales
        /^departamento de\\s+(la\\s+)?(nueva\\s+)?\\w+\\s*(bancaria|financiera|normativa|tributaria|comercial)/,
        /^departamento de\\s+(recursos\\s+humanos|administración|finanzas|contabilidad|marketing)/,
        /^departamento de\\s+(tecnología|sistemas|informática|comunicaciones)/,
        /^departamento de\\s+(ventas|compras|logística|operaciones)/,
        
        // Comisiones y entidades reguladoras
        /^comisión\\s+(de\\s+)?(agricultura|bancaria|financiera|electoral|derechos|justicia)/,
        /^comisión\\s+(nacional|central|federal|estatal)/,
        
        // Ministerios
        /^ministerio\\s+(de\\s+)?(hacienda|finanzas|economia|educación|salud)/,
        
        // Bancos y entidades financieras
        /^banco\\s+(central|nacional|industrial|agrícola|de\\s+desarrollo)/,
        /^superintendencia\\s+(de\\s+)?(bancos|seguros|valores)/,
        
        // Empresas y corporaciones
        /^empresa\\s+(nacional|municipal|privada)/,
        /\\b(s\\.a\\.|ltd\\.|inc\\.|corp\\.|cia\\.)\\b/,
        
        // Organizaciones y fundaciones
        /^fundación\\s+/,
        /^organización\\s+/,
        /^instituto\\s+(nacional|guatemalteco)/,
        
        // Direcciones y secretarías
        /^dirección\\s+(general\\s+)?(de\\s+)?/,
        /^secretaría\\s+(de\\s+)?/,
        
        // Autoridades
        /^autoridad\\s+(portuaria|aeroportuaria|tributaria)/
    ];
    
    // Verificar patrones de instituciones
    for (const pattern of institutionPatterns) {
        if (pattern.test(normalized)) {
            console.log(`🚫 [FALLBACK-FILTER] \"${text}\" detectado como institución (patrón: ${pattern})`);
            return true;
        }
    }
    
    // Palabras clave que indican instituciones cuando aparecen en contexto específico
    const institutionKeywords = [
        'normativa', 'regulatoria', 'administrativa', 'operativa', 'comercial',
        'tributaria', 'fiscal', 'financiera', 'bancaria', 'crediticia',
        'recursos humanos', 'contabilidad', 'auditoría', 'compliance',
        'tecnología', 'sistemas', 'informática', 'digital',
        'marketing', 'ventas', 'comunicaciones', 'relaciones públicas'
    ];
    
    const hasInstitutionKeywords = institutionKeywords.some(keyword => 
        normalized.includes(keyword)
    );
    
    if (hasInstitutionKeywords && (normalized.includes('departamento') || normalized.includes('comisión'))) {
        console.log(`🚫 [FALLBACK-FILTER] \"${text}\" detectado como institución (keywords: departamento/comisión + ${institutionKeywords.find(k => normalized.includes(k))})`);
        return true;
    }
    
    return false;
}

/**
 * GEOCODIFICACIÓN PARA GUATEMALA
 * Convierte nombres de lugares a coordenadas lat/lng
 */
const GUATEMALA_COORDINATES = {
  // Coordenadas del país
  country: {
    'Guatemala': { lat: 14.6349, lng: -90.5069 }
  },
  
  // Coordenadas de departamentos
  departments: {
    'Alta Verapaz': { lat: 15.4667, lng: -90.2333 },
    'Baja Verapaz': { lat: 15.0167, lng: -90.1167 },
    'Chimaltenango': { lat: 14.6667, lng: -90.8167 },
    'Chiquimula': { lat: 14.8000, lng: -89.5500 },
    'El Progreso': { lat: 14.8500, lng: -90.0500 },
    'Escuintla': { lat: 14.2167, lng: -90.7833 },
    'Guatemala': { lat: 14.6349, lng: -90.5069 },
    'Huehuetenango': { lat: 15.3192, lng: -91.4714 },
    'Izabal': { lat: 15.7333, lng: -88.6000 },
    'Jalapa': { lat: 14.6333, lng: -89.9833 },
    'Jutiapa': { lat: 14.2833, lng: -89.8833 },
    'Petén': { lat: 16.9260, lng: -89.8939 },
    'Quetzaltenango': { lat: 14.8333, lng: -91.5167 },
    'Quiché': { lat: 15.0333, lng: -91.1500 },
    'Retalhuleu': { lat: 14.5333, lng: -91.6833 },
    'Sacatepéquez': { lat: 14.5589, lng: -90.7351 },
    'San Marcos': { lat: 14.9667, lng: -91.7833 },
    'Santa Rosa': { lat: 14.3167, lng: -90.2833 },
    'Sololá': { lat: 14.7722, lng: -91.1856 },
    'Suchitepéquez': { lat: 14.5333, lng: -91.5000 },
    'Totonicapán': { lat: 14.9167, lng: -91.3667 },
    'Zacapa': { lat: 14.9667, lng: -89.5333 }
  },
  
  // Coordenadas de ciudades principales
  cities: {
    // Guatemala
    'Ciudad de Guatemala': { lat: 14.6349, lng: -90.5069 },
    'Guatemala City': { lat: 14.6349, lng: -90.5069 },
    'Mixco': { lat: 14.6308, lng: -90.6067 },
    'Villa Nueva': { lat: 14.5242, lng: -90.5975 },
    'Petapa': { lat: 14.5019, lng: -90.5531 },
    'Amatitlán': { lat: 14.4875, lng: -90.6158 },
    'Villa Canales': { lat: 14.4789, lng: -90.5278 },
    'Chinautla': { lat: 14.7094, lng: -90.4894 },
    
    // Quetzaltenango
    'Quetzaltenango': { lat: 14.8333, lng: -91.5167 },
    'Coatepeque': { lat: 14.7042, lng: -91.8628 },
    'Salcajá': { lat: 14.8833, lng: -91.4667 },
    
    // Escuintla
    'Escuintla': { lat: 14.2167, lng: -90.7833 },
    'Santa Lucía Cotzumalguapa': { lat: 14.3333, lng: -91.0167 },
    
    // Sacatepéquez
    'Antigua Guatemala': { lat: 14.5589, lng: -90.7351 },
    'Antigua': { lat: 14.5589, lng: -90.7351 },
    
    // Izabal
    'Puerto Barrios': { lat: 15.7275, lng: -88.5975 },
    'Livingston': { lat: 15.8275, lng: -88.7500 },
    
    // Petén
    'Flores': { lat: 16.9260, lng: -89.8939 },
    'Santa Elena': { lat: 16.9275, lng: -89.8858 },
    
    // Alta Verapaz
    'Cobán': { lat: 15.4667, lng: -90.2333 },
    'San Pedro Carchá': { lat: 15.4833, lng: -90.2167 },
    
    // Huehuetenango
    'Huehuetenango': { lat: 15.3192, lng: -91.4714 },
    
    // Chimaltenango
    'Chimaltenango': { lat: 14.6667, lng: -90.8167 },
    'Tecpán Guatemala': { lat: 14.7667, lng: -91.0000 },
    
    // Suchitepéquez
    'Mazatenango': { lat: 14.5342, lng: -91.5036 },
    
    // Retalhuleu
    'Retalhuleu': { lat: 14.5333, lng: -91.6833 }
  }
};

/**
 * Geocodifica una ubicación guatemalteca
 * @param {Object} location - Objeto con city, department, pais
 * @returns {Object|null} - Coordenadas {lat, lng} o null si no se encuentra
 */
function geocodeGuatemalaLocation(location) {
  const { city, department, pais } = location;
  
  try {
    // Prioridad 1: Ciudad específica
    if (city && GUATEMALA_COORDINATES.cities[city]) {
      console.log(`🗺️ [GEOCODE] Ciudad encontrada: ${city} → ${JSON.stringify(GUATEMALA_COORDINATES.cities[city])}`);
      return GUATEMALA_COORDINATES.cities[city];
    }
    
    // Prioridad 2: Departamento
    if (department && GUATEMALA_COORDINATES.departments[department]) {
      console.log(`🗺️ [GEOCODE] Departamento encontrado: ${department} → ${JSON.stringify(GUATEMALA_COORDINATES.departments[department])}`);
      return GUATEMALA_COORDINATES.departments[department];
    }
    
    // Prioridad 3: País
    if (pais && GUATEMALA_COORDINATES.country[pais]) {
      console.log(`🗺️ [GEOCODE] País encontrado: ${pais} → ${JSON.stringify(GUATEMALA_COORDINATES.country[pais])}`);
      return GUATEMALA_COORDINATES.country[pais];
    }
    
    // Si no se encuentra nada, intentar buscar en aliases/variaciones
    if (city) {
      // Buscar variaciones comunes
      const cityLower = city.toLowerCase();
      for (const [standardCity, coords] of Object.entries(GUATEMALA_COORDINATES.cities)) {
        if (standardCity.toLowerCase().includes(cityLower) || cityLower.includes(standardCity.toLowerCase())) {
          console.log(`🗺️ [GEOCODE] Ciudad por similitud: ${city} → ${standardCity} → ${JSON.stringify(coords)}`);
          return coords;
        }
      }
    }
    
    console.log(`❌ [GEOCODE] No se encontraron coordenadas para: ${JSON.stringify(location)}`);
    return null;
    
  } catch (error) {
    console.error(`❌ [GEOCODE] Error geocodificando ubicación:`, error);
    return null;
  }
}

/**
 * Versión async de normalización geográfica que incluye geocodificación
 * @param {Object} geoInfo - Información geográfica
 * @returns {Object} - Información normalizada + coordenadas
 */
async function normalizeGeographicInfoWithCoordinates(geoInfo) {
  // Primero normalizar la información geográfica
  const normalized = await normalizeGeographicInfo(geoInfo);
  
  // Luego agregar coordenadas
  const coordinates = geocodeGuatemalaLocation(normalized);
  
  return {
    ...normalized,
    coordinates: coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : null,
    geocoded: !!coordinates
  };
}

module.exports = {
  // Funciones principales
  normalizeGeographicInfo,
  normalizeCountryName,
  getDepartmentForCity,
  detectLocationType,
  findLocationInMapping,
  findSimilarLocations,
  detectGeographyWithAI,
  batchNormalizeGeography,
  isGuatemalan,
  getLocationInfo,
  isInstitutionNotLocationWithAI,
  isInstitutionNotLocationFallback,
  normalizeGeographicInfoSync, // Add the new function to exports
  normalizeGeographicInfoWithCoordinates, // Add the new function to exports
  geocodeGuatemalaLocation, // Add geocoding function
  
  // Datos
  GUATEMALA_MAPPING,
  
  // Utilidades
  normalizeText,
  calculateSimilarity
}; 