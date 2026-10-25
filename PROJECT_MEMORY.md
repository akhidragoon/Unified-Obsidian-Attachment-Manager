# PROJECT MEMORY — Unified Obsidian Attachment Manager

## Overview
- **Plugin ID**: `unified-attachment-manager`
- **Plugin Name**: Unified Obsidian Attachment Manager
- **Version**: `0.1.0`
- **minAppVersion**: `1.0.0`
- **Description**: Download remote images, organize attachments, audit broken links, keep vault portable
- **Author**: khidragoon
- **License**: MIT
- **Desktop-only**: false
- **GitHub**: https://github.com/akhidragoon/Unified-Obsidian-Attachment-Manager

## Phase 0 (COMPLETED)
Created 6 planning documents:
- `docs/FEATURE_MATRIX.md` - Feature comparison (Save as Local Images vs Consistent Attachments)
- `docs/ARCHITECTURE.md` - Core/Services/UI module structure
- `docs/IMPLEMENTATION_PLAN.md` - 10-phase timeline (5 weeks total)
- `docs/THREAT_MODEL.md` - Security risks & mitigations
- `docs/TEST_PLAN.md` - Unit, integration, performance testing strategy
- `docs/DECISIONS.md` - Architecture decisions & rationale

## Phase 1 (COMPLETED) — Project Foundation
**All checks pass**: TSC, ESLint, Vitest, production build

**Key files:**
- `manifest.json` - plugin metadata (id: unified-attachment-manager)
- `package.json` - dependencies (obsidian, typescript, esbuild, eslint-plugin-obsidianmd, vitest)
- `tsconfig.json` - strict TypeScript, vitest globals
- `eslint.config.mjs` - obsidianmd recommended config (src files only)
- `vitest.config.ts` - vitest 5.0.5 config
- `src/main.ts` - minimal plugin class with settings tab
- `src/settings/settings.ts` - PluginSettings interface + defaults
- `src/types/save-settings.ts` - SaveSettings interface
- `tests/unit/sample.test.ts` - sample test
- `version-bump.mjs` - updates versions.json from manifest
- `versions.json` - `{"0.1.0": "1.0.0"}`
- `LICENSE` - MIT with attribution to both reference projects
- `README.md` - full plugin docs

**Scripts:**
- `npm run dev` - watch build
- `npm run build` - tsc + esbuild production
- `npm run lint` - eslint
- `npm test` - vitest run
- `npm run test:watch` - vitest watch
- `npm run test:coverage` - coverage report

## Phase 2 (IN PROGRESS) — Core Path & Reference Engine

**Completed:**
- `src/core/path-resolver.ts` - path resolver service

**Pending:**
- Unit tests for path resolver
- Reference scanner implementation
- Safe markdown editor implementation

**PathResolver module exports:**
- `ReferenceType` enum (InternalWikilink, InternalLink, InternalImage, InternalWikiImage, ExternalUrl, ExternalImage, HtmlImage, Frontmatter, Unknown)
- `ResolvedPath` interface (resolvedPath, isAmbiguous, candidates, missing)
- `PathResolverOptions` interface (attachmentFolder, ignoreCase, ignoreExtensions)
- `ReferenceSpan` interface
- Functions: `isExternalUrl()`, `normalizeVaultPath()`, `isPathAmbiguous()`, `getCandidatesForPath()`, `resolvePath()`, `decodeUrl()`, `encodeUrl()`, `isAttachmentPath()`, `isWithinVault()`, `getRelativePath()`, `formatLinkTarget()`, `stripWikiLink()`, `isUnicodeNormalized()`, `normalizeUnicode()`, `isPathTraversing()`

## Key Design Decisions
1. **Minimal dependency approach** - no obsidian-lib ecosystem, only obsidian + TypeScript toolchain
2. **Three-layer architecture**: Core/Services/UI separation
3. **Read-only scans first**, repairs after testing
4. **Preview before write** - never auto-modify vault
5. **No auto-delete** - never delete potentially unused attachments
6. **Mobile compatible** - isDesktopOnly: false, avoid Node/Electron APIs
7. **MIT licensed** - attribution preserved for both reference projects

## Phase 2-10 Plan
- Phase 2: Operation planner, change executor, rollback manager
- Phase 3: Downloader service, URL rewriting, localization commands
- Phase 4: Attachment manager, location policies
- Phase 5: Vault auditor, report generation
- Phase 6: Duplicate detector, content hashing
- Phase 7: Settings, commands, UI components
- Phase 8-9: Testing, regression prevention
- Phase 10: Documentation, release readiness