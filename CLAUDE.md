# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Graflow documentation site built with Docusaurus 3.9.2 (TypeScript). Uses npm as package manager.

## Commands

```bash
make help          # Show all available commands
make install       # Install dependencies
make start         # Start development server (localhost:3000)
make build         # Build for production
make serve         # Serve production build locally
make typecheck     # Run TypeScript type checking
make clear         # Clear Docusaurus cache (useful when builds behave unexpectedly)
```

## Project Structure

- `docusaurus.config.ts` - Main configuration (site metadata, navbar, footer, plugins)
- `sidebars.ts` - Documentation sidebar configuration (auto-generated from docs/ folder)
- `docs/` - Documentation content (Markdown/MDX)
- `blog/` - Blog posts (Markdown/MDX)
- `src/pages/` - Custom React pages (index.tsx is the homepage)
- `src/components/` - Reusable React components
- `src/css/custom.css` - Global CSS customizations and theme variables
- `static/` - Static assets served at site root

## Key Dependencies

- React 19 with TypeScript
- `@easyops-cn/docusaurus-search-local` for offline search functionality
- `prism-react-renderer` for code syntax highlighting

## Requirements

Node.js >= 20.0
