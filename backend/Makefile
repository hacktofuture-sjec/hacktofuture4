.PHONY: build run test lint clean tidy

BIN     := rekall-backend
CMD     := ./cmd/server
GOFLAGS := -ldflags="-s -w"

## build: compile the binary
build:
	go build $(GOFLAGS) -o bin/$(BIN) $(CMD)

## run: run in development mode (auto-reload not included; use air externally)
run:
	GIN_MODE=debug go run $(CMD)/main.go

## test: run all tests with race detector
test:
	go test -race -count=1 ./...

## test-verbose: run tests with verbose output
test-verbose:
	go test -race -v -count=1 ./...

## test-cover: run tests and produce a coverage report
test-cover:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

## lint: run golangci-lint (must be installed separately)
lint:
	golangci-lint run ./...

## tidy: tidy and verify go modules
tidy:
	go mod tidy
	go mod verify

## clean: remove build artifacts
clean:
	rm -rf bin/ coverage.out coverage.html

## docker-build: build the production Docker image
docker-build:
	docker build -t rekall-backend:latest .

help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //'
