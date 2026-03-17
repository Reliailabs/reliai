.PHONY: dev stop logs pull

dev:
	docker compose up --build

stop:
	docker compose down

logs:
	docker compose logs -f traffic-generator agent

pull:
	docker compose pull api web
