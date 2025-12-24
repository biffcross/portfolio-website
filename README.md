# Biff Cross Photography Portfolio

A modern photography portfolio website built with React, TypeScript, and Vite.

## Features

- **Public Portfolio Website**: Showcases photography work across multiple categories
- **Image Protection**: Prevents right-click, drag-and-drop, and text selection
- **Responsive Design**: Mobile-friendly layout with touch controls
- **Lightbox Gallery**: Full-screen image viewing with navigation
- **Social Sharing**: Web Share API with fallback modal
- **Cloudflare R2 Integration**: Cloud storage for images
- **GitHub Pages Deployment**: Automated deployment pipeline

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── Header.tsx      # Navigation header
│   ├── Gallery.tsx     # Image gallery display
│   ├── ImageGrid.tsx   # Grid layout for images
│   ├── ProtectedImage.tsx # Copy-protected image component
│   ├── Lightbox.tsx    # Full-screen image viewer
│   └── ShareButton.tsx # Social sharing component
├── pages/              # Page components
│   ├── Home.tsx        # Landing page
│   ├── About.tsx       # About page
│   ├── Contact.tsx     # Contact page
│   └── Category.tsx    # Category display page
├── utils/              # Utility functions
│   ├── config.ts       # Configuration types and loading
│   └── cloudflare.ts   # R2 URL construction utilities
└── test/               # Test setup and utilities
    └── setup.ts        # Vitest configuration
```

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Preview production build:
   ```bash
   npm run preview
   ```

### Configuration

The portfolio configuration is stored in Cloudflare R2 as `portfolio-config.json` and includes:

- Site metadata (title, description, social links)
- Category definitions
- Image metadata and organization
- Easter egg settings (fireworks, Christmas override)

The configuration is managed entirely through the admin interface and automatically loaded from R2 storage. Local configuration files are excluded from the repository.

## Deployment

The project is configured for deployment to GitHub Pages using GitHub Actions. The workflow automatically builds and deploys the site when changes are pushed to the main branch.

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Styling**: CSS with CSS Modules support
- **Image Storage**: Cloudflare R2
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions