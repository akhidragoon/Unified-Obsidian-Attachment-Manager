# Unified Obsidian Attachment Manager

A unified, production-quality Obsidian community plugin that combines and improves the capabilities of:

- [Save as Local Images](https://github.com/saltyfireball/obsidian-save-as-local-images)
- [Consistent Attachments and Links](https://github.com/dy-sh/obsidian-consistent-attachments-and-links)
- [Advanced Rename and Delete Handler](https://github.com/mnaoumov/obsidian-advanced-rename-and-delete-handler)

## Features

### Core Attachment Management
- **Download remote images** into your vault with configurable options
- **Replace remote image references** with local references automatically
- **Organize attachments** predictably with configurable folder policies
- **Keep links working** when notes and attachments move or are renamed
- **Find broken links** and missing files
- **Detect duplicate** and potentially unused attachments
- **Repair attachment paths** safely across platforms
- **Preview changes** before applying them
- **Undo/rollback** supported operations
- **Keep vault portable** across devices and operating systems

### Rename/Delete Handler (from Consistent Attachments + Advanced Rename Delete)
- **Move attachments with notes** - When a note is renamed/moved, its attachments move too
- **Clean up on delete** - Remove attachments only referenced by the deleted note
- **Rescue shared attachments** - Move stranded attachments to surviving note's folder
- **Note priorities** - Configure which note adopts an attachment when multiple notes reference it
- **Frontmatter alias preservation** - Save original filenames as aliases when attachments are renamed

### Path Compatibility (from Consistent Attachments)
- **Cross-platform validation** - Check filenames against Windows/Android/Linux/macOS/iOS rules
- **Forbidden character detection** - Find `<>:"/\|?*` and control characters
- **Reserved name detection** - CON, PRN, AUX, NUL, COM1-9, LPT1-9
- **Length validation** - File/folder/path length limits per platform
- **Trailing character check** - Spaces and dots at end of names
- **Name repair** - Auto-generate safe replacement names

### Unicode Name Normalization (from Consistent Attachments)
- **NFC detection** - Find filenames stored in non-NFC Unicode form
- **NFC repair** - Rename files to NFC to prevent sync conflicts

### Link Consistency (from Consistent Attachments)
- **Broken link detection** - Find references to non-existent files
- **Misplaced attachment detection** - Find attachments not in proper folders
- **Frontmatter link checking** - Validate links in YAML frontmatter

### Sidecar Notes Handler (from Consistent Attachments)
- **Excalidraw support** - Move/delete `.excalidraw.md` sidecar files with their notes
- **Sidecar detection** - Automatically find sidecar files for any note

### Safety & Configuration
- **All features off by default** - Installing changes nothing until enabled
- **Plugin conflict detection** - Blocking conflicts with other rename/delete plugins; warning for command overlaps
- **Plugin dependents tracking** - See which plugins depend on this one
- **Cross-plugin API** - Other plugins can depend on this plugin's API
- **Empty folder deletion** - Keep / Delete / Delete with empty parents options
- **Include/exclude path filtering** - Glob and regex path patterns
- **Treat as attachment extensions** - `.excalidraw.md` and `property:name=value` frontmatter matching
- **Settings migration** - Automatic migration of settings between plugin versions
- **First load notice** - Welcome message explaining defaults

## UI Access Methods

The plugin is accessible through multiple interfaces, not just the command palette:

1. **Command Palette** (`Cmd+P` / `Ctrl+P`) - All commands available:
   - Localize remote images in current note
   - Localize remote images in folder
   - Localize remote images across vault
   - Audit attachment links
   - Delete empty folders
   - Preview attachment organization
   - Find duplicate attachments
   - Review potentially unused attachments
   - Undo last operation
   - Normalize Unicode names
   - Check path compatibility

2. **Settings Tab** - `Settings → Unified Attachment Manager` - Feature toggles, conflict banner, dependents list

3. **File Menu / Context Menu** - Right-click any folder in file explorer → "Localize remote images in folder"

4. **Plugin Conflict Banner** - Displayed in settings tab when blocking/warning conflicts with other plugins are detected

5. **First Load Notice** - Welcome message on first install explaining all features are off by default

## Installation

### Manual Installation
1. Download the latest release from GitHub Releases
2. Extract `main.js`, `manifest.json`, and `styles.css` to:
   ```
   <Vault>/.obsidian/plugins/unified-attachment-manager/
   ```
3. Reload Obsidian and enable the plugin in Settings → Community plugins

### On Android (Obsidian Mobile)
1. Copy `main.js`, `manifest.json`, and `styles.css` to:
   ```
   <Vault>/.obsidian/plugins/unified-attachment-manager/
   ```
2. Open Obsidian Mobile → `Settings → Community plugins` → Enable the plugin

## Settings

- **Default attachment location** - Central folder or note-relative
- **Naming policy** - Filename sanitization and collision handling
- **Download timeout** - Network request timeout
- **Max download size** - Prevent oversized downloads
- **Duplicate detection** - URL-based or content-based
- **Preview before write** - Always show changes before applying
- **Backup history** - Number of operations to keep for undo
- **Should handle renames** - Move attachments when notes are renamed (off by default)
- **Should handle deletions** - Clean up attachments when notes are deleted (off by default)
- **Empty folder behavior** - Keep / Delete / Delete with empty parents
- **Should rescue shared attachments** - Move stranded attachments to adopting note's folder
- **Note priorities** - Which note adopts shared attachments (extension, property, or regex patterns)
- **Treat as attachment extensions** - Additional extensions treated as attachments
- **Include/exclude paths** - Glob/regex patterns to filter which paths to process

## Safety Features

- **Preview mode** - Never writes to vault without confirmation
- **Resource locking** - Prevents concurrent operations from corrupting state
- **Abort signals** - Long-running operations can be cancelled
- **Atomic operations** - Uses temporary files and rollback
- **No auto-delete** - Never automatically removes files unless explicitly enabled
- **Explicit confirmation** - Required for vault-wide operations
- **Safe defaults** - All features off by default; installing changes nothing
- **Mobile compatible** - Works on Obsidian Android/iOS (uses only public APIs)
