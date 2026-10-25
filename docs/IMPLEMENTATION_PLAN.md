# IMPLEMENTATION PLAN

## Overview
This document outlines the phased implementation approach for the Unified Obsidian Attachment Manager (U OAM). Each phase builds on previous work, ensuring solid foundations before adding complexity.

## Phase 0 — Foundation (COMPLETED)
**Status: ✓ Complete**
**Duration: 1 day**
**Key Deliverables**: All Phase 0 documents created

### Tasks Completed:
1. ✓ Inspected both reference repositories
2. ✓ Analyzed licenses and dependencies
3. ✓ Identified overlapping and unique features
4. ✓ Created FEATURE_MATRIX.md
5. ✓ Created ARCHITECTURE.md
6. ✓ Created THREAT_MODEL.md
7. ✓ Created TEST_PLAN.md
8. ✓ Created DECISIONS.md
9. ✓ Established project structure

### Acceptance Criteria:
- All Phase 0 documentation completed
- Project structure analyzed and planned
- Dependency strategy decided
- Test strategy defined
- Risk assessment documented

## Phase 1 — Core Path and Reference Engine (IN PROGRESS)
**Status: Being implemented**
**Duration: 2-3 days**
**Key Deliverables**: Core path resolution and reference scanning

### Phase 1.1: Path Resolver (IN PROGRESS)
**Status: 70% complete**
**Duration: 1 day**

#### Implementation Tasks:
1. ✓ Create `src/core/path-resolver.ts`
2. ✓ Implement reference resolution logic
3. ✓ Handle root-relative vault paths
4. ✓ Distinguish internal vs external URLs
5. ✓ URL encoding/decoding
6. ✓ Separator normalization
7. ✓ Ambiguous match detection
8. ✓ Attachment-folder rule respect
9. ✓ Unicode filename handling
10. ✓ Write unit tests

#### Acceptance Criteria:
- Path resolution tests pass
- TypeScript compilation succeeds
- Linting passes
- Production build generates main.js

### Phase 1.2: Reference Scanner (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/core/reference-scanner.ts`
2. Implement Markdown link parsing
3. Implement HTML image parsing
4. Implement wiki embed/link parsing
5. Handle frontmatter field references
6. Detect external URLs and data URLs
7. Preserve source positions
8. Test various syntax patterns
9. Write unit tests

#### Acceptance Criteria:
- Reference scanning tests pass
- No false positives in code blocks
- Support all required syntax patterns
- TypeScript compilation succeeds

### Phase 1.3: Safe Markdown Editor (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/core/safe-markdown-editor.ts`
2. Implement targeted span editing
3. Preserve frontmatter
4. Preserve code blocks
5. Preserve formatting
6. Handle edge cases
7. Write unit tests
8. Integration tests

#### Acceptance Criteria:
- Safe editing tests pass
- No unintended changes
- All syntax patterns preserved
- Production build passes

## Phase 2 — Operation Planning and Safety Layer (PLANNING)
**Duration: 3-4 days**

### Phase 2.1: Operation Planner (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/core/operation-planner.ts`
2. Define operation types (Download, Create, Rename, Rewrite, Repair)
3. Implement operation validation
4. Implement collision detection
5. Implement dependency checking
6. Implement preview generation
7. Write unit tests
8. Write integration tests

### Phase 2.2: Change Executor (PLANNING)
**Duration: 2 days**

#### Implementation Tasks:
1. Create `src/core/change-executor.ts`
2. Implement validation pipeline
3. Implement atomic operations
4. Implement rollback tracking
5. Implement error recovery
6. Implement interruption handling
7. Write unit tests
8. Write integration tests

### Phase 2.3: Rollback Manager (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/core/rollback-manager.ts`
2. Implement operation history
3. Implement backup strategy
4. Implement rollback validation
5. Implement conflict detection
6. Write unit tests
7. Write integration tests

## Phase 3 — Remote Image Localization (PLANNING)
**Duration: 4-5 days**

### Phase 3.1: Downloader Service (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/services/downloader.ts`
2. Implement HTTP(S) downloading
3. Implement timeout handling
4. Implement size validation
5. Implement content-type detection
6. Implement safe filename generation
7. Implement duplicate detection
8. Implement error handling
9. Write unit tests
10. Write integration tests

### Phase 3.2: URL Rewriting (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement URL-to-local mapping
2. Implement pattern replacement
3. Implement safe link target formatting
4. Implement linked image collapsing
5. Implement frontmatter rewriting
6. Write unit tests
7. Write integration tests

### Phase 3.3: Localize Remote Images Commands (PLANNING)
**Duration: 2 days**

#### Implementation Tasks:
1. Create command handlers
2. Implement current note localization
3. Implement folder localization
4. Implement vault-wide localization
5. Implement progress reporting
6. Implement cancellation support
7. Write integration tests

## Phase 4 — Attachment Organization (PLANNING)
**Duration: 3-4 days**

### Phase 4.1: Attachment Manager (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/services/attachment-manager.ts`
2. Implement location policy enforcement
3. Implement safe moves/renames
4. Implement multi-note reference updates
5. Implement collision handling
6. Implement link validation
7. Write unit tests
8. Write integration tests

### Phase 4.2: Configurable Policies (PLANNING)
**Duration: 2 days**

#### Implementation Tasks:
1. Create settings for organization policies
2. Implement central folder policy
3. Implement note-specific folder policy
4. Implement configurable rules
5. Implement folder creation
6. Implement validation
7. Write integration tests

## Phase 5 — Vault Auditor (PLANNING)
**Duration: 2-3 days**

### Phase 5.1: Audit Core (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/services/vault-auditor.ts`
2. Implement broken link detection
3. Implement missing attachment detection
4. Implement frontmatter reference detection
5. Implement attachment location validation
6. Implement duplicate detection
7. Implement orphan detection
8. Implement unsafe filename detection
9. Write unit tests
10. Write integration tests

### Phase 5.2: Report Generation (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement report formatting
2. Implement repair suggestions
3. Implement progress reporting
4. Implement cancellation support
5. Write integration tests

## Phase 6 — Duplicate Detection and Naming (PLANNING)
**Duration: 2-3 days**

### Phase 6.1: URL Identity (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement URL normalization
2. Implement duplicate URL detection
3. Write unit tests

### Phase 6.2: Content Identity (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement cryptographic hashing
2. Implement content comparison
3. Implement large file handling
4. Write unit tests
5. Write integration tests

### Phase 6.3: Naming Policies (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement filename sanitization
2. Implement collision prevention
3. Implement extension preservation
4. Write unit tests
5. Write integration tests

## Phase 7 — User Interface and Settings (PLANNING)
**Duration: 3-4 days**

### Phase 7.1: Settings System (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create `src/ui/settings.ts`
2. Implement default attachment location
3. Implement naming policy settings
4. Implement timeout/limit settings
5. Implement backup settings
6. Implement validation
7. Write unit tests

### Phase 7.2: Commands (PLANNING)
**Duration: 2 days**

#### Implementation Tasks:
1. Create command palette entries
2. Implement all required commands
3. Implement command descriptions
4. Implement keyboard shortcuts
5. Write integration tests

### Phase 7.3: UI Components (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create progress indicators
2. Create operation previews
3. Create result summaries
4. Create cancellation UI
5. Write integration tests

## Phase 8 — Testing and Regression Prevention (PLANNING)
**Duration: 3-4 days**

### Phase 8.1: Test Infrastructure (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Set up test framework
2. Create Obsidian API mocks
3. Create test utilities
4. Write initial test structure

### Phase 8.2: Unit Tests (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement path resolver tests
2. Implement reference scanner tests
3. Implement safe editor tests
4. Implement operation planner tests
5. Implement change executor tests
6. Implement rollback manager tests

### Phase 8.3: Integration Tests (PLANNING)
**Duration: 2 days**

#### Implementation Tasks:
1. Implement download tests
2. Implement attachment move tests
3. Implement shared reference tests
4. Implement failure handling tests
5. Implement cancellation tests

## Phase 9 — Performance and Reliability (PLANNING)
**Duration: 2-3 days**

### Phase 9.1: Optimization (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement result caching
2. Implement batch operations
3. Implement concurrency limits
4. Implement memory management
5. Write performance tests

### Phase 9.2: Reliability (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Implement file change event handling
2. Implement duplicate job prevention
3. Implement stale plan revalidation
4. Implement large vault support
5. Write reliability tests

## Phase 10 — Documentation and Release Readiness (PLANNING)
**Duration: 2-3 days**

### Phase 10.1: Documentation (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Create README.md
2. Create feature documentation
3. Create setup instructions
4. Create troubleshooting guide
5. Create privacy statement
6. Create license information

### Phase 10.2: Release Preparation (PLANNING)
**Duration: 1 day**

#### Implementation Tasks:
1. Update manifest.json
2. Update versions.json
3. Create production build
4. Create GitHub Actions workflow
5. Create release notes

## Risk Mitigation Strategy

### High Priority Risks:
1. **Complex Dependencies**: Use minimal dependency strategy
2. **Path Handling**: Reuse existing obsidian-lib where beneficial
3. **License Compliance**: Keep it simple, MIT is compatible

### Medium Priority Risks:
1. **Feature Overlap**: Clear ownership and boundaries
2. **Testing Coverage**: Incremental testing approach
3. **Performance**: Optimization after correctness

### Low Priority Risks:
1. **Internationalization**: Implement as needed
2. **Platform Compatibility**: Use Obsidian's cross-platform APIs
3. **Future Extensibility**: Design with hooks in mind

## Project Timeline

### Phase-by-Phase Timeline:
- **Phase 0**: Days 1 (COMPLETED)
- **Phase 1**: Days 2-3 (IN PROGRESS)
- **Phase 2**: Days 4-5 (PLANNING)
- **Phase 3**: Days 6-9 (PLANNING)
- **Phase 4**: Days 10-12 (PLANNING)
- **Phase 5**: Days 13-14 (PLANNING)
- **Phase 6**: Days 15-16 (PLANNING)
- **Phase 7**: Days 17-19 (PLANNING)
- **Phase 8**: Days 20-22 (PLANNING)
- **Phase 9**: Days 23-24 (PLANNING)
- **Phase 10**: Days 25-26 (PLANNING)

### Total Estimated Duration: 26 days (5 weeks)

## Success Metrics

### Quality Metrics:
- **Test Coverage**: >90% code coverage
- **Code Quality**: No linting errors
- **Type Safety**: No TypeScript errors
- **Build Success**: Production build passes

### Feature Metrics:
- **Core Functionality**: All phases implemented
- **User Experience**: Intuitive interface
- **Reliability**: Minimal failures
- **Performance**: Responsive UI

### Adoption Metrics:
- **Documentation**: Complete user guides
- **Support**: Responsive issue handling
- **Compatibility**: Works with latest Obsidian
- **Release Quality**: Regular updates

## Next Steps

### Immediate Actions (Day 1-3):
1. Complete Phase 1 (Core Path and Reference Engine)
2. Set up testing infrastructure
3. Implement basic download functionality
4. Create initial settings

### Short-term Actions (Day 4-7):
1. Implement operation planner
2. Implement change executor
3. Add remote image localization
4. Add attachment organization

### Long-term Actions (Day 8-26):
1. Continue incremental implementation
2. Add testing and validation
3. Optimize performance
4. Finalize documentation

## Decision Points

### Architecture Decisions:
1. **Dependency Strategy**: Minimal approach chosen
2. **Module Structure**: Core/Services/UI separation
3. **Testing Strategy**: Incremental testing
4. **Error Handling**: Fail-fast with recovery

### Implementation Decisions:
1. **Path Resolution**: From scratch (no obsidian-lib)
2. **Download Logic**: Minimal HTTP client
3. **File Operations**: Obsidian API abstraction
4. **Settings**: Simple key-value store

## Rollback Plans

### Technical Rollback:
- **Source Code**: Version control with commits
- **Database**: Backup before changes
- **File System**: Atomic operations

### User-Facing Rollback:
- **Undo Operations**: Complete rollback support
- **Backup Strategy**: Multiple backup points
- **Recovery**: Simple recovery procedures

## Communication Plan

### Internal Communication:
- **Daily Standups**: Progress updates
- **Code Reviews**: Peer review process
- **Retrospectives**: Improvement planning

### External Communication:
- **Changelog**: Release notes
- **Documentation**: User guides
- **Support**: Issue tracking
- **Updates**: Release announcements

This implementation plan provides a structured approach to building the Unified Obsidian Attachment Manager, ensuring quality, reliability, and maintainability throughout the development process.