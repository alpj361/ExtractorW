.PHONY: help build up down restart logs status clean deploy

# Variables
CONTAINER_NAME = extractorw-api
COMPOSE_FILE = docker-compose.yml
DEFAULT_DOMAIN = server.standatpd.com

help: ## Mostrar ayuda
	@echo "Comandos disponibles para ExtractorW:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Construir la imagen Docker
	docker-compose build --no-cache

up: ## Iniciar los contenedores
	docker-compose up -d

down: ## Detener y remover contenedores
	docker-compose down

restart: ## Reiniciar contenedores
	docker-compose restart

logs: ## Ver logs en tiempo real
	docker-compose logs -f

logs-tail: ## Ver últimos 50 logs
	docker-compose logs --tail=50

status: ## Ver estado de contenedores
	docker-compose ps

clean: ## Limpiar contenedores, imágenes y volúmenes no usados
	docker system prune -f
	docker volume prune -f

deploy: ## Ejecutar deployment completo
	chmod +x deploy.sh
	./deploy.sh

shell: ## Acceder al shell del contenedor
	docker exec -it $(CONTAINER_NAME) sh

env: ## Crear archivo .env desde template
	cp env-template.txt .env
	@echo "📝 Archivo .env creado. Por favor editalo con tus valores reales."

backup-logs: ## Hacer backup de logs
	docker-compose logs > backup-logs-$(shell date +%Y%m%d-%H%M%S).log

# Comandos de desarrollo
dev-build: ## Build para desarrollo
	docker build -t extractorw-dev .

dev-run: ## Ejecutar en modo desarrollo
	docker run -p 8080:8080 --env-file .env extractorw-dev

# Comandos de mantenimiento
update: down build up ## Actualizar aplicación (down + build + up)

health: ## Verificar salud de la aplicación
	curl -f http://localhost:8080/health || echo "❌ Aplicación no responde"

# === COMANDOS PARA SUBDOMINIO ===

setup-subdomain: ## Configurar subdominio (por defecto: server.standatpd.com, o usa DOMAIN=otro.dominio.com)
	@DOMAIN_TO_USE=$${DOMAIN:-$(DEFAULT_DOMAIN)}; \
	echo "🚀 Configurando dominio: $$DOMAIN_TO_USE"; \
	chmod +x setup-subdomain.sh; \
	./setup-subdomain.sh $$DOMAIN_TO_USE

ssl: ## Configurar SSL para subdominio (por defecto: server.standatpd.com, o usa DOMAIN=otro.dominio.com)
	@DOMAIN_TO_USE=$${DOMAIN:-$(DEFAULT_DOMAIN)}; \
	echo "🔒 Configurando SSL para: $$DOMAIN_TO_USE"; \
	sudo certbot --nginx -d $$DOMAIN_TO_USE

check-subdomain: ## Verificar configuración de subdominio (por defecto: server.standatpd.com, o usa DOMAIN=otro.dominio.com)
	@DOMAIN_TO_USE=$${DOMAIN:-$(DEFAULT_DOMAIN)}; \
	echo "🔍 Verificando $$DOMAIN_TO_USE..."; \
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
	echo "📡 DNS Resolution:"; \
	nslookup $$DOMAIN_TO_USE || echo "❌ DNS no resuelve"; \
	echo ""; \
	echo "🌐 HTTP Health Check:"; \
	curl -s -o /dev/null -w "Status: %{http_code}\nTime: %{time_total}s\n" http://$$DOMAIN_TO_USE/health || echo "❌ HTTP no responde"; \
	echo ""; \
	echo "🔒 HTTPS Health Check:"; \
	curl -s -o /dev/null -w "Status: %{http_code}\nTime: %{time_total}s\n" https://$$DOMAIN_TO_USE/health || echo "⚠️ HTTPS no configurado o no responde"; \
	echo ""; \
	echo "📊 Nginx Status:"; \
	sudo nginx -t && echo "✅ Configuración Nginx válida" || echo "❌ Error en configuración Nginx"

nginx-logs: ## Ver logs de Nginx para ExtractorW
	sudo tail -f /var/log/nginx/extractorw_access.log /var/log/nginx/extractorw_error.log

nginx-reload: ## Recargar configuración de Nginx
	sudo nginx -t && sudo systemctl reload nginx || echo "❌ Error en configuración"

# Comando completo para setup inicial con server.standatpd.com
setup-complete: ## Setup completo con server.standatpd.com (por defecto) o usa DOMAIN=otro.dominio.com
	@DOMAIN_TO_USE=$${DOMAIN:-$(DEFAULT_DOMAIN)}; \
	echo "🚀 Setup completo para $$DOMAIN_TO_USE"; \
	make deploy; \
	make setup-subdomain DOMAIN=$$DOMAIN_TO_USE; \
	echo ""; \
	echo "🎉 Setup completo! Próximos pasos:"; \
	echo "1. ✅ DNS ya configurado para $$DOMAIN_TO_USE"; \
	echo "2. Espera propagación DNS (5-30 min)"; \
	echo "3. Ejecuta: make ssl DOMAIN=$$DOMAIN_TO_USE"; \
	echo "4. Verifica: make check-subdomain DOMAIN=$$DOMAIN_TO_USE"

# Comandos rápidos para server.standatpd.com
quick-setup: ## Setup rápido para server.standatpd.com
	make setup-complete

quick-ssl: ## SSL rápido para server.standatpd.com
	make ssl

quick-check: ## Verificación rápida de server.standatpd.com
	make check-subdomain 