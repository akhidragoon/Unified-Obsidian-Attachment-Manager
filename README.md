# Unified Obsidian Attachment Manager

A unified, production-quality Obsidian community plugin that combines and improves the capabilities of:

- [Save as Local Images](https://github.com/saltyfireball/obsidian-save-as-local-images)
- [Consistent Attachments and Links](https://github.com/dy-sh/obsidian-consistent-attachments-and-links)

## Features

- **Download remote images** into your vault with configurable options
- **Replace remote image references** with local references automatically
- **Organize attachments** predictably with configurable folder policies
- **Keep links working** when notes and attachments move or are renamed
- **Find broken links** and missing files
- **Detect duplicate** and potentially unused attachments
- **Repair attachment paths** safely
- **Preview changes** before applying them
- **Undo/rollback** supported operations
- **Keep vault portable** across devices and operating systems

## Installation

### From Obsidian Community Plugins (when available)
1. Open Settings → Community plugins → Browse
2. Search for "Unified Obsidian Attachment Manager"
3. Install and enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/akhidragoon/Unified-Obsidian-Attachment-Manager/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to:
   ```
   <Vault>/.obsidian/plugins/unified-attachment-manager/
   ```
3. Reload Obsidian and enable the plugin in Settings → Community plugins

## Development

### Requirements
- Node.js 18+ (current LTS)
- npm

### Setup
```bash
npm install
```

### Development Build (Watch Mode)
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm run test
```

### Watch Tests
```bash
npm run test:watch
```

## Commands

- **Localize remote images in current note** - Download all remote images in the active note
- **Localize remote images in folder** - Process all notes in a selected folder
- **Localize remote images across vault** - Process entire vault (with confirmation)
- **Audit attachment links** - Scan vault for broken links and missing files
- **Preview attachment organization** - Show what would be reorganized
- **Find duplicate attachments** - Identify duplicate files by URL or content
- **Review potentially unused attachments** - Find orphaned files
- **Undo last operation** - Rollback the last reversible change

## Settings

- **Default attachment location** - Central folder or note-relative
- **Naming policy** - Filename sanitization and collision handling
- **Download timeout** - Network request timeout
- **Max download size** - Prevent oversized downloads
- **Duplicate detection** - URL-based or content-based
- **Preview before write** - Always show changes before applying
- **Backup history** - Number of operations to keep for undo

## Safety Features

- **Preview mode** - Never writes to vault without confirmation
- **Atomic operations** - Uses temporary files and rollback
- **No auto-delete** - Never automatically removes files
- **Explicit confirmation** - Required for vault-wide operations
- **Safe defaults** - Conservative settings out of the box

## License

MIT License - see [LICENSE](LICENSE) for details.

Based on:
- [Save as Local Images](https://github.com/saltyfireball/obsidian-save-as-local-images) (MIT)
- [Consistent Attachments and Links](https://github.com/dy-sh/obsidian-consistent-attachments-and-links) (MIT)