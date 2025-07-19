"""
Tests unitarios para Laura Memory usando pytest y vcr.py.
"""

import pytest
import vcr
from unittest.mock import patch, MagicMock
from datetime import datetime

from memory import add_public_memory, search_public_memory, get_memory_stats, clear_memory
from detectors import is_new_user, is_new_term, is_relevant_fact, should_save_to_memory
from integration import LauraMemoryIntegration


# Configuración de VCR para grabar/reproducir requests HTTP
my_vcr = vcr.VCR(
    serializer='json',
    cassette_library_dir='tests/cassettes',
    record_mode='once',
    match_on=['uri', 'method'],
    filter_headers=['authorization']
)


@pytest.fixture
def mock_zep_client():
    """Fixture para mockear el cliente de Zep."""
    with patch('memory._get_zep_client') as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        yield mock_client


@pytest.fixture
def sample_metadata():
    """Fixture con metadatos de ejemplo."""
    return {
        'source': 'nitter_context',
        'tags': ['politica', 'congreso'],
        'ts': datetime.utcnow().isoformat()
    }


class TestMemoryCore:
    """Tests para las funciones principales de memoria."""
    
    def test_add_public_memory_success(self, mock_zep_client):
        """Test añadir contenido a memoria exitosamente."""
        # Arrange
        content = "El Congreso aprobó la Ley X"
        metadata = {'source': 'nitter_context', 'tags': ['politica']}
        
        # Act
        add_public_memory(content, metadata)
        
        # Assert
        mock_zep_client.memory.add.assert_called_once()
        call_args = mock_zep_client.memory.add.call_args
        assert call_args[1]['session_id'] == 'public/global'
        assert len(call_args[1]['messages']) == 1
        assert call_args[1]['messages'][0].content == content
        assert call_args[1]['messages'][0].role == 'assistant'
    
    def test_add_public_memory_empty_content(self, mock_zep_client):
        """Test no guardar contenido vacío."""
        # Act
        add_public_memory("")
        add_public_memory("   ")
        add_public_memory(None)
        
        # Assert
        mock_zep_client.memory.add.assert_not_called()
    
    def test_add_public_memory_with_default_timestamp(self, mock_zep_client):
        """Test que se añada timestamp por defecto."""
        # Arrange
        content = "Contenido de prueba"
        
        # Act
        add_public_memory(content)
        
        # Assert
        call_args = mock_zep_client.memory.add.call_args
        metadata = call_args[1]['messages'][0].metadata
        assert 'ts' in metadata
        assert isinstance(metadata['ts'], str)
    
    def test_search_public_memory_success(self, mock_zep_client):
        """Test búsqueda exitosa en memoria."""
        # Arrange
        query = "Ley X"
        mock_edge = MagicMock()
        mock_edge.fact = "El Congreso aprobó la Ley X"
        mock_result = MagicMock()
        mock_result.edges = [mock_edge]
        mock_zep_client.graph.search.return_value = mock_result
        
        # Act
        results = search_public_memory(query)
        
        # Assert
        mock_zep_client.graph.search.assert_called_once_with(
            query=query,
            user_id='public/global',
            limit=5
        )
        assert len(results) == 1
        assert results[0] == "El Congreso aprobó la Ley X"
    
    def test_search_public_memory_empty_query(self, mock_zep_client):
        """Test búsqueda con query vacía."""
        # Act
        results = search_public_memory("")
        results2 = search_public_memory("   ")
        
        # Assert
        mock_zep_client.graph.search.assert_not_called()
        assert results == []
        assert results2 == []
    
    def test_search_public_memory_with_limit(self, mock_zep_client):
        """Test búsqueda con límite específico."""
        # Arrange
        query = "congreso"
        limit = 10
        mock_result = MagicMock()
        mock_result.edges = []
        mock_zep_client.graph.search.return_value = mock_result
        
        # Act
        search_public_memory(query, limit)
        
        # Assert
        mock_zep_client.graph.search.assert_called_once_with(
            query=query,
            user_id='public/global',
            limit=limit
        )
    
    def test_get_memory_stats_success(self, mock_zep_client):
        """Test obtener estadísticas de memoria."""
        # Arrange
        mock_session = MagicMock()
        mock_session.messages = [1, 2, 3]  # 3 mensajes
        mock_session.created_at = '2023-01-01T00:00:00Z'
        mock_session.updated_at = '2023-01-02T00:00:00Z'
        mock_zep_client.memory.get.return_value = mock_session
        
        # Act
        stats = get_memory_stats()
        
        # Assert
        assert stats['session_id'] == 'public/global'
        assert stats['message_count'] == 3
        assert stats['created_at'] == '2023-01-01T00:00:00Z'
        assert stats['updated_at'] == '2023-01-02T00:00:00Z'
    
    def test_clear_memory_success(self, mock_zep_client):
        """Test limpiar memoria exitosamente."""
        # Act
        clear_memory()
        
        # Assert
        mock_zep_client.memory.delete.assert_called_once_with(
            session_id='public/global'
        )


class TestDetectors:
    """Tests para los detectores heurísticos."""
    
    def test_is_new_user_positive_cases(self):
        """Test detectar usuario nuevo - casos positivos."""
        test_cases = [
            "nuevo usuario @juanperez encontrado",
            "descubrí a @maria_lopez",
            "encontré información sobre @politico_gt",
            "ML Discovery: @carlos_gt es diputado",
            "esta persona @usuario_oficial es relevante"
        ]
        
        for content in test_cases:
            assert is_new_user(content), f"Failed for: {content}"
    
    def test_is_new_user_metadata_source(self):
        """Test detectar usuario nuevo por metadata."""
        content = "Usuario encontrado"
        metadata = {'source': 'ml_discovery'}
        
        assert is_new_user(content, metadata)
    
    def test_is_new_user_negative_cases(self):
        """Test detectar usuario nuevo - casos negativos."""
        test_cases = [
            "hola mundo",
            "información general",
            "no hay usuarios aquí",
            "solo texto normal"
        ]
        
        for content in test_cases:
            assert not is_new_user(content), f"Failed for: {content}"
    
    def test_is_new_term_positive_cases(self):
        """Test detectar término nuevo - casos positivos."""
        test_cases = [
            "nueva ley de transparencia",
            "decreto 123-2023",
            "proyecto de reforma",
            "acuerdo gubernativo",
            "crisis económica",
            "#NuevaLey es trending",
            "@CongresoGt anunció",
            "el ministro de educación declaró"
        ]
        
        for content in test_cases:
            assert is_new_term(content), f"Failed for: {content}"
    
    def test_is_new_term_length_requirement(self):
        """Test detectar término nuevo por longitud."""
        short_content = "ok"
        long_content = "este es un contenido más largo que debería ser detectado"
        
        assert not is_new_term(short_content)
        assert is_new_term(long_content)
    
    def test_is_relevant_fact_positive_cases(self):
        """Test detectar hecho relevante - casos positivos."""
        test_cases = [
            "El congreso aprobó la ley",
            "El presidente anunció nuevas medidas",
            "Se presentó una nueva propuesta",
            "Ocurrió un evento importante",
            "El candidato ganó las elecciones",
            "Los precios aumentaron significativamente",
            "Nueva política fue implementada",
            "Crisis política en el país"
        ]
        
        for content in test_cases:
            assert is_relevant_fact(content), f"Failed for: {content}"
    
    def test_is_relevant_fact_source_metadata(self):
        """Test detectar hecho relevante por fuente confiable."""
        content = "Información importante"
        metadata = {'source': 'nitter_context'}
        
        assert is_relevant_fact(content, metadata)
    
    def test_is_relevant_fact_tags_metadata(self):
        """Test detectar hecho relevante por tags."""
        content = "Información"
        metadata = {'tags': ['politica', 'importante']}
        
        assert is_relevant_fact(content, metadata)
    
    def test_should_save_to_memory_positive(self):
        """Test decisión de guardar en memoria - caso positivo."""
        content = "El congreso aprobó la nueva ley de transparencia"
        metadata = {'source': 'nitter_context'}
        
        result = should_save_to_memory(content, metadata)
        
        assert result['should_save'] is True
        assert 'metadata' in result
        assert 'reasons' in result
        assert 'tags' in result['metadata']
        assert 'politica' in result['metadata']['tags']
    
    def test_should_save_to_memory_negative(self):
        """Test decisión de guardar en memoria - caso negativo."""
        content = "hola"  # Muy corto
        
        result = should_save_to_memory(content)
        
        assert result['should_save'] is False
        assert 'reason' in result
    
    def test_should_save_to_memory_with_auto_tags(self):
        """Test generación automática de tags."""
        content = "Nuevo usuario @politico_gt es diputado. Crisis política."
        
        result = should_save_to_memory(content)
        
        assert result['should_save'] is True
        expected_tags = ['new_user', 'new_term', 'relevant_fact', 'politica', 'urgente']
        for tag in expected_tags:
            assert tag in result['metadata']['tags']


class TestIntegration:
    """Tests para la integración con el agente Laura."""
    
    @pytest.fixture
    def integration(self):
        """Fixture para la integración."""
        return LauraMemoryIntegration()
    
    def test_extract_content_from_nitter_profile(self, integration):
        """Test extraer contenido de nitter_profile."""
        tool_result = {
            'profile_info': {
                'display_name': 'Juan Pérez',
                'username': 'juanperez',
                'bio': 'Diputado del Congreso'
            },
            'tweets': [
                {'content': 'Tweet importante sobre política'},
                {'content': 'Otro tweet relevante'}
            ]
        }
        
        content = integration._extract_content_from_tool_result('nitter_profile', tool_result)
        
        assert 'Perfil: Juan Pérez (@juanperez)' in content
        assert 'Bio: Diputado del Congreso' in content
        assert 'Tweet: Tweet importante sobre política' in content
    
    def test_extract_content_from_nitter_context(self, integration):
        """Test extraer contenido de nitter_context."""
        tool_result = {
            'summary': 'Resumen de la conversación',
            'tweets': [
                {'content': 'Tweet sobre el tema'},
                {'content': 'Otro tweet relacionado'}
            ]
        }
        
        content = integration._extract_content_from_tool_result('nitter_context', tool_result)
        
        assert 'Contexto: Resumen de la conversación' in content
        assert 'Tweet: Tweet sobre el tema' in content
    
    def test_extract_content_from_perplexity_search(self, integration):
        """Test extraer contenido de perplexity_search."""
        tool_result = {
            'content': 'Información encontrada por Perplexity',
            'summary': 'Resumen de la información'
        }
        
        content = integration._extract_content_from_tool_result('perplexity_search', tool_result)
        
        assert 'Información: Información encontrada por Perplexity' in content
        assert 'Resumen: Resumen de la información' in content
    
    def test_extract_content_from_ml_discovery(self, integration):
        """Test extraer contenido de ml_discovery."""
        tool_result = {
            'entity': 'Juan Pérez',
            'twitter_username': 'juanperez_gt',
            'description': 'Diputado del Congreso'
        }
        
        content = integration._extract_content_from_tool_result('ml_discovery', tool_result)
        
        assert 'Usuario descubierto: Juan Pérez' in content
        assert 'Username: @juanperez_gt' in content
        assert 'Descripción: Diputado del Congreso' in content
    
    @patch('integration.add_public_memory')
    @patch('integration.should_save_to_memory')
    def test_process_tool_result_success(self, mock_should_save, mock_add_memory, integration):
        """Test procesar resultado de herramienta exitosamente."""
        # Arrange
        mock_should_save.return_value = {
            'should_save': True,
            'metadata': {'tags': ['test'], 'source': 'nitter_context'},
            'reasons': {'relevant_fact': True}
        }
        
        tool_result = {
            'summary': 'Información relevante',
            'tweets': [{'content': 'Tweet importante'}]
        }
        
        # Act
        result = integration.process_tool_result('nitter_context', tool_result, 'test query')
        
        # Assert
        assert result['saved'] is True
        assert 'content' in result
        assert 'metadata' in result
        assert 'reasons' in result
        mock_add_memory.assert_called_once()
    
    @patch('integration.search_public_memory')
    def test_enhance_query_with_memory(self, mock_search, integration):
        """Test mejorar query con información de memoria."""
        # Arrange
        mock_search.return_value = [
            "El congreso aprobó la ley",
            "Nueva información relevante"
        ]
        
        # Act
        result = integration.enhance_query_with_memory("¿Qué pasó con el congreso?")
        
        # Assert
        assert result['enhanced_query'] != "¿Qué pasó con el congreso?"  # Query fue modificada
        assert 'CONTEXTO DE MEMORIA:' in result['enhanced_query']
        assert result['memory_results'] == mock_search.return_value
        assert len(result['memory_results']) == 2
    
    @patch('integration.add_public_memory')
    def test_save_user_discovery(self, mock_add_memory, integration):
        """Test guardar usuario descubierto."""
        # Act
        result = integration.save_user_discovery(
            'Juan Pérez',
            'juanperez_gt',
            'Diputado del Congreso',
            'politico'
        )
        
        # Assert
        assert result is True
        mock_add_memory.assert_called_once()
        
        # Verificar contenido y metadatos
        call_args = mock_add_memory.call_args
        content = call_args[0][0]
        metadata = call_args[0][1]
        
        assert 'Usuario descubierto: Juan Pérez (@juanperez_gt)' in content
        assert 'Diputado del Congreso' in content
        assert metadata['source'] == 'ml_discovery'
        assert 'new_user' in metadata['tags']
        assert 'politico' in metadata['tags']
        assert metadata['twitter_username'] == 'juanperez_gt'


# Configuración de pytest
@pytest.fixture(autouse=True)
def setup_environment():
    """Setup para todos los tests."""
    import os
    os.environ['ZEP_API_KEY'] = 'test_key'
    os.environ['ZEP_URL'] = 'https://api.getzep.com'
    os.environ['LAURA_SESSION_ID'] = 'test/session'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])