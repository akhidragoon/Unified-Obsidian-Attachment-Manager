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

## Usage Guide

### On PC/Desktop (Windows, macOS, Linux)

1. **Install & Enable**
   - Install via Community Plugins or manual installation (see above)
   - Go to `Settings → Community plugins` and enable "Unified Obsidian Attachment Manager"

2. **Localize remote images in a note**
   - Open the note containing remote images (`http://` or `https://`)
   - Open the Command Palette with `Ctrl+P` (Windows/Linux) or `Cmd+P` (macOS)
   - Run `Unified Attachment Manager: Localize remote images in current note`
   - Review the preview and confirm to download and replace references

3. **Organize or audit your vault**
   - Use `Audit attachment links` to find broken/missing links
   - Use `Preview attachment organization` to see proposed moves before applying
   - Use `Find duplicate attachments` to detect duplicates

### On Android (Obsidian Mobile)

1. **Install**
   - Copy `main.js`, `manifest.json`, and `styles.css` to:
     ```
     <Vault>/.obsidian/plugins/unified-attachment-manager/
     ```
   - You can do this via a file manager app (e.g. ZArchiver, FX File Explorer), ADB, or by syncing your vault from desktop
   - Open Obsidian Mobile → `Settings → Community plugins` → Enable the plugin

2. **Use commands**
   - Open a note with remote images
   - Open the Command Palette (tap the ⋮ menu → Command palette, or use your preferred gesture)
   - Search for and run the desired command (e.g. "Localize remote images in current note")
   - Review prompts and confirm

**Mobile Notes:**
- Use Wi-Fi for downloading images or running vault-wide operations
- Large vaults may take longer to scan on mobile devices
- Network access is required for downloading remote images
- If your vault syncs across devices, avoid running bulk operations simultaneously on multiple devices
- All changes respect your Obsidian attachment settings

### Tips
- Enable "Preview before write" in settings to always review changes
- Use undo (`Undo last operation`) to rollback reversible actions
- For note-relative attachments, the plugin follows Obsidian's "Subfolder name" setting when organizing files

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
- **Mobile compatible** - Works on Obsidian Android/iOS (uses only public APIs)