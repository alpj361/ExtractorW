import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

const LayersLimitsManager = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [newLimit, setNewLimit] = useState(3);
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Cargar datos de usuarios y límites
  const loadUsersData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);
      params.append('limit', '50');

      const response = await fetch(`/api/admin/users/layers-limits?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.users);
      setStats(data.statistics);
    } catch (err) {
      console.error('Error cargando datos de usuarios:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Actualizar límite de usuario
  const updateUserLimit = async (userId, limit, reason) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/layers-limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          layersLimit: limit,
          reason: reason
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Actualizar estado local
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, layerslimit: limit }
          : user
      ));

      setEditingUser(null);
      setNewLimit(3);
      setReason('');

      alert(`Límite actualizado exitosamente para ${result.user.email}`);
    } catch (err) {
      console.error('Error actualizando límite:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  useEffect(() => {
    loadUsersData();
  }, [searchTerm, roleFilter]);

  const startEditing = (user) => {
    setEditingUser(user.id);
    setNewLimit(user.layerslimit);
    setReason('');
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setNewLimit(3);
    setReason('');
  };

  const handleSave = () => {
    if (editingUser && newLimit >= 1 && newLimit <= 50) {
      updateUserLimit(editingUser, newLimit, reason);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'moderator': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'premium': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLimitColor = (limit) => {
    if (limit >= 15) return 'bg-green-100 text-green-800 border-green-200';
    if (limit >= 8) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (limit >= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Cargando gestión de límites...</div>
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
              onClick={loadUsersData}
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Límites de Capas</h1>
          <p className="text-gray-600 mt-1">
            Administra los límites de capas por usuario
          </p>
        </div>
        <button
          onClick={loadUsersData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg shadow-sm">
            <div className="p-4">
              <div className="text-sm text-gray-600">Total Usuarios</div>
              <div className="text-2xl font-bold text-blue-600">{stats.total_users}</div>
            </div>
          </div>
          <div className="border rounded-lg shadow-sm">
            <div className="p-4">
              <div className="text-sm text-gray-600">Límite Promedio</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.average_limit.toFixed(1)} capas
              </div>
            </div>
          </div>
          <div className="border rounded-lg shadow-sm">
            <div className="p-4">
              <div className="text-sm text-gray-600">Distribución</div>
              <div className="text-xs space-y-1">
                {Object.entries(stats.distribution).map(([limit, count]) => (
                  <div key={limit} className="flex justify-between">
                    <span>{limit} capas:</span>
                    <span className="font-semibold">{count} usuarios</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="border rounded-lg shadow-sm">
        <div className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los roles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderador</option>
                <option value="premium">Premium</option>
                <option value="user">Usuario</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Usuarios y Límites ({users.length})</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{user.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                    <span className="text-sm text-gray-500">
                      Creado: {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {editingUser === user.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-2">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={newLimit}
                          onChange={(e) => setNewLimit(parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <input
                          type="text"
                          placeholder="Razón del cambio"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={handleSave}
                          disabled={newLimit < 1 || newLimit > 50}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✓ Guardar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                          ✗ Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getLimitColor(user.layerslimit)}`}>
                        {user.layerslimit} capas
                      </span>
                      <button
                        onClick={() => startEditing(user)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron usuarios con los filtros aplicados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersLimitsManager; 