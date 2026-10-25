# ARCHITECTURE

## Overview
Architecture for Unified Obsidian Attachment Manager (U OAM)

## Module Structure

### Core Module (src/core/)

#### Path Resolver
- **Purpose**: Shared path resolution used by all features
- **Responsibilities**:
  - Resolve references relative to source notes
  - Handle root-relative vault paths
  - Distinguish internal from external URLs
  - URL encoding/decoding
  - Normalize separators safely
  - Detect ambiguous matches
  - Respect attachment-folder rules
- **Files**: `path-resolver.ts`

#### Reference Scanner
- **Purpose**: Identify file references without rewriting content
- **Responsibilities**:
  - Scan Markdown links and images
  - Parse HTML image references
  - Handle wiki embeds and links
  - Detect frontmatter field references
  - Identify external URLs, data URLs
  - Preserve source positions
  - Use parsers instead of broad regexes
- **Files**: `reference-scanner.ts`

#### Safe Markdown Editor
- **Purpose**: Targeted editor for reference span changes
- **Responsibilities**:
  - Preserve unrelated prose
  - Preserve frontmatter
  - Preserve code blocks and inline code
  - Preserve link aliases and display text
  - Preserve embed sizing and fragments
  - Avoid full note parsing when possible
- **Files**: `safe-markdown-editor.ts`

#### Operation Planner
- **Purpose**: Represent proposed changes as structured operations
- **Responsibilities**:
  - Download remote files
  - Create local attachments
  - Rename/move attachments
  - Rewrite Markdown references
  - Repair broken links
  - Record duplicates
  - Record potential orphans
  - Validate destinations
  - Detect collisions
  - Check dependencies
- **Files**: `operation-planner.ts`

#### Change Executor
- **Purpose**: Controlled execution pipeline with validation
- **Responsibilities**:
  - Validate entire operation before execution
  - Recheck paths before execution
  - Apply operations in defined order
  - Use temporary files and atomic replacement
  - Track success/failure
  - Provide rollback information
  - Handle interruption safely
- **Files**: `change-executor.ts`

#### Rollback Manager
- **Purpose**: Maintain operation history for reversibility
- **Responsibilities**:
  - Record original content and paths
  - Use bounded backup strategy
  - Validate rollback compatibility
  - Avoid overwriting user edits
  - Refuse unsafe rollbacks
- **Files**: `rollback-manager.ts`

### Services Module (src/services/)

#### Downloader
- **Purpose**: HTTP(S) download with validation
- **Responsibilities**:
  - Download only supported URLs
  - Support configurable timeout/limits
  - Validate HTTP status and redirects
  - Check response metadata/signatures
  - Generate safe filenames
  - Detect duplicate URLs
  - Reuse existing files safely
  - Handle authentication/network errors
- **Files**: `downloader.ts`

#### Attachment Manager
- **Purpose**: Location-based attachment organization
- **Responsibilities**:
  - Create attachments in configured locations
  - Safe moves and renames
  - Update references for affected notes
  - Detect multi-note references
  - Handle filename collisions
  - Create folders as needed
  - Validate existing references
- **Files**: `attachment-manager.ts`

#### Vault Auditor
- **Purpose**: Read-only vault consistency scanning
- **Responsibilities**:
  - Find broken local links/embeds
  - Detect missing attachment targets
  - Check frontmatter field references
  - Validate attachment locations
  - Find duplicate files
  - Detect potential orphans
  - Identify unsafe filenames
  - Report ambiguous resolutions
- **Files**: `vault-auditor.ts`

#### Duplicate Detector
- **Purpose**: Identify duplicate and potentially unused attachments
- **Responsibilities**:
  - URL identity detection with normalization
  - Content identity via cryptographic hashing
  - Not assume URL equivalence
  - Not assume filename equivalence
  - Report for consolidation
  - Safe preview before changes
- **Files**: `duplicate-detector.ts`

### UI & Settings Module (src/ui/)

#### Settings
- **Purpose**: User configuration and validation
- **Responsibilities**:
  - Default attachment location policy
  - Naming policies
  - Supported media types
  - Download timeout/limits
  - Duplicate detection behavior
  - Preview behavior
  - Backup history limits
  - Portability rules
  - Exclusion rules
- **Files**: `settings.ts`

#### Command Palette
- **Purpose**: User-accessible operations
- **Responsibilities**:
  - Localize remote images (current note)
  - Localize remote images (selected folder)
  - Localize remote images (vault-wide)
  - Audit attachment links
  - Preview attachment organization
  - Repair broken links
  - Find duplicate attachments
  - Review potentially unused attachments
  - Undo last operations
- **Files**: `commands/`

#### Views & Modals
- **Purpose**: Progress reporting and user interaction
- **Responsibilities**:
  - Preview operation changes
  - Report progress for long operations
  - Handle cancellation
  - Show success/failure summaries
- **Files**: `ui/operation-preview.ts`, `ui/progress.ts`

### Types Module (src/types/)

#### Core Types
- **Purpose**: Shared interfaces and enums
- **Responsibilities**:
  - Attachment metadata
  - Operation types
  - Error types
  - Result types
- **Files**: `types/attachment.ts`, `types/operations.ts`

## Data Flow

### Initialization Flow
1. Plugin loads → Initialize core services
2. Load settings → Configure behavior
3. Register commands → Make operations available
4. Register listeners → Watch for vault changes

### Operation Flow (Example: Localize Images)
1. User triggers command
2. Operation planner creates sequence:
   - Scan note for remote URLs
   - For each URL:
     - Validate URL format
     - Download file
     - Save to attachment folder
     - Record rewrite operation
3. Change executor validates entire operation
4. Apply operations atomically
5. Update rollback manager
6. Report results

### Audit Flow (Example: Vault Auditor)
1. User triggers audit
2. Initialize empty result containers
3. Walk vault files:
   - Extract references
   - Check local resolution
   - Validate attachment locations
   - Detect duplicates
   - Collect findings
4. Return consolidated report

## API Boundaries

### Public API
- **Plugin Class**: Main entry point, extends Obsidian Plugin
- **Commands**: Accessible via command palette
- **Settings Tab**: UI for configuration
- **Progress API**: Report operation progress

### Internal API
- **Core Services**: Internal implementation details
- **Service Interfaces**: Abstract service contracts
- **Type Definitions**: Shared interfaces

## Error Handling

### Error Categories
1. **Input Validation**: Invalid URLs, paths, settings
2. **Network Errors**: Download failures, timeouts
3. **Filesystem Errors**: Permission, disk full
4. **Operation Conflicts**: Race conditions, state corruption

### Error Handling Strategy
- **Validation**: Fail fast on invalid input
- **Resilience**: Continue on individual operation failures
- **Reporting**: Detailed error messages with context
- **Recovery**: Automatic rollback on critical failures

## Security Considerations

### Threat Model
1. **Remote Code Execution**: Malicious images
2. **Path Traversal**: URL-based attacks
3. **Resource Exhaustion**: Large downloads
4. **Denial of Service**: Network flooding

### Security Controls
- **URL Validation**: Only allow HTTP(S)
- **Content-Type Checking**: Validate file signatures
- **Size Limits**: Configurable download limits
- **Timeout Handling**: Prevent hanging operations
- **Safe Filename Generation**: Prevent injection

## Performance Considerations

### Optimization Strategies
1. **Caching**: Scan results, download responses
2. **Batching**: Process multiple operations
3. **Concurrency Limits**: Control resource usage
4. **Lazy Loading**: Defer expensive operations

### Memory Management
- **Streaming**: Process large files in chunks
- **Garbage Collection**: Clear temporary objects
- **Resource Limits**: Monitor and limit usage

## Platform Compatibility

### Supported Platforms
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS, Android
- **Web**: Browser-based Obsidian

### Platform-Specific Considerations
1. **File Systems**: Different path separator handling
2. **Permissions**: Platform-specific access controls
3. **Network**: Platform-specific request limits
4. **Performance**: Different performance characteristics

## Deployment Strategy

### Production Readiness
1. **Atomic Operations**: Ensure consistency
2. **Backup Strategy**: Preserve user data
3. **Rollback Capability**: Allow recovery
4. **Error Recovery**: Handle unexpected failures

### Update Strategy
1. **Backward Compatibility**: Support old vault formats
2. **Migration**: Smooth transition between versions
3. **Configuration Migration**: Preserve user settings

## Testing Integration

### Unit Tests
- **Core Services**: Mock external dependencies
- **Path Resolution**: Test various path formats
- **Reference Parsing**: Test different syntaxes
- **Error Handling**: Test failure scenarios

### Integration Tests
- **End-to-End Operations**: Complete workflows
- **Vault Interactions**: Real file system tests
- **Concurrent Operations**: Multiple simultaneous changes

### Performance Tests
- **Large Vaults**: Test with many files
- **Concurrent Downloads**: Test resource usage
- **Operation Duration**: Test completion times

## Dependencies Management

### External Dependencies
- **Obsidian API**: Use supported public APIs
- **Network**: Fetch for HTTP operations
- **Filesystem**: Obsidian's file system abstraction

### Internal Dependencies
- **Circular Import Prevention**: Clear module boundaries
- **Interface Segregation**: Minimal, focused interfaces
- **Dependency Injection**: Testable service construction

## Internationalization

### Text Handling
- **Unicode Support**: Full Unicode filename/path support
- **Normalization**: NFC normalization for filenames
- **Encoding**: UTF-8 for network operations
- **Display**: Proper localization of messages

### Right-to-Left Languages
- **Path Handling**: Proper handling of RTL text
- **Link Display**: Correct rendering of bidirectional text

## Monitoring & Logging

### Logging Strategy
- **Operation Tracking**: Detailed operation logs
- **Error Tracking**: Comprehensive error reporting
- **Performance Metrics**: Measure operation duration
- **Progress Reporting**: User-visible progress updates

### Log Levels
- **Debug**: Detailed implementation information
- **Info**: User-relevant operational information
- **Warning**: Potential issues
- **Error**: Failure conditions

## Future Extensibility

### Plugin Architecture
- **Hook System**: Allow extensions to add features
- **Command System**: Easy addition of new operations
- **Settings System**: Flexible configuration options

### Migration Path
- **Version Compatibility**: Support different Obsidian versions
- **Feature Flags**: Gradual rollout of new features
- **Deprecation**: Clear paths for removing features

## Documentation Generation

### API Documentation
- **TypeScript Doc Comments**: Comprehensive API documentation
- **Examples**: Code snippets for common operations
- **Tutorials**: Step-by-step guides
- **Reference**: Complete API reference

## Code Quality Standards

### Code Style
- **ESLint**: Pre-configured linting rules
- **TypeScript**: Strict type checking
- **Testing**: Comprehensive test coverage
- **Documentation**: Inline documentation

### Maintainability
- **Modularity**: Clear separation of concerns
- **Testability**: Mockable dependencies
- **Readability**: Clear naming and structure
- **Documentation**: Comprehensive documentation

## Development Workflow

### Development Process
1. **Local Development**: Development build with hot reload
2. **Testing**: Run tests before committing
3. **Building**: Production build for distribution
4. **Release**: Version bump and asset preparation

### Quality Gates
- **Type Checking**: No TypeScript errors
- **Linting**: Code style compliance
- **Testing**: Test suite passes
- **Building**: Production build succeeds

This architecture provides a solid foundation for the Unified Obsidian Attachment Manager, combining the best features from both reference projects while maintaining code quality and extensibility.