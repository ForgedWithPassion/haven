.PHONY: lint test check install

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
