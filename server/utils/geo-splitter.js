// Nueva utilidad para dividir cadenas geográficas en partes atómicas

const { getDepartmentForCity } = require('./guatemala-geography');

const DEPARTMENTS = [
  'Alta Verapaz','Baja Verapaz','Chimaltenango','Chiquimula','El Progreso','Escuintla','Guatemala','Huehuetenango','Izabal','Jalapa','Jutiapa','Petén','Quetzaltenango','Quiché','Retalhuleu','Sacatepéquez','San Marcos','Santa Rosa','Sololá','Suchitepéquez','Totonicapán','Zacapa'
];

/**
 * Convierte una cadena como "Quiché, Baja Verapaz, Zacapa, Guatemala" en
 * objetos { type, name, parent }
 */
function splitLocations(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(loc => {
      // Si es departamento
      if (DEPARTMENTS.includes(loc)) {
        return { type: 'departamento', name: loc };
      }

      // Caso especial Antigua Guatemala
      if (loc.toLowerCase() === 'antigua' || loc.toLowerCase() === 'antigua guatemala') {
        return { type: 'ciudad', name: 'Antigua Guatemala', parent: 'Sacatepéquez' };
      }

      // Detectar si se conoce su departamento
      const dep = getDepartmentForCity(loc);
      return {
        type: 'ciudad',
        name: loc,
        parent: dep || null,
      };
    });
}

module.exports = {
  splitLocations,
  DEPARTMENTS,
}; 