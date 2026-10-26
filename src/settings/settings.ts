/**
 * Plugin settings for Unified Obsidian Attachment Manager.
 *
 * All feature flags are off by default: installing this plugin changes nothing
 * until the user turns something on.
 */

export enum EmptyFolderBehavior {
	Keep = 'keep',
	Delete = 'delete',
	DeleteWithEmptyParents = 'delete-with-empty-parents'
}

export enum RescueAttachmentUsedByMultipleNotesMode {
	Prompt = 'prompt',
	Skip = 'skip'
}

export interface PluginSettings {
	/**
	 * Default attachment folder for saved remote images.
	 */
	attachmentFolder: string;

	/**
	 * Whether to show progress notices during image downloading.
	 */
	showProgress: boolean;

	/**
	 * Maximum download size in bytes.
	 */
	maxDownloadSize: number;

	/**
	 * Download timeout in seconds.
	 */
	downloadTimeoutSeconds: number;

	/**
	 * Download timeout in milliseconds (internal, derived from seconds).
	 */
	downloadTimeout: number;

	/**
	 * Whether to preview changes before writing.
	 */
	previewBeforeWrite: boolean;

	/**
	 * Number of operations to keep for undo/rollback.
	 */
	backupHistory: number;

	/**
	 * Whether to always use a subfolder for attachments.
	 */
	alwaysUseSubfolder: boolean;

	/**
	 * Naming policy for downloaded files.
	 */
	namingPolicy: string;

	/**
	 * Duplicate detection method: 'url' or 'content'.
	 */
	duplicateDetection: 'url' | 'content';

	/* ===== Rename/Delete Handler Settings (all off by default) ===== */

	/**
	 * Whether renaming a note rewrites links pointing at its old name.
	 * Off by default: Obsidian updates links on its own when this is off.
	 */
	shouldHandleRenames: boolean;

	/**
	 * Whether renaming a note rewrites the display text of links that pointed at its old name.
	 */
	shouldUpdateFileNameAliases: boolean;

	/**
	 * Whether renaming a note also renames or moves its attachment folder alongside it.
	 */
	shouldRenameAttachmentFolder: boolean;

	/**
	 * Whether renaming a note also renames the attachment files that travel with it.
	 */
	shouldRenameAttachmentFiles: boolean;

	/**
	 * Whether an attachment that collides with an existing file at the destination replaces it.
	 * Destructive, so off by default.
	 */
	shouldDeleteConflictingAttachments: boolean;

	/**
	 * Whether deleting a note also deletes the attachments only that note referenced.
	 * Destructive, so off by default.
	 */
	shouldHandleDeletions: boolean;

	/**
	 * What to do with a folder a deletion or a move has left empty.
	 */
	emptyFolderBehavior: EmptyFolderBehavior;

	/**
	 * Whether the folder a deleted note leaves empty is deleted too.
	 */
	shouldDeleteEmptyNoteFolders: boolean;

	/**
	 * Whether an attachment that survives a deletion is moved into the adopting note's attachment folder.
	 */
	shouldRescueSharedAttachments: boolean;

	/**
	 * Which note adopts an attachment several notes reference, highest priority first.
	 * Each entry is an extension such as `.md`, a `property:name=value` match, or a `/regex/`.
	 */
	notePriorities: string[];

	/**
	 * What to do when the priority list settles nothing.
	 */
	rescueAttachmentUsedByMultipleNotesMode: RescueAttachmentUsedByMultipleNotesMode;

	/**
	 * Entries that make a file an attachment even though its extension says otherwise.
	 * An entry is an extension such as `.excalidraw.md`, or a `property:name` /
	 * `property:name=value` frontmatter match.
	 */
	treatAsAttachmentExtensions: string[];

	/**
	 * Handle only the following paths. Empty means the whole vault.
	 * An entry is a path, a glob (`*`, `**`, `?`, `[abc]`), or a `/pattern/flags` regex.
	 */
	includePaths: string[];

	/**
	 * Leave the following paths alone. Empty means no paths are excluded.
	 * Same format as includePaths.
	 */
	excludePaths: string[];

	/**
	 * Whether a path is ignored by include/exclude patterns.
	 */
	isPathIgnored?: (path: string, isFolder?: boolean) => boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	attachmentFolder: 'attachments',
	showProgress: true,
	maxDownloadSize: 10485760,
	downloadTimeoutSeconds: 30,
	downloadTimeout: 30000,
	previewBeforeWrite: true,
	backupHistory: 5,
	alwaysUseSubfolder: true,
	namingPolicy: 'sanitize',
	duplicateDetection: 'url',

	// All feature flags off by default
	shouldHandleRenames: false,
	shouldUpdateFileNameAliases: true,
	shouldRenameAttachmentFolder: false,
	shouldRenameAttachmentFiles: false,
	shouldDeleteConflictingAttachments: false,
	shouldHandleDeletions: false,
	emptyFolderBehavior: EmptyFolderBehavior.Keep,
	shouldDeleteEmptyNoteFolders: false,
	shouldRescueSharedAttachments: false,
	notePriorities: [],
	rescueAttachmentUsedByMultipleNotesMode: RescueAttachmentUsedByMultipleNotesMode.Prompt,
	treatAsAttachmentExtensions: ['.excalidraw.md', 'property:excalidraw-plugin'],
	includePaths: [],
	excludePaths: []
};
