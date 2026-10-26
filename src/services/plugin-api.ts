/**
 * Cross-plugin API for Unified Obsidian Attachment Manager.
 *
 * Published through the plugin API registry, so consumers get version negotiation,
 * a handle that is revoked when this plugin unloads, and a wait that ends when
 * this plugin loads.
 */

export interface PluginApiDeclaration {
	api: UnifiedAttachmentManagerApi;
	apiVersion: string;
	contract: string;
}

export interface UnifiedAttachmentManagerApi {
	readonly version: string;

	/**
	 * Check if a path is ignored by include/exclude patterns.
	 */
	isPathIgnored(path: string, isFolder?: boolean): boolean;

	/**
	 * Whether a path is treated as a note.
	 */
	isNote(path: string): boolean;

	/**
	 * Whether a path is treated as an attachment.
	 */
	isAttachment(path: string): boolean;

	/**
	 * Get the attachment folder for a given note path.
	 */
	getAttachmentFolder(notePath: string): string;

	/**
	 * Whether renames are handled.
	 */
	shouldHandleRenames: boolean;

	/**
	 * Whether deletions are handled.
	 */
	shouldHandleDeletions: boolean;

	/**
	 * Whether shared attachments are rescued.
	 */
	shouldRescueSharedAttachments: boolean;
}

export interface CrossPluginApiContract {
	readonly version: string;
	readonly methods: readonly string[];
}
import { type PluginSettings } from '../settings/settings';

export const PLUGIN_API_CONTRACT = 'unified-attachment-manager-api';
export const PLUGIN_API_VERSION = '1.0.0';

export class CrossPluginApi implements UnifiedAttachmentManagerApi {
	public readonly version = PLUGIN_API_VERSION;

	private readonly settings: PluginSettings;

	public constructor(settings: PluginSettings) {
		this.settings = settings;
	}

	get isPathIgnored(): (path: string, isFolder?: boolean) => boolean {
		return (path: string, isFolder?: boolean) => {
			return this.settings.isPathIgnored?.(path, isFolder) ?? false;
		};
	}

	get isNote(): (path: string) => boolean {
		return (path: string) => {
			return path.endsWith('.md') && !this.isAttachment(path);
		};
	}

	get isAttachment(): (path: string) => boolean {
		return (path: string) => {
			const ext = path.split('.').pop()?.toLowerCase() ?? '';
			const attachmentExtensions = [
				'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'avif',
				'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'epub',
				'mp3', 'mp4', 'wav', 'ogg', 'webm'
			];
			return attachmentExtensions.includes(ext);
		};
	}

	get getAttachmentFolder(): (notePath: string) => string {
		return (notePath: string) => {
			const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));
			const noteName = notePath.split('/').pop()?.replace(/\.md$/, '') ?? '';
			const subPath = noteDir ? `${noteDir}/${noteName}` : noteName;

			if (!this.settings.attachmentFolder || this.settings.attachmentFolder === '/') {
				return subPath;
			}
			if (this.settings.attachmentFolder === './') {
				return noteDir ? `${noteDir}/${noteName}` : noteName;
			}
			if (this.settings.attachmentFolder.startsWith('./')) {
				const relative = this.settings.attachmentFolder.substring(2);
				const base = noteDir ? `${noteDir}/${relative}` : relative;
				return `${base}/${noteName}`;
			}
			return `${this.settings.attachmentFolder}/${subPath}`;
		};
	}

	get shouldHandleRenames(): boolean {
		return this.settings.shouldHandleRenames ?? false;
	}

	get shouldHandleDeletions(): boolean {
		return this.settings.shouldHandleDeletions ?? false;
	}

	get shouldRescueSharedAttachments(): boolean {
		return this.settings.shouldRescueSharedAttachments ?? false;
	}
}
