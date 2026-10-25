# FEATURE MATRIX

## Overview
This matrix compares features from the two reference projects:
- **Save as Local Images** (saltyfireball) - MIT license, active
- **Consistent Attachments and Links** (dy-sh) - MIT license, active

## Core Capabilities

| Feature | Save as Local Images | Consistent Attachments and Links | Status |
|---------|----------------------|----------------------------------|---------|
| **Remote Image Download** | ✅ Full implementation | ❌ None | **Merge** |
| **URL Rewriting** | ✅ Local rewriting | ❌ None | **Merge** |
| **Attachment Organization** | ✅ Note-based folders | ✅ Configurable rules | **Merge** |
| **Vault Auditing** | ❌ None | ✅ Full report | **Merge** |
| **Broken Link Detection** | ❌ None | ✅ Full detection | **Merge** |
| **Path Compatibility** | ❌ None | ✅ Windows/Mobile fixes | **Merge** |
| **Duplicate Detection** | ❌ None | ✅ Content-based | **Merge** |
| **Preview Mode** | ❌ None | ✅ Operation planning | **Merge** |
| **Undo/Redo** | ❌ None | ⚠️ Partial support | **Merge** |
| **Command Palette** | ✅ Basic commands | ✅ Full UI integration | **Merge** |
| **Settings Tab** | ✅ Simple settings | ✅ Advanced settings | **Merge** |
| **Mobile Support** | ✅ Yes | ✅ Yes | **Keep** |
| **TypeScript** | ✅ Yes | ✅ Yes | **Keep** |

## Overlapping Functions

### Image Syntax Support
**Both projects support:**
- Markdown: `![alt](url)`
- HTML: `<img src="url">`
- Wiki embeds: `![[url]]`

**Save as Local Images adds:**
- Frontmatter image URLs
- Linked image collapsing

### File Operations
**Both perform:**
- Downloads and writes files
- Vault reading/writing
- Folder creation

**Consistent Attachments adds:**
- Atomic replacements
- Transaction safety
- Backup preservation

## Unique Features

### Save as Local Images Strengths
1. **Multi-folder support**: Right-click folder command
2. **URL safety**: Angle bracket wrapping for problematic characters
3. **Error resilience**: Continues on individual file failures
4. **Progress reporting**: Notices for batch operations

### Consistent Attachments Strengths
1. **Comprehensive auditing**: Links, embeds, frontmatter
2. **Platform compatibility**: Windows/Android/Linux/macOS/iOS rules
3. **Path repair**: Unicode normalization, forbidden character handling
4. **Shared attachment support**: Multi-note file references
5. **Settings migration**: Transitions from old plugins
6. **Advanced dependencies**: Uses obsidian-lib ecosystem

## License & Dependencies

### Licenses
- **Save as Local Images**: MIT (saltyfireball)
- **Consistent Attachments**: MIT (dy-sh)

### Dependencies
**Save as Local Images:**
- Minimal: `obsidian` only
- Optional: esbuild, TypeScript

**Consistent Attachments:**
- Heavy ecosystem:
  - `@mnaoumov/obsidian-lib`
  - `@mnaoumov/typescript-lib`
  - `@obsidian-typings/obsidian-public-latest`
  - `@mnaoumov/obsidian-dev-toolkit`
  - `@mnaoumov/typescript-dev-toolkit`
  - `@mnaoumov/typescript-test-toolkit`

### Recommendation
**Merge with lighter dependency footprint:** Use the minimalist downloader pattern from Save as Local Images, but integrate the auditing, path repair, and settings from Consistent Attachments. Consider creating a new minimal dependency ecosystem if the full obsidian-lib features are needed.

## Implementation Status
| Category | Status | Notes |
|----------|--------|-------|
| Remote Image Download | Planned | From Save as Local Images |
| URL Rewriting | Planned | From Save as Local Images |
| Attachment Organization | Planned | Merge with Smart defaults |
| Vault Auditing | Planned | From Consistent Attachments |
| Path Compatibility | Planned | From Consistent Attachments |
| Duplicate Detection | Planned | From Consistent Attachments |
| Operation Planning | Planned | From Consistent Attachments |
| Settings Management | Planned | From Consistent Attachments |
| Command Integration | Planned | Merge from both |

## Refactoring Considerations

### License Compliance
- **MIT licenses are compatible** - can merge with proper attribution
- Must preserve copyright notices from both sources
- Should reference both source projects in documentation

### Dependency Strategy
**Option A: Minimal** (Recommended)
- Use local downloaders
- Implement path resolution
- Keep TypeScript only
- Easier maintenance

**Option B: Full Ecosystem**
- Use obsidian-lib where beneficial
- Maintain consistency with similar plugins
- More features but heavier dependencies

### Architecture Recommendations
1. **Core Services**: Separate into modules
   - `src/core/` for path resolution
   - `src/services/` for download/auditing
   - `src/ui/` for settings/commands

2. **File Structure**: Based on Consistent Attachments but simplified

3. **Test Strategy**: Combine test approaches from both

## Documentation References
- Save as Local Images README: Features, Usage
- Consistent Attachments README: Commands, Settings
- Obsidian Plugin Guidelines: Development standards

## Next Steps
1. Choose dependency strategy
2. Design minimal service interfaces
3. Implement core download functionality
4. Add audit and repair capabilities
5. Create settings and UI

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Too heavy dependencies | Medium | High | Use minimal approach first |
| Complex path handling | Low | High | Reuse existing obsidian-lib where possible |
| Merge license complexity | Low | Medium | Keep it simple, MIT is compatible |
| Feature overlap | Low | Medium | Clear ownership and boundaries |
