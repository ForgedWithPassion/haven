.PHONY: lint test check install dev build clean docker-dev docker-stop docker-build

install:
	npm install
	cd client && npm install

lint:
	npm run lint
	npm run typecheck

test:
	npm run test

check: lint test
	@echo "All checks passed!"

# Development
dev:
	@echo "Starting client and relay in development mode..."
	@echo "Run 'cd client && npm run dev' in one terminal"
	@echo "Run 'cd relay && make run' in another terminal"

build:
	cd client && npm run build
	cd relay && make build

clean:
	rm -rf client/dist client/node_modules
	cd relay && make clean

# Docker commands
docker-dev:
	docker compose --profile dev up --build

docker-stop:
	docker compose --profile dev down

docker-build:
	docker build -t haven-client ./client
	docker build -t haven-relay ./relay
