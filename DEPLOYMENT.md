# Deployment Configuration

This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

## GitHub Actions Secrets Setup

To enable deployment, configure the following secrets in your GitHub repository settings:

### Required Secrets

1. **VITE_CUSTOM_DOMAIN** - Your custom domain URL (e.g., `https://biffcrossphotography.co.uk`)
2. **VITE_R2_PUBLIC_URL** - Cloudflare R2 public URL (e.g., `https://pub-your-bucket-id.r2.dev`)
3. **VITE_R2_ACCESS_KEY_ID** - Cloudflare R2 access key ID
4. **VITE_R2_SECRET_ACCESS_KEY** - Cloudflare R2 secret access key
5. **VITE_R2_API_TOKEN** - Cloudflare R2 API token

### Setting up Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the exact name and corresponding value

## Deployment Process

The deployment workflow automatically triggers when:
- Code is pushed to the `main` branch
- Manual workflow dispatch is triggered

### Workflow Steps

1. **Build**: Installs dependencies, creates environment file from secrets, and builds the React application
2. **Deploy**: Uploads the built application to GitHub Pages

## Custom Domain Configuration

If using a custom domain:
1. Set the `VITE_CUSTOM_DOMAIN` secret to your domain URL
2. Configure your domain's DNS to point to GitHub Pages
3. Enable custom domain in your repository's Pages settings

## Local Development

For local development, copy `.env.example` to `.env` and fill in your configuration values.

```bash
cp .env.example .env
# Edit .env with your local configuration
npm run dev
```

## Build and Preview

To test the production build locally:

```bash
npm run build
npm run preview
```