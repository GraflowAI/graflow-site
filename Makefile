# Makefile for Docusaurus 3.9.2 (TypeScript)
# Package manager: npm

.PHONY: help install start build serve deploy clear swizzle write-translations write-heading-ids typecheck

# Show help
help:
	@echo "Docusaurus 3.9.2 Commands:"
	@echo "  make install             Install dependencies"
	@echo "  make start               Start development server"
	@echo "  make build               Build for production"
	@echo "  make serve               Serve production build locally"
	@echo "  make deploy              Deploy to GitHub Pages"
	@echo "  make clear               Clear Docusaurus cache"
	@echo "  make swizzle             Swizzle a component"
	@echo "  make write-translations  Generate translation files"
	@echo "  make write-heading-ids   Add heading IDs to markdown files"
	@echo "  make typecheck           TypeScript type checking"

# Install dependencies
install:
	npm install

# Start development server
start:
	npm run start

# Build for production
build:
	npm run build

# Serve production build locally
serve:
	npm run serve

# Deploy to GitHub Pages
deploy:
	npm run deploy

# Clear Docusaurus cache
clear:
	npm run clear

# Swizzle a component
swizzle:
	npm run swizzle

# Generate translation files
write-translations:
	npm run write-translations

# Add heading IDs to markdown files
write-heading-ids:
	npm run write-heading-ids

# TypeScript type checking
typecheck:
	npm run typecheck
