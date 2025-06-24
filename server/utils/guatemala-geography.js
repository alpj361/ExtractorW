// ===================================================================
// MAPEO GEOGRÁFICO DE GUATEMALA
// Ciudades organizadas por departamento para detección automática
// ===================================================================

const GUATEMALA_GEOGRAPHY = {
  // Departamento de Guatemala
  'Guatemala': [
    'Guatemala', 'Mixco', 'Villa Nueva', 'Petapa', 'San Juan Sacatepéquez',
    'Chinautla', 'Amatitlán', 'Santa Catarina Pinula', 'Villa Canales',
    'San José Pinula', 'San José del Golfo', 'Palencia', 'San Pedro Ayampuc',
    'San Pedro Sacatepéquez', 'San Raymundo', 'Chuarrancho', 'Fraijanes'
  ],

  // El Progreso
  'El Progreso': [
    'Guastatoya', 'Morazán', 'San Agustín Acasaguastlán', 'San Cristóbal Acasaguastlán',
    'El Jícaro', 'Sansare', 'Sanarate', 'San Antonio La Paz'
  ],

  // Sacatepéquez
  'Sacatepéquez': [
    'Antigua Guatemala', 'Jocotenango', 'Pastores', 'Sumpango',
    'Santo Domingo Xenacoj', 'Santiago Sacatepéquez', 'San Bartolomé Milpas Altas',
    'San Lucas Sacatepéquez', 'Santa Lucía Milpas Altas', 'Magdalena Milpas Altas',
    'Santa María de Jesús', 'Ciudad Vieja', 'San Miguel Dueñas',
    'Alotenango', 'San Antonio Aguas Calientes', 'Santa Catarina Barahona'
  ],

  // Chimaltenango
  'Chimaltenango': [
    'Chimaltenango', 'San José Poaquil', 'San Martín Jilotepeque', 'Comalapa',
    'Santa Apolonia', 'Tecpán Guatemala', 'Patzún', 'Pochuta',
    'Patzicía', 'Santa Cruz Balanyá', 'Acatenango', 'Yepocapa',
    'San Andrés Itzapa', 'Parramos', 'Zaragoza', 'El Tejar'
  ],

  // Escuintla
  'Escuintla': [
    'Escuintla', 'Santa Lucía Cotzumalguapa', 'La Democracia', 'Siquinalá',
    'Masagua', 'Tiquisate', 'La Gomera', 'Guanagazapa',
    'San José', 'Iztapa', 'Palín', 'San Vicente Pacaya',
    'Nueva Concepción', 'Puerto San José'
  ],

  // Santa Rosa
  'Santa Rosa': [
    'Cuilapa', 'Barberena', 'Santa Rosa de Lima', 'Casillas',
    'San Rafael Las Flores', 'Oratorio', 'San Juan Tecuaco', 'Chiquimulilla',
    'Taxisco', 'Santa María Ixhuatán', 'Guazacapán', 'Santa Cruz Naranjo',
    'Pueblo Nuevo Viñas', 'Nueva Santa Rosa'
  ],

  // Sololá
  'Sololá': [
    'Sololá', 'San José Chacayá', 'Santa María Visitación', 'Santa Lucía Utatlán',
    'Nahualá', 'Santa Catarina Ixtahuacán', 'Santa Clara La Laguna', 'Concepción',
    'San Andrés Semetabaj', 'Panajachel', 'Santa Catarina Palopó', 'San Antonio Palopó',
    'San Lucas Tolimán', 'Santa Cruz La Laguna', 'San Pablo La Laguna',
    'San Marcos La Laguna', 'San Juan La Laguna', 'San Pedro La Laguna',
    'Santiago Atitlán'
  ],

  // Totonicapán
  'Totonicapán': [
    'Totonicapán', 'San Cristóbal Totonicapán', 'San Francisco El Alto',
    'San Andrés Xecul', 'Momostenango', 'Santa María Chiquimula',
    'Santa Lucía La Reforma', 'San Bartolo'
  ],

  // Quetzaltenango
  'Quetzaltenango': [
    'Quetzaltenango', 'Salcajá', 'Olintepeque', 'San Carlos Sija',
    'Sibilia', 'Cabricán', 'Cajolá', 'San Miguel Sigüilá',
    'Ostuncalco', 'San Mateo', 'Concepción Chiquirichapa', 'San Martín Sacatepéquez',
    'Almolonga', 'Cantel', 'Huitán', 'Zunil',
    'Colomba Costa Cuca', 'San Francisco La Unión', 'El Palmar',
    'Coatepeque', 'Génova', 'Flores Costa Cuca', 'La Esperanza',
    'Palestina de Los Altos'
  ],

  // Suchitepéquez
  'Suchitepéquez': [
    'Mazatenango', 'Cuyotenango', 'San Francisco Zapotitlán', 'San Bernardino',
    'San José El Ídolo', 'Santo Domingo Suchitepéquez', 'San Lorenzo',
    'Samayac', 'San Pablo Jocopilas', 'San Antonio Suchitepéquez', 'San Miguel Panán',
    'San Gabriel', 'Chicacao', 'Patulul', 'Santa Bárbara',
    'San Juan Bautista', 'Santo Tomás La Unión', 'Zunilito',
    'Pueblo Nuevo', 'Río Bravo'
  ],

  // Retalhuleu
  'Retalhuleu': [
    'Retalhuleu', 'San Sebastián', 'Santa Cruz Muluá', 'San Martín Zapotitlán',
    'San Felipe', 'San Andrés Villa Seca', 'Champerico', 'Nuevo San Carlos',
    'El Asintal'
  ],

  // San Marcos
  'San Marcos': [
    'San Marcos', 'San Pedro Sacatepéquez', 'San Antonio Sacatepéquez', 'Comitancillo',
    'San Miguel Ixtahuacán', 'Concepción Tutuapa', 'Tacaná', 'Sibinal',
    'Tajumulco', 'Tejutla', 'San Rafael Pie de la Cuesta', 'Nuevo Progreso',
    'El Tumbador', 'El Rodeo', 'Malacatán', 'Catarina',
    'Ayutla', 'Ocós', 'San Pablo', 'El Quetzal',
    'La Reforma', 'Pajapita', 'Ixchiguán', 'San José Ojetenam',
    'San Cristóbal Cucho', 'Sipacapa', 'Esquipulas Palo Gordo', 'Río Blanco',
    'San Lorenzo', 'La Blanca'
  ],

  // Huehuetenango
  'Huehuetenango': [
    'Huehuetenango', 'Chiantla', 'Malacatancito', 'Cuilco',
    'Nentón', 'San Pedro Necta', 'Jacaltenango', 'Soloma',
    'Ixtahuacán', 'Santa Bárbara', 'La Libertad', 'La Democracia',
    'San Miguel Acatán', 'San Rafael La Independencia', 'Todos Santos Cuchumatán',
    'San Juan Atitán', 'Santa Eulalia', 'San Mateo Ixtatán',
    'Colotenango', 'San Sebastián Huehuetenango', 'Tectitán', 'Concepción Huista',
    'San Juan Ixcoy', 'San Antonio Huista', 'San Sebastián Coatán',
    'Santa Cruz Barillas', 'Aguacatán', 'San Rafael Petzal',
    'San Gaspar Ixchil', 'Santiago Chimaltenango', 'Santa Ana Huista',
    'Unión Cantinil', 'Petatán'
  ],

  // Quiché
  'Quiché': [
    'Santa Cruz del Quiché', 'Chiché', 'Chinique', 'Zacualpa',
    'Chajul', 'Chichicastenango', 'Patzité', 'San Antonio Ilotenango',
    'San Pedro Jocopilas', 'Cunén', 'San Juan Cotzal', 'Joyabaj',
    'Nebaj', 'San Andrés Sajcabajá', 'Uspantán', 'Sacapulas',
    'San Bartolomé Jocotenango', 'Canillá', 'Chicamán', 'Ixcán',
    'Pachalum', 'Playa Grande'
  ],

  // Baja Verapaz
  'Baja Verapaz': [
    'Salamá', 'San Miguel Chicaj', 'Rabinal', 'Cubulco',
    'Granados', 'El Chol', 'San Jerónimo', 'Purulhá'
  ],

  // Alta Verapaz
  'Alta Verapaz': [
    'Cobán', 'Santa Cruz Verapaz', 'San Cristóbal Verapaz', 'Tactic',
    'Tamahú', 'Tucurú', 'Panzós', 'Senahú',
    'San Pedro Carchá', 'San Juan Chamelco', 'Lanquín', 'Cahabón',
    'Chisec', 'Chahal', 'Fray Bartolomé de las Casas', 'La Tinta',
    'Raxruhá'
  ],

  // Petén
  'Petén': [
    'Flores', 'San José', 'San Benito', 'San Andrés',
    'La Libertad', 'San Francisco', 'Santa Ana', 'Dolores',
    'San Luis', 'Sayaxché', 'Melchor de Mencos', 'Poptún',
    'Las Cruces', 'El Chal'
  ],

  // Izabal
  'Izabal': [
    'Puerto Barrios', 'Livingston', 'El Estor', 'Morales',
    'Los Amates'
  ],

  // Zacapa
  'Zacapa': [
    'Zacapa', 'Estanzuela', 'Río Hondo', 'Gualán',
    'Teculután', 'Usumatlán', 'Cabañas', 'San Diego',
    'La Unión', 'Huité'
  ],

  // Chiquimula
  'Chiquimula': [
    'Chiquimula', 'San José La Arada', 'San Juan Ermita', 'Jocotán',
    'Camotán', 'Olopa', 'Esquipulas', 'Concepción Las Minas',
    'Quezaltepeque', 'San Jacinto', 'Ipala'
  ],

  // Jalapa
  'Jalapa': [
    'Jalapa', 'San Pedro Pinula', 'San Luis Jilotepeque', 'San Manuel Chaparrón',
    'San Carlos Alzatate', 'Monjas', 'Mataquescuintla'
  ],

  // Jutiapa
  'Jutiapa': [
    'Jutiapa', 'El Progreso', 'Santa Catarina Mita', 'Agua Blanca',
    'Asunción Mita', 'Yupiltepeque', 'Atescatempa', 'Jerez',
    'El Adelanto', 'Zapotitlán', 'Comapa', 'Jalpatagua',
    'Conguaco', 'Moyuta', 'Pasaco', 'San José Acatempa',
    'Quesada'
  ]
};

/**
 * Busca el departamento al que pertenece una ciudad
 * @param {string} cityName - Nombre de la ciudad
 * @returns {string|null} - Nombre del departamento o null si no se encuentra
 */
function getDepartmentForCity(cityName) {
  if (!cityName || typeof cityName !== 'string') return null;
  
  const normalizedCity = cityName.trim();
  
  for (const [department, cities] of Object.entries(GUATEMALA_GEOGRAPHY)) {
    if (cities.some(city => 
      city.toLowerCase() === normalizedCity.toLowerCase() ||
      normalizedCity.toLowerCase().includes(city.toLowerCase()) ||
      city.toLowerCase().includes(normalizedCity.toLowerCase())
    )) {
      return department;
    }
  }
  
  return null;
}

/**
 * Obtiene todas las ciudades de un departamento
 * @param {string} departmentName - Nombre del departamento
 * @returns {string[]} - Array de ciudades del departamento
 */
function getCitiesForDepartment(departmentName) {
  if (!departmentName || typeof departmentName !== 'string') return [];
  
  const normalizedDept = departmentName.trim();
  
  for (const [department, cities] of Object.entries(GUATEMALA_GEOGRAPHY)) {
    if (department.toLowerCase() === normalizedDept.toLowerCase()) {
      return cities;
    }
  }
  
  return [];
}

/**
 * Valida si una ciudad pertenece a un departamento específico
 * @param {string} cityName - Nombre de la ciudad
 * @param {string} departmentName - Nombre del departamento
 * @returns {boolean} - True si la ciudad pertenece al departamento
 */
function isCityInDepartment(cityName, departmentName) {
  if (!cityName || !departmentName) return false;
  
  const cities = getCitiesForDepartment(departmentName);
  return cities.some(city => 
    city.toLowerCase() === cityName.toLowerCase() ||
    cityName.toLowerCase().includes(city.toLowerCase()) ||
    city.toLowerCase().includes(cityName.toLowerCase())
  );
}

/**
 * Normaliza información geográfica detectando departamentos automáticamente
 * @param {Object} geoInfo - Información geográfica {city, department, pais}
 * @returns {Object} - Información normalizada y completada
 */
function normalizeGeographicInfo(geoInfo) {
  let { city, department, pais } = geoInfo;
  
  // Si tenemos ciudad pero no departamento, intentar detectarlo
  if (city && !department) {
    const detectedDept = getDepartmentForCity(city);
    if (detectedDept) {
      department = detectedDept;
      console.log(`🔍 Departamento detectado automáticamente: ${city} → ${detectedDept}`);
    }
  }
  
  // Si no hay país especificado pero hay departamento guatemalteco, asumir Guatemala
  if (department && !pais) {
    if (Object.keys(GUATEMALA_GEOGRAPHY).includes(department)) {
      pais = 'Guatemala';
    }
  }
  
  return {
    city: city?.trim() || null,
    department: department?.trim() || null,
    pais: pais?.trim() || null
  };
}

module.exports = {
  GUATEMALA_GEOGRAPHY,
  getDepartmentForCity,
  getCitiesForDepartment,
  isCityInDepartment,
  normalizeGeographicInfo
}; 