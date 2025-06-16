import React, { useState, useEffect } from 'react';

const InvitationCodesManager = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    userType: 'Beta',
    layersLimit: 3,
    maxUses: 1,
    expirationDate: ''
  });

  const userTypes = {
    'Beta': { limit: 3, color: 'bg-gray-100 text-gray-800' },
    'Alpha': { limit: 5, color: 'bg-blue-100 text-blue-800' },
    'Creador': { limit: 10, color: 'bg-purple-100 text-purple-800' },
    'Premium': { limit: 20, color: 'bg-gold-100 text-gold-800' }
  };

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/invitation-codes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setCodes(data.codes || []);
    } catch (err) {
      console.error('Error cargando códigos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleUserTypeChange = (userType) => {
    setFormData({
      ...formData,
      userType,
      layersLimit: userTypes[userType].limit
    });
  };

  const createCode = async () => {
    try {
      const payload = {
        code: formData.code || generateCode(),
        description: formData.description,
        userType: formData.userType,
        layersLimit: formData.layersLimit,
        maxUses: formData.maxUses,
        expirationDate: formData.expirationDate || null
      };

      const response = await fetch('/api/admin/invitation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setCodes(prev => [result.code, ...prev]);
      
      // Reset form
      setFormData({
        code: '',
        description: '',
        userType: 'Beta',
        layersLimit: 3,
        maxUses: 1,
        expirationDate: ''
      });
      setShowCreateForm(false);
      
      alert(`Código creado exitosamente: ${result.code.code}`);
    } catch (err) {
      console.error('Error creando código:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const updateCode = async (codeId, updates) => {
    try {
      const response = await fetch(`/api/admin/invitation-codes/${codeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setCodes(prev => prev.map(code => 
        code.id === codeId ? result.code : code
      ));
      
      setEditingCode(null);
      alert('Código actualizado exitosamente');
    } catch (err) {
      console.error('Error actualizando código:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const deleteCode = async (codeId, codeName) => {
    if (!confirm(`¿Estás seguro de eliminar el código ${codeName}?`)) return;

    try {
      const response = await fetch(`/api/admin/invitation-codes/${codeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      setCodes(prev => prev.filter(code => code.id !== codeId));
      alert('Código eliminado exitosamente');
    } catch (err) {
      console.error('Error eliminando código:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const generateBulkCodes = async () => {
    const quantity = prompt('¿Cuántos códigos Beta quieres generar?', '5');
    if (!quantity || isNaN(quantity) || quantity < 1) return;

    try {
      const response = await fetch('/api/admin/invitation-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          quantity: parseInt(quantity),
          userType: 'Beta',
          description: `Generación masiva - ${new Date().toLocaleDateString()}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setCodes(prev => [...result.codes, ...prev]);
      alert(`${result.codes.length} códigos generados exitosamente`);
    } catch (err) {
      console.error('Error generando códigos:', err);
      alert(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin expiración';
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Cargando códigos de invitación...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="text-red-800">
            <h3 className="font-semibold text-lg mb-2">Error</h3>
            <p>{error}</p>
            <button 
              onClick={loadCodes}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Códigos de Invitación</h1>
          <p className="text-gray-600 mt-1">
            Gestiona códigos de invitación con límites personalizados
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateBulkCodes}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📦 Generar Masivo
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ➕ Crear Código
          </button>
          <button
            onClick={loadCodes}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Códigos</div>
          <div className="text-2xl font-bold text-blue-600">{codes.length}</div>
        </div>
        <div className="border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Activos</div>
          <div className="text-2xl font-bold text-green-600">
            {codes.filter(c => c.is_active && !isExpired(c.expiration_date)).length}
          </div>
        </div>
        <div className="border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Usados</div>
          <div className="text-2xl font-bold text-orange-600">
            {codes.filter(c => c.used_count > 0).length}
          </div>
        </div>
        <div className="border rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Expirados</div>
          <div className="text-2xl font-bold text-red-600">
            {codes.filter(c => isExpired(c.expiration_date)).length}
          </div>
        </div>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="border rounded-lg shadow-sm p-6 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">Crear Nuevo Código</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código (opcional)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                placeholder="Dejar vacío para auto-generar"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descripción del código"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Usuario
              </label>
              <select
                value={formData.userType}
                onChange={(e) => handleUserTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.keys(userTypes).map(type => (
                  <option key={type} value={type}>
                    {type} ({userTypes[type].limit} capas)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Límite de Capas
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.layersLimit}
                onChange={(e) => setFormData({...formData, layersLimit: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usos Máximos
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxUses}
                onChange={(e) => setFormData({...formData, maxUses: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Expiración (opcional)
              </label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({...formData, expirationDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={createCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ✓ Crear Código
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ✗ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de códigos */}
      <div className="border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Códigos Existentes ({codes.length})</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {codes.map((code) => (
              <div
                key={code.id}
                className={`p-4 border rounded-lg transition-colors ${
                  isExpired(code.expiration_date) ? 'bg-red-50 border-red-200' :
                  !code.is_active ? 'bg-gray-50 border-gray-200' :
                  'hover:bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-blue-600">
                        {code.code}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${userTypes[code.user_type]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {code.user_type}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-purple-100 text-purple-800">
                        {code.layerslimit} capas
                      </span>
                      {!code.is_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800">
                          Inactivo
                        </span>
                      )}
                      {isExpired(code.expiration_date) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800">
                          Expirado
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {code.description || 'Sin descripción'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-4">
                      <span>Usos: {code.used_count}/{code.max_uses}</span>
                      <span>Expira: {formatDate(code.expiration_date)}</span>
                      <span>Creado: {new Date(code.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(code.code)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      📋 Copiar
                    </button>
                    <button
                      onClick={() => setEditingCode(code.id)}
                      className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => deleteCode(code.id, code.code)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {codes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay códigos de invitación creados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationCodesManager; 