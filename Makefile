.PHONY: help dev build start stop logs clean migrate studio shell-api shell-db

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services (attached)
	docker compose up

build: ## Build all Docker images
	docker compose build

start: ## Start in production mode (detached)
	docker compose up -d

stop: ## Stop all services
	docker compose down

logs: ## Tail all service logs
	docker compose logs -f

clean: ## Remove containers, volumes, and locally built images
	docker compose down -v --rmi local

migrate: ## Run pending Prisma migrations inside the running api container
	docker compose exec api npx prisma migrate deploy

studio: ## Open Prisma Studio (requires local Node + DATABASE_URL in backend/.env)
	cd backend && npx prisma studio

shell-api: ## Open a shell in the running api container
	docker compose exec api sh

shell-db: ## Open psql in the running db container
	docker compose exec db psql -U postgres -d unsiloed_calibration
