# UCSD Podcast Downloader Extension

This extension allows you to download podcasts from UCSD's podcasting service. It is built with React, TypeScript, and Vite.

## Development

This project uses `pnpm` as its package manager.

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev
```

## Building for Production

Since Chrome and Firefox have different manifest requirements (e.g., `sidebar_action` for Firefox vs `side_panel` for Chrome), we use a cross-browser build system.

### Chrome
Builds the extension with Chrome-specific manifest settings (removes Firefox-only keys).

```bash
pnpm run build:chrome
```

### Firefox
Builds the extension with Firefox-specific manifest settings (preserves `sidebar_action`).

```bash
pnpm run build:firefox
```

### General Build
Builds the extension with all keys present in `public/manifest.jsonc`.

```bash
pnpm run build
```

## Project Structure

- `public/manifest.jsonc`: The source of truth for the extension manifest (supports comments).
- `plugins/`: Contains custom Vite plugins for manifest conversion and cross-browser cleanup.
- `src/`: Background scripts and side panel UI components.
