# Meme Studio (Frontend-only PWA)

A high-end, no-backend meme editor built with the Canvas API. Works offline, installable, and deployable on GitHub Pages/Netlify.

## Features
- Upload image, add **text/emoji/stickers**
- **Drag**, **scale**, **rotate**
- Image **filters** (brightness, contrast, saturation, blur, grayscale)
- **Layers** (reorder, hide/show, lock, duplicate, delete)
- **Undo/Redo** history
- **Export** PNG/JPEG/WEBP with quality + optional watermark
- **Import/Export** project (`.json`)
- **Offline-first PWA** (service worker + manifest)
- **Local autosave**

## Quick Start
1. Copy files into your codespace.
2. Enable GitHub Pages (main → `/root`).
3. Open the site once online (to cache the PWA). You can “Install” from your browser.

## Keyboard Shortcuts
- **N**: New project
- **Ctrl/Cmd + S**: Save to local storage
- **Ctrl/Cmd + E**: Export image
- **Ctrl/Cmd + Z / Y**: Undo / Redo
- **Delete**: Delete layer
- **Arrows**: Nudge (Shift = 10px)

## License
MIT — see `LICENSE`.
