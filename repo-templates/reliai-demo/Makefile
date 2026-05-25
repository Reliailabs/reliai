.PHONY: dev stop logs pull

dev:
	docker compose up --build

dev-pulse:
	docker compose -f docker-compose.yml -f docker-compose.pulse.yml up --build

stop:
	docker compose down

logs:
	docker compose logs -f traffic-generator agent

logs-pulse:
	docker compose -f docker-compose.yml -f docker-compose.pulse.yml logs -f traffic-generator agent web

pull:
	docker compose pull api web
