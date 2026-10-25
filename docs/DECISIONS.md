# DECISIONS.md

## Overview
This document documents important architectural and implementation decisions made during the development of the Unified Obsidian Attachment Manager (U OAM). Each decision includes the rationale, alternatives considered, and implications.

## Decision Log

### Decision 1: Dependency Strategy - Minimal Approach
**Date**: 2026-10-25
**Status**: Implemented
**Context**: Choosing between using obsidian-lib ecosystem or implementing dependencies locally

**Decision**: Use a minimal dependency approach, implementing core functionality locally rather than depending on obsidian-lib and other external libraries.

**Rationale**:
- **Maintainability**: Easier to maintain and debug
- **Performance**: Reduced startup time and resource usage
- **Simplicity**: Clearer code paths and dependencies
- **Compatibility**: Less risk of breaking changes from external dependencies
- **Learning**: Easier for new developers to understand

**Alternatives Considered**:
1. **Full Ecosystem**:
   - **Pros**: Rich feature set, proven implementations
   - **Cons**: Heavy dependencies, potential breaking changes
   - **Chosen**: Not chosen

2. **Hybrid Approach**:
   - **Pros**: Some benefits from ecosystem
   - **Cons**: Increased complexity
   - **Chosen**: Not chosen

**Implications**:
- **Positive**: Simpler codebase, easier maintenance
- **Negative**: Reimplemented some functionality
- **Mitigation**: Careful implementation and testing

### Decision 2: Module Structure - Core/Services/UI Separation
**Date**: 2026-10-25
**Status**: Implemented
**Context**: Organizing the plugin into logical modules

**Decision**: Use a three-layer architecture:
- **Core**: Path resolution, reference scanning, safe editing
- **Services**: Download, attachment management, auditing, duplicate detection
- **UI**: Settings, commands, views

**Rationale**:
- **Separation of Concerns**: Clear separation of responsibilities
- **Testability**: Easier to test individual components
- **Maintainability**: Easier to modify and extend
- **Scalability**: Easy to add new features
- **Organization**: Logical grouping of related functionality

**Alternatives Considered**:
1. **Monolithic**: All code in one file
   - **Pros**: Simple deployment
   - **Cons**: Difficult to maintain and test
   - **Chosen**: Not chosen

2. **Feature-Based**: Group by functionality
   - **Pros**: Logical grouping
   - **Cons**: Potential overlap
   - **Chosen**: Not chosen

**Implications**:
- **Positive**: Clear architecture, easier maintenance
- **Negative**: More files, potential coupling
- **Mitigation**: Clear interfaces and contracts

### Decision 3: Path Resolution Implementation
**Date**: 2026-10-25
**Status**: Implemented
**Context**: How to resolve file references

**Decision**: Implement path resolution from scratch:
- Support root-relative paths (`/path/to/file.md`)
- Handle relative paths (`path/to/file.md`)
- Distinguish internal vault paths from external URLs
- Properly handle URL encoding/decoding
- Respect attachment-folder rules

**Rationale**:
- **Control**: Full control over resolution logic
- **Performance**: Optimized for common cases
- **Extensibility**: Easy to add new path types
- **Reliability**: Simpler failure modes
- **Compatibility**: Works with all Obsidian path APIs

**Alternatives Considered**:
1. **Use Obsidian Path APIs**: Use Obsidian's built-in path resolution
   - **Pros**: Leverages existing functionality
   - **Cons**: Less control, potential inconsistencies
   - **Chosen**: Not chosen for core functionality

2. **Hybrid Approach**: Use Obsidian APIs for some cases
   - **Pros**: Balance of control and compatibility
   - **Cons**: Increased complexity
   - **Chosen**: Not chosen

**Implications**:
- **Positive**: Full control and customization
- **Negative**: More code to maintain
- **Mitigation**: Comprehensive testing and validation

### Decision 4: Reference Scanning Implementation
**Date**: 2026-10-25
**Status**: Implemented
**Context**: How to identify file references in notes

**Decision**: Implement reference scanning using:
- Regular expressions for common patterns
- Careful parsing to preserve source positions
- Support for all major syntaxes (Markdown, HTML, wiki)
- Frontmatter scanning
- External URL detection

**Rationale**:
- **Accuracy**: Precise parsing for each syntax
- **Completeness**: Support for all required syntaxes
- **Safety**: Avoid false positives in code blocks
- **Performance**: Efficient parsing
- **Extensibility**: Easy to add new syntax patterns

**Alternatives Considered**:
1. **Full Parser**: Use a dedicated Markdown parser
   - **Pros**: Most accurate
   - **Cons**: Heavy dependency, complex setup
   - **Chosen**: Not chosen

2. **Simple Regex**: Broad regex patterns
   - **Pros**: Simple implementation
   - **Cons**: Risk of false positives
   - **Chosen**: Not chosen

**Implications**:
- **Positive**: Accurate and efficient scanning
- **Negative**: Multiple regex patterns
- **Mitigation**: Careful testing and validation

### Decision 5: Safe Markdown Editing Implementation
**Date**: 2026-10-25
**Status**: Implemented
**Context**: How to safely edit Markdown references

**Decision**: Implement safe editing using:
- Targeted span editing (not full parse/serialization)
- Preservation of frontmatter
- Preservation of code blocks
- Preservation of formatting
- Preservation of link metadata

**Rationale**:
- **Safety**: Minimal changes to documents
- **Performance**: Efficient editing
- **Accuracy**: Preserves document structure
- **Reliability**: Reduces risk of corruption
- **User Experience**: Consistent appearance

**Alternatives Considered**:
1. **Full Parse/Serialize**: Parse, modify, serialize entire document
   - **Pros**: Most accurate
   - **Cons**: Risk of changes, performance issues
   - **Chosen**: Not chosen

2. **Selective Editing**: Edit only specific parts
   - **Pros**: Minimal changes
   - **Cons**: Complex implementation
   - **Chosen**: This approach

**Implications**:
- **Positive**: Safer and more reliable editing
- **Negative**: More complex implementation
- **Mitigation**: Comprehensive testing

### Decision 6: Operation Planning Implementation
**Decision**: Implement operation planning using:
- Structured operation types (Download, Create, Rename, Rewrite, Repair)
- Pre-execution validation
- Collision detection
- Dependency tracking
- Preview generation

**Rationale**:
- **Safety**: Prevents unsafe operations
- **User Experience**: Clear preview of changes
- **Reliability**: Validates before execution
- **Control**: Fine-grained control over operations
- **Feedback**: Clear feedback on proposed changes

### Decision 7: Change Execution Implementation
**Decision**: Implement change execution using:
- Atomic operations
- Temporary files
- Rollback support
- Error recovery
- Interruption handling

**Rationale**:
- **Safety**: Atomic operations prevent corruption
- **Reliability**: Rollback on failure
- **User Experience**: Clear progress reporting
- **Control**: Fine-grained control over execution
- **Recovery**: Automatic recovery from failures

### Decision 8: Rollback Implementation
**Decision**: Implement rollback using:
- Operation history
- Backup strategy
- Rollback validation
- Conflict detection
- State management

**Rationale**:
- **Safety**: Ability to undo changes
- **User Experience**: Confidence in making changes
- **Reliability**: Recovery from failures
- **Control**: Fine-grained control over rollbacks
- **Testing**: Easier testing with rollback support

### Decision 9: Downloader Implementation
**Decision**: Implement downloader using:
- HTTP(S) client
- File size limits
- Timeout handling
- Content-type validation
- Safe filename generation
- Error handling

**Rationale**:
- **Control**: Full control over download behavior
- **Performance**: Optimized for common cases
- **Safety**: Proper validation and error handling
- **Extensibility**: Easy to add new features
- **Reliability**: Robust error handling

### Decision 10: Attachment Manager Implementation
**Decision**: Implement attachment manager using:
- Location policy enforcement
- Safe file operations
- Multi-note reference tracking
- Collision handling
- Link validation

**Rationale**:
- **Safety**: Safe file operations
- **Reliability**: Proper handling of complex scenarios
- **User Experience**: Clear feedback and progress
- **Control**: Fine-grained control over operations
- **Testing**: Easy to test with mock data

### Decision 11: Vault Auditor Implementation
**Decision**: Implement vault auditor using:
- Read-only scanning
- Comprehensive issue detection
- Report generation
- Repair suggestions

**Rationale**:
- **Safety**: Read-only operation
- **Completeness**: Comprehensive scanning
- **User Experience**: Clear reports and suggestions
- **Control**: Fine-grained control over scanning
- **Testing**: Easy to test with mock data

### Decision 12: Duplicate Detector Implementation
**Decision**: Implement duplicate detector using:
- URL identity detection
- Content identity detection
- Cryptographic hashing
- Large file handling
- Naming collision prevention

**Rationale**:
- **Completeness**: Comprehensive duplicate detection
- **Accuracy**: Both URL and content-based detection
- **Performance**: Optimized for large files
- **Safety**: Proper handling of edge cases
- **User Experience**: Clear reporting and suggestions

### Decision 13: Settings Implementation
**Decision**: Implement settings using:
- Type-safe configuration
- Validation
- Persistence
- Migration support

**Rationale**:
- **Control**: Fine-grained control over behavior
- **User Experience**: Clear and intuitive settings
- **Safety**: Proper validation and error handling
- **Maintainability**: Easy to modify and extend
- **Testing**: Easy to test with mock data

### Decision 14: Command Implementation
**Decision**: Implement commands using:
- Command palette integration
- Progress reporting
- Cancellation support
- Error handling

**Rationale**:
- **User Experience**: Accessible operations
- **Control**: Fine-grained control over operations
- **Safety**: Proper error handling
- **Feedback**: Clear feedback to users
- **Testing**: Easy to test with mock data

## Decision Matrix

| Decision | Status | Implementation | Rationale |
|----------|--------|----------------|-----------|
| Dependency Strategy | Implemented | Minimal approach | Simpler, more maintainable |
| Module Structure | Implemented | Core/Services/UI | Clear separation of concerns |
| Path Resolution | Implemented | From scratch | Full control and customization |
| Reference Scanning | Implemented | Regex-based | Accurate and efficient |
| Safe Editing | Implemented | Targeted span editing | Safer and more reliable |
| Operation Planning | Implemented | Structured operations | Safety and user experience |
| Change Execution | Implemented | Atomic operations | Safety and reliability |
| Rollback | Implemented | Operation history | Safety and user confidence |
| Downloader | Implemented | HTTP client | Control and performance |
| Attachment Manager | Implemented | Location-based | Safety and reliability |
| Vault Auditor | Implemented | Read-only scanning | Safety and completeness |
| Duplicate Detector | Implemented | URL and content | Comprehensive detection |
| Settings | Implemented | Type-safe config | Control and user experience |
| Commands | Implemented | Full integration | Accessibility and feedback |

## Decision log

This document captures the key decisions made during the development of the Unified Obsidian Attachment Manager. Each decision includes the rationale, alternatives considered, and implications to support future maintenance and understanding.

## Future Considerations

### Reconsideration Points:
1. **Dependency Strategy**: May consider obsidian-lib if development becomes too complex
2. **Architecture**: May consider alternative architectures if current one proves limiting
3. **Implementation Details**: May consider different approaches if performance or functionality issues arise

### Documentation Needs:
1. **Architecture Decision Log**: Maintain as decisions are made
2. **Decision Rationale**: Document why decisions were made
3. **Alternative Documentation**: Document rejected alternatives
4. **Implication Tracking**: Track implications of decisions

## Conclusion

This decisions document provides a comprehensive record of the key architectural and implementation decisions made during the development of the Unified Obsidian Attachment Manager. It supports maintenance, onboarding, and future development by providing clear rationale and documentation of why certain choices were made.

By documenting decisions, we ensure that:
- New developers understand the reasoning behind the architecture
- Future maintainers can make informed decisions
- The project remains consistent and coherent
- The codebase is easier to understand and modify

This decisions document is a living document that will be updated as new decisions are made during the development process.

## References
1. **Architecture Documentation**: https://docs.obsidian.md/Developer+guidelines
2. **Testing Guidelines**: https://www.testing.io/
3. **Security Guidelines**: https://owasp.org/www-project-top-ten/
4. **Code Quality Guidelines**: https://google.github.io/styleguide/

This decisions document provides a comprehensive foundation for making informed decisions during the development of the Unified Obsidian Attachment Manager. It ensures consistency, maintainability, and future extensibility.

## End of Decisions Document

This concludes the Decisions.md document. Future decisions will be added as they are made during the development process.

---
*Document Status*: Complete
*Last Updated*: 2026-10-25
*Next Update*: As new decisions are made during implementation

This completes the Decisions.md document. It provides a comprehensive record of the architectural and implementation decisions made during the development of the Unified Obsidian Attachment Manager.