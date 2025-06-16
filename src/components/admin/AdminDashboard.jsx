import React, { useState } from 'react';
import LayersLimitsManager from './LayersLimitsManager';
import InvitationCodesManager from './InvitationCodesManager';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('limits');

  const tabs = [
    {
      id: 'limits',
      name: 'Límites de Capas',
      icon: '📊',
      description: 'Gestionar límites de capas por usuario'
    },
    {
      id: 'invitations',
      name: 'Códigos de Invitación',
      icon: '🎫',
      description: 'Crear y gestionar códigos de invitación'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'limits':
        return <LayersLimitsManager />;
      case 'invitations':
        return <InvitationCodesManager />;
      default:
        return <div className="p-6">Selecciona una pestaña</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Global */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
                  <p className="text-sm text-gray-500">ExtractorW Admin Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                🟢 Sistema activo
              </div>
              <div className="text-sm text-gray-500 border-l pl-3">
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tab.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold">{tab.name}</div>
                    <div className="text-xs text-gray-500">{tab.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {renderTabContent()}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              © 2024 ExtractorW Admin Panel - Sistema de Gestión de Límites de Capas
            </div>
            <div className="flex items-center gap-4">
              <span>Versión 1.0.0</span>
              <span>•</span>
              <span>PulseJ Integration</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 