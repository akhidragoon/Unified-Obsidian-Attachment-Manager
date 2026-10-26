/**
 * @file
 *
 * Unified Obsidian Attachment Manager - main plugin entry point.
 *
 * UI access methods (not just command palette):
 *   - Command palette (cmd+p / ctrl+p): all commands
 *   - Settings tab: Settings → Unified Attachment Manager
 *   - File menu / context menu: right-click folders → "Localize remote images in folder"
 *   - Plugin conflict banner: shown in settings tab when blocking/warning conflicts exist
 *   - Plugin dependents list: shown in settings tab when other plugins depend on this one
 *   - First load notice: welcome message on first install
 */

import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, requestUrl, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, EmptyFolderBehavior, RescueAttachmentUsedByMultipleNotesMode, type PluginSettings } from './settings/settings';
import { scanReferences } from './core/reference-scanner';
import { applyReferenceEdits } from './core/safe-markdown-editor';
import { downloadAndReplaceImages, saveImagesInFolder, collectMarkdownFiles } from './services/image-downloader';
import { auditAttachmentLinks, generateLinkConsistencyReportText } from './services/link-consistency';
import { PluginConflictDetector, PluginConflictSeverity } from './services/plugin-conflicts';
import { PluginDependentsComponent } from './services/plugin-dependents';
import { CrossPluginApi, PLUGIN_API_CONTRACT, PLUGIN_API_VERSION } from './services/plugin-api';
import { settingsMigration } from './services/settings-migration';
import { FirstLoadNoticeComponent } from './services/first-load-notice';
import { deleteEmptyFolders, EmptyFolderBehavior as EmptyFolderBehaviorEnum } from './services/empty-folder-deletion';
import { moveAttachmentsOnNoteRename, cleanupAttachmentsOnNoteDelete, isNoteFile, isAttachmentFile, getAttachmentFolderForNote } from './services/rename-delete-handler';
import { normalizeFileName, normalizeAllFileNames, scanNonNormalizedFiles } from './services/unicode-name-normalizer';
import { findPathCompatibilityViolations, repairName, PathCompatibilityPlatform } from './services/path-compatibility';
import { createMovePlan, validateMovePlan, generateOrganizationReport } from './services/attachment-organizer';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif', '.avif'];

const IMAGE_PATTERNS = [
	/!\[[^\]]*]\(\s*(https?:\/\/[^)\s]+)/g,
	/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi,
	/<img\b[^>]*\bsrc\s*=\s*'([^']+)'/gi,
	/!\[\[(https?:\/\/[^\]]+)]]/g,
	/]\(\s*(https?:\/\/[^)\s]+)/g,
];

const LINK_PATTERNS = [
	/!\[([^\]]*)\]\(([^)\s]+)/g,
	/\[([^\]]+)\]\(([^)\s]+)/g,
	/!\[\[([^\]]+)\]\]/g,
	/\[\[([^\]]+)\]\]/g,
];

interface DownloadResult {
	total: number;
	saved: number;
	failed: number;
	errors: string[];
}

function generateId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 12; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

function ensureFolder(vault: any, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	const existing = vault.getAbstractFileByPath?.(normalized);
	if (existing) return Promise.resolve();
	const parts = normalized.split('/').filter(Boolean);
	let current = '';
	return parts.reduce((promise, part) => {
		return promise.then(async () => {
			current = current ? `${current}/${part}` : part;
			const found = vault.getAbstractFileByPath?.(current);
			if (!found) {
				await vault.createFolder?.(current);
			}
		});
	}, Promise.resolve());
}

function buildAttachmentFolder(app: App, file: TFile): string {
	const vault = app.vault as unknown as Record<string, unknown>;
	const config = (vault['config'] ?? {}) as Record<string, unknown>;
	const attachmentBase = config['attachmentFolderPath'] as string | undefined;

	const notePath = file.path;
	const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));
	const noteName = file.basename;

	const subPath = noteDir ? `${noteDir}/${noteName}` : noteName;

	if (!attachmentBase || attachmentBase === '/') {
		return subPath;
	}

	if (attachmentBase === './') {
		return noteDir ? `${noteDir}/${noteName}` : noteName;
	}

	if (attachmentBase.startsWith('./')) {
		const relative = attachmentBase.substring(2);
		const base = noteDir ? `${noteDir}/${relative}` : relative;
		return `${base}/${noteName}`;
	}

	return `${attachmentBase}/${subPath}`;
}

function escapeForRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatMarkdownLinkTarget(target: string): string {
	if (!target) return target;
	if (/[\s()<>]/.test(target)) {
		return `<${target}>`;
	}
	return target;
}

function collapseLinkedImages(content: string): string {
	const linkedImageRe = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)"]+)(?:\s+"[^"]*")?\s*\)/g;
	return content.replace(linkedImageRe, (_match, alt: string, imgSrc: string, linkHref: string) => {
		const trimmedHref = linkHref.trim();
		if (imgSrc === trimmedHref || !trimmedHref.startsWith('http')) {
			return `![${alt}](${imgSrc})`;
		}
		return _match;
	});
}

function looksLikeImage(url: string): boolean {
	const cleaned = (url.split('?')[0] ?? url).toLowerCase();
	return IMAGE_EXTENSIONS.some((ext) => cleaned.endsWith(ext));
}

function extensionFromUrl(url: string): string {
	const cleaned = (url.split('?')[0] ?? url).toLowerCase();
	if (cleaned.endsWith('.jpg') || cleaned.endsWith('.jpeg')) return 'jpg';
	if (cleaned.endsWith('.png')) return 'png';
	if (cleaned.endsWith('.gif')) return 'gif';
	if (cleaned.endsWith('.bmp')) return 'bmp';
	if (cleaned.endsWith('.svg')) return 'svg';
	if (cleaned.endsWith('.webp')) return 'webp';
	if (cleaned.endsWith('.ico')) return 'ico';
	if (cleaned.endsWith('.tiff') || cleaned.endsWith('.tif')) return 'tiff';
	if (cleaned.endsWith('.avif')) return 'avif';
	return 'png';
}

function extensionFromContentType(contentType: string): string {
	const ct = contentType.toLowerCase();
	if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
	if (ct.includes('png')) return 'png';
	if (ct.includes('gif')) return 'gif';
	if (ct.includes('bmp')) return 'bmp';
	if (ct.includes('svg')) return 'svg';
	if (ct.includes('webp')) return 'webp';
	if (ct.includes('ico') || ct.includes('icon')) return 'ico';
	if (ct.includes('tiff')) return 'tiff';
	if (ct.includes('avif')) return 'avif';
	return 'png';
}

function findRemoteImageUrls(content: string): string[] {
	const urls = new Set<string>();

	for (const pattern of IMAGE_PATTERNS) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const url = (match[1] ?? '').trim();
			if (url && url.startsWith('http') && looksLikeImage(url)) {
				urls.add(url);
			}
		}
	}

	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch) {
		const frontmatter = fmMatch[1] ?? '';
		const FRONTMATTER_URL_RE = /^[a-zA-Z_-]+:\s*(https?:\/\/\S+)/gm;
		FRONTMATTER_URL_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = FRONTMATTER_URL_RE.exec(frontmatter)) !== null) {
			const url = (match[1] ?? '').trim();
			if (url && url.startsWith('http') && looksLikeImage(url)) {
				urls.add(url);
			}
		}
	}

	return Array.from(urls);
}

export default class UnifiedAttachmentManager extends Plugin {
	settings!: PluginSettings;

	public pluginConflictDetector: PluginConflictDetector | null = null;
	public pluginDependentsComponent: PluginDependentsComponent | null = null;
	public crossPluginApi: CrossPluginApi | null = null;
	public firstLoadNotice: FirstLoadNoticeComponent | null = null;
	public wasDataFileMissingOnInitialLoad = false;

	async onload() {
		// 1. Load settings with migration
		await this.loadSettingsWithMigration();

		// 2. Initialize plugin conflict detector
		this.pluginConflictDetector = new PluginConflictDetector(
			this.app,
			this.manifest.id,
			this.manifest.name,
			this.manifest.version
		);

		// 3. Initialize plugin dependents tracking
		this.pluginDependentsComponent = new PluginDependentsComponent({
			app: this.app,
			pluginId: this.manifest.id
		});
		this.pluginDependentsComponent.registerEvents();

		// 4. Initialize cross-plugin API
		this.crossPluginApi = new CrossPluginApi(this.settings);

		// 5. Initialize first load notice
		this.firstLoadNotice = new FirstLoadNoticeComponent({
			app: this.app,
			pluginId: this.manifest.id,
			pluginNoticeComponent: this
		});

		// 6. Register setting tab
		this.addSettingTab(new UnifiedAttachmentManagerSettingTab(this.app, this));

		// 7. Register commands
		this.registerCommands();

		// 8. Register file menu event for folders
		this.registerFileMenuEvent();

		// 9. Register file system event listeners for rename/delete handling
		if (this.settings.shouldHandleRenames || this.settings.shouldHandleDeletions) {
			this.registerFileSystemEvents();
		}

		// 10. Show first load notice
		void this.firstLoadNotice.showIfFirstLoad(this.wasDataFileMissingOnInitialLoad);
	}

	public registerCommands(): void {
		// Localize remote images in current note
		this.addCommand({
			id: 'localize-remote-images-current-note',
			name: 'Localize remote images in current note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') {
					return false;
				}
				if (!checking) {
					void this.saveImages(file);
				}
				return true;
			}
		});

		// Localize remote images in folder
		this.addCommand({
			id: 'localize-remote-images-folder',
			name: 'Localize remote images in folder',
			callback: async () => {
				new Notice('Use the context menu on a folder to localize images in that folder');
			}
		});

		// Localize remote images across vault
		this.addCommand({
			id: 'localize-remote-images-vault',
			name: 'Localize remote images across vault',
			callback: () => {
				const root = this.app.vault.getAbstractFileByPath('/');
				if (root instanceof TFolder) {
					void saveImagesInFolder(this.app, root, this.settings.showProgress ?? true, this.settings);
				} else {
					new Notice('Could not access vault root');
				}
			}
		});

		// Audit attachment links
		this.addCommand({
			id: 'audit-attachment-links',
			name: 'Audit attachment links',
			callback: () => {
				void auditAttachmentLinks(this.app);
			}
		});

		// Delete empty folders
		this.addCommand({
			id: 'delete-empty-folders',
			name: 'Delete empty folders',
			callback: () => {
				const abortSignal = new AbortController().signal;
				void deleteEmptyFolders({
					abortSignal,
					app: this.app,
					emptyFolderBehavior: this.settings.emptyFolderBehavior,
					isPathIgnored: (path, isFolder) => this.settings.isPathIgnored?.(path, isFolder) ?? false,
					pluginNoticeComponent: this
				});
			}
		});

		// Preview attachment organization
		this.addCommand({
			id: 'preview-attachment-organization',
			name: 'Preview attachment organization',
			callback: () => {
				new Notice('Organization preview feature coming soon');
			}
		});

		// Find duplicate attachments
		this.addCommand({
			id: 'find-duplicate-attachments',
			name: 'Find duplicate attachments',
			callback: () => {
				new Notice('Duplicate detection coming soon');
			}
		});

		// Review unused attachments
		this.addCommand({
			id: 'review-unused-attachments',
			name: 'Review potentially unused attachments',
			callback: () => {
				new Notice('Orphan detection coming soon');
			}
		});

		// Undo last operation
		this.addCommand({
			id: 'undo-last-operation',
			name: 'Undo last operation',
			callback: () => {
				new Notice('No operations to undo');
			}
		});

		// Normalize Unicode names
		this.addCommand({
			id: 'normalize-unicode-names',
			name: 'Normalize Unicode names',
			callback: async () => {
				const result = await normalizeAllFileNames(this.app);
				new Notice(
					`Normalized ${result.normalized} file(s). `
					+ `${result.collisions} collision(s), ${result.errors.length} error(s).`
				);
			}
		});

		// Check path compatibility
		this.addCommand({
			id: 'check-path-compatibility',
			name: 'Check path compatibility',
			callback: () => {
				const platforms: PathCompatibilityPlatform[] = [
					PathCompatibilityPlatform.Windows,
					PathCompatibilityPlatform.Android,
					PathCompatibilityPlatform.Linux,
					PathCompatibilityPlatform.MacOs,
					PathCompatibilityPlatform.Ios
				];
				let totalViolations = 0;
				for (const file of this.app.vault.getAllLoadedFiles()) {
					const violations = findPathCompatibilityViolations({
						isFolder: file instanceof TFolder,
						maxVaultRootPathLength: 0,
						path: file.path,
						platforms
					});
					totalViolations += violations.length;
				}
				new Notice(`Found ${totalViolations} path compatibility issue(s)`);
			}
		});
	}

	public registerFileMenuEvent(): void {
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('Localize remote images in folder')
							.setIcon('image-down')
							.onClick(() => {
								void saveImagesInFolder(this.app, file, this.settings.showProgress ?? true, this.settings);
							});
					});
				}
			})
		);
	}

	public registerFileSystemEvents(): void {
		// Handle note renames
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (!(file instanceof TFile)) return;
				if (!isNoteFile(file)) return;
				if (!this.settings.shouldHandleRenames) return;

				void moveAttachmentsOnNoteRename(this.app, oldPath, file.path);
			})
		);

		// Handle note deletions
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!(file instanceof TFile)) return;
				if (!isNoteFile(file)) return;
				if (!this.settings.shouldHandleDeletions) return;

				void cleanupAttachmentsOnNoteDelete(this.app, file.path);
			})
		);
	}

	public async loadSettingsWithMigration(): Promise<void> {
		const raw = await this.loadData();
		const stored = raw as Partial<PluginSettings> | null;
		const storedVersion = (stored as any)?.version ?? '0.0.0';

		const migrationResult = settingsMigration.migrate(stored ?? {}, storedVersion);
		if (migrationResult.errors.length > 0) {
			console.warn('Settings migration errors:', migrationResult.errors.join('\n'));
		}

		this.settings = { ...DEFAULT_SETTINGS, ...(stored as any) };
		this.wasDataFileMissingOnInitialLoad = raw === null || raw === undefined;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async saveImages(file: TFile): Promise<void> {
		try {
			const result = await downloadAndReplaceImages(this.app, file, this.settings.showProgress ?? true);
			if (result.total === 0) return;
			if (result.failed > 0) {
				new Notice(`Saved ${result.saved}/${result.total} images. ${result.failed} failed.`);
			} else {
				new Notice(`All ${result.saved} images saved locally.`);
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			new Notice(`Failed to save images: ${msg}`);
		}
	}

	/**
	 * Show plugin conflict notice if blocking conflicts exist.
	 */
	public showConflictNotice(): void {
		if (!this.pluginConflictDetector) return;

		const installedPlugins = this.pluginConflictDetector.getInstalledPlugins();
		const conflicts = this.pluginConflictDetector.getConflicts(installedPlugins);

		if (conflicts.hasActiveBlockingConflicts) {
			const reasons = conflicts.blocking.map(c => `${c.pluginName}: ${c.reason}`).join('\n');
			new Notice(`Plugin conflict: ${reasons}`, 10000);
		} else if (conflicts.hasActiveWarningConflicts) {
			const reasons = conflicts.warning.map(c => `${c.pluginName}: ${c.reason}`).join('\n');
			new Notice(`Plugin warning: ${reasons}`, 8000);
		}
	}

	/**
	 * Show notice (implements pluginNoticeComponent interface).
	 */
	public showNotice(message: string): void {
		new Notice(message);
	}
}

class UnifiedAttachmentManagerSettingTab extends PluginSettingTab {
	plugin: UnifiedAttachmentManager;

	constructor(app: App, plugin: UnifiedAttachmentManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Unified Attachment Manager').setHeading();

		// Conflict banner
		if (this.plugin.pluginConflictDetector) {
			const installedPlugins = this.plugin.pluginConflictDetector.getInstalledPlugins();
			const conflicts = this.plugin.pluginConflictDetector.getConflicts(installedPlugins);
			if (conflicts.hasActiveBlockingConflicts || conflicts.hasActiveWarningConflicts) {
				new Setting(containerEl)
					.setName('Plugin Conflicts')
					.setDesc('Some plugins may conflict with this one')
					.addButton((btn) => {
						btn.setButtonText('View Details')
							.onClick(() => {
								this.plugin.showConflictNotice();
							});
					});
			}
		}

		// Feature toggles (all off by default)
		new Setting(containerEl)
			.setName('Should handle renames')
			.setDesc('Whether renaming a note rewrites links pointing at its old name. Off by default.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldHandleRenames);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldHandleRenames = value;
					await this.plugin.saveSettings();
					if (value) {
						this.plugin.registerFileSystemEvents();
					}
				});
			});

		new Setting(containerEl)
			.setName('Should update file name aliases')
			.setDesc('Whether renaming a note rewrites the display text of links that pointed at its old name.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldUpdateFileNameAliases);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldUpdateFileNameAliases = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Should rename attachment folder')
			.setDesc('Whether renaming a note also renames or moves its attachment folder alongside it.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldRenameAttachmentFolder);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldRenameAttachmentFolder = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Should rename attachment files')
			.setDesc('Whether renaming a note also renames the attachment files that travel with it.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldRenameAttachmentFiles);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldRenameAttachmentFiles = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Should handle deletions')
			.setDesc('Whether deleting a note also deletes the attachments only that note referenced.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldHandleDeletions);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldHandleDeletions = value;
					await this.plugin.saveSettings();
					if (value) {
						this.plugin.registerFileSystemEvents();
					}
				});
			});

		new Setting(containerEl)
			.setName('Empty folder behavior')
			.setDesc('What to do with a folder a deletion or a move has left empty.')
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					keep: 'Keep',
					delete: 'Delete',
					'delete-with-empty-parents': 'Delete with empty parents'
				});
				dropdown.setValue(this.plugin.settings.emptyFolderBehavior);
				dropdown.onChange(async (value) => {
					this.plugin.settings.emptyFolderBehavior = value as any;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Should delete empty note folders')
			.setDesc('Whether the folder a deleted note leaves empty is deleted too.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldDeleteEmptyNoteFolders);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldDeleteEmptyNoteFolders = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Should rescue shared attachments')
			.setDesc('Whether an attachment that survives a deletion is moved into the adopting note\'s attachment folder.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.shouldRescueSharedAttachments);
				toggle.onChange(async (value) => {
					this.plugin.settings.shouldRescueSharedAttachments = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Show progress notices')
			.setDesc('Display notices during image downloading')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showProgress ?? true);
				toggle.onChange(async (value) => {
					this.plugin.settings.showProgress = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
