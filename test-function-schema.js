const mcpService = require('./server/services/mcp');

async function testFunctionSchema() {
  try {
    console.log('🧪 Probando generación de esquema de funciones...\n');
    
    // Obtener herramientas disponibles
    const availableTools = await mcpService.listAvailableTools();
    console.log('📋 Herramientas disponibles:', availableTools.length);
    
    // Transformar al formato OpenAI (misma lógica que en viztaChat.js)
    const functions = availableTools.map(tool => {
      // Transformar parámetros del formato MCP al formato OpenAI
      const properties = {};
      const required = [];
      
      Object.keys(tool.parameters).forEach(key => {
        const param = tool.parameters[key];
        properties[key] = {
          type: param.type,
          description: param.description
        };
        
        // Agregar constrains adicionales si existen
        if (param.min !== undefined) properties[key].minimum = param.min;
        if (param.max !== undefined) properties[key].maximum = param.max;
        if (param.default !== undefined) properties[key].default = param.default;
        
        // Agregar a required si es necesario
        if (param.required === true) {
          required.push(key);
        }
      });
      
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: properties,
          required: required
        }
      };
    });
    
    console.log('\n🔍 Esquema generado para OpenAI:');
    console.log(JSON.stringify(functions, null, 2));
    
    // Validar que no hay valores 'false' en arrays required
    functions.forEach(func => {
      if (func.parameters.required.includes(false)) {
        console.error(`❌ Error: función ${func.name} tiene 'false' en required array`);
        process.exit(1);
      }
    });
    
    console.log('\n✅ Esquema válido - no hay valores false en arrays required');
    console.log('🎯 El esquema debería funcionar con OpenAI');
    
  } catch (error) {
    console.error('❌ Error probando esquema:', error);
    process.exit(1);
  }
}

testFunctionSchema(); 