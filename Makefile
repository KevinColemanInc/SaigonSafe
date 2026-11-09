.DEFAULT_GOAL := help

.PHONY: help build-firefox build-chrome deploy-firefox deploy-chrome

help:
	@printf '%s\n' \
		'make build-firefox   Build the Firefox extension' \
		'make build-chrome    Build the Chrome extension' \
		'make deploy-firefox  Build and package the Firefox extension' \
		'make deploy-chrome   Build and package the Chrome extension'

build-firefox:
	npm run build:firefox --workspace=apps/browser
	@printf '%s\n' 'Firefox build: apps/browser/build/firefox'

build-chrome:
	npm run build:chrome --workspace=apps/browser
	@printf '%s\n' 'Chrome build: apps/browser/build/chrome'

deploy-firefox:
	npm run dist:firefox --workspace=apps/browser
	@printf '%s\n' 'Firefox package: apps/browser/dist/dist-firefox.zip'

deploy-chrome:
	npm run dist:chrome --workspace=apps/browser
	@printf '%s\n' 'Chrome package: apps/browser/dist/dist-chrome.zip'
