"""
Configuración para Laura Memory usando Pydantic BaseSettings.
"""

import os
import logging
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class LauraMemorySettings(BaseSettings):
    """Configuración para el sistema de memoria de Laura."""
    
    zep_api_key: str = Field(..., env="ZEP_API_KEY")
    zep_url: str = Field("https://api.getzep.com", env="ZEP_URL")
    session_id: str = Field("laura_memory_session", env="LAURA_SESSION_ID")
    
    # Configuración para PulsePolitics (memoria compartida de grupo)
    pulsepolitics_session_id: str = Field("group:pulsepolitics", env="PULSE_POLITICS_SESSION_ID")
    
    # Configuración para UserHandles (memoria compartida de grupo para handles de usuarios)
    userhandles_session_id: str = Field("userhandles_shared_session", env="USERHANDLES_SESSION_ID")
    userhandles_user_id: str = Field("pulse_politics_system", env="USERHANDLES_USER_ID")
    
    # Configuración adicional
    memory_enabled: bool = Field(True, env="LAURA_MEMORY_ENABLED")
    memory_url: str = Field("http://localhost:5001", env="LAURA_MEMORY_URL")
    debug: bool = Field(False, env="DEBUG")
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "extra": "ignore"
    }
    
    @field_validator("zep_api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """Validate that API key is not a placeholder."""
        if v in ["test_key_for_development", "your_zep_api_key_here", "", "test"]:
            logger.warning("⚠️ Using placeholder API key - service may not work properly")
        return v
    
    @field_validator("zep_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate ZEP URL format."""
        if not v.startswith(("http://", "https://")):
            raise ValueError("ZEP_URL must start with http:// or https://")
        return v.rstrip("/")  # Remove trailing slash
    
    def is_production_ready(self) -> bool:
        """Check if configuration is ready for production."""
        return (
            self.zep_api_key not in ["test_key_for_development", "your_zep_api_key_here"]
            and self.zep_url.startswith("https://")
            and self.memory_enabled
        )


# Instancia global de configuración
try:
    settings = LauraMemorySettings()
    if settings.debug:
        logger.info("🔧 Configuración de Laura Memory cargada en modo debug")
    if not settings.is_production_ready():
        logger.warning("⚠️ Configuración no lista para producción")
except Exception as e:
    logger.error(f"❌ Error cargando configuración: {e}")
    raise