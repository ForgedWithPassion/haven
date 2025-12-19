.PHONY: build run test clean

build:
	go build -o bin/haven ./cmd/haven

run: build
	./bin/haven

test:
	go test -v ./...

clean:
	rm -rf bin/

dev:
	go run ./cmd/haven

tidy:
	go mod tidy
