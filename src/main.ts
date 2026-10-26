import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, requestUrl, normalizePath, Vault } from 'obsidian';
import { DEFAULT_SETTINGS } from './settings/settings';
import type { PluginSettings } from './settings/settings';
import { createPathAuditReport, createPathIssue, getAttachmentFolderForNote, generateAttachmentReport, hasUnsafeFilename, isAttachmentFilename } from './services/path-auditor';

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

function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
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

async function downloadAndReplaceImages(
	app: App,
	file: TFile,
	showNotice: boolean,
): Promise<DownloadResult> {
	const content = await app.vault.read(file);
	const urls = findRemoteImageUrls(content);

	const result: DownloadResult = {
		total: urls.length,
		saved: 0,
		failed: 0,
		errors: [],
	};

	if (urls.length === 0) {
		if (showNotice) {
			new Notice('No remote images found in this note.');
		}
		return result;
	}

	const attachmentFolder = buildAttachmentFolder(app, file);
	await ensureFolder(app.vault, attachmentFolder);

	if (showNotice) {
		new Notice(`Found ${urls.length} remote image(s). Downloading...`);
	}

	const urlToLocal = new Map<string, string>();

	for (const url of urls) {
		try {
			const response = await requestUrl({ url });
			const buffer = response.arrayBuffer;

			const contentType = response.headers['content-type'] ?? '';
			let ext: string;
			if (contentType && contentType.includes('image/')) {
				ext = extensionFromContentType(contentType);
			} else {
				ext = extensionFromUrl(url);
			}

			const filename = `${generateId()}.${ext}`;
			const filePath = normalizePath(`${attachmentFolder}/${filename}`);

			await app.vault.createBinary(filePath, buffer);
			urlToLocal.set(url, filePath);
			result.saved++;
		} catch (e: unknown) {
			result.failed++;
			const msg = e instanceof Error ? e.message : 'Unknown error';
			result.errors.push(`${url}: ${msg}`);
		}
	}

let updatedContent = content;
	for (const [url, localPath] of urlToLocal) {
		const formatted = formatMarkdownLinkTarget(localPath);
		const pattern = new RegExp(escapeForRegex(url), 'g');
		updatedContent = updatedContent.replace(pattern, formatted);
	}

	updatedContent = collapseLinkedImages(updatedContent);

	if (updatedContent !== content) {
		await app.vault.modify(file, updatedContent);
	}

	if (showNotice) {
		if (result.failed > 0) {
			new Notice(
				`Saved ${result.saved}/${result.total} images. ${result.failed} failed.`,
			);
		} else {
			new Notice(`All ${result.saved} images saved locally.`);
		}
	}

	return result;
}

function collectMarkdownFiles(folder: TFolder): TFile[] {
	const out: TFile[] = [];
	const walk = (f: TFolder) => {
		for (const child of f.children) {
			if (child instanceof TFile && child.extension === 'md') {
				out.push(child);
			} else if (child instanceof TFolder) {
				walk(child);
			}
		}
	};
	walk(folder);
	return out;
}

async function saveImagesInFolder(
	app: App,
	folder: TFolder,
	showNotice: boolean,
): Promise<void> {
	const files = collectMarkdownFiles(folder);

	if (files.length === 0) {
		if (showNotice) new Notice('No Markdown notes found in this folder.');
		return;
	}

	if (showNotice) new Notice(`Scanning ${files.length} note(s) for remote images...`);

	let notesWithImages = 0;
	let totalSaved = 0;
	let totalFailed = 0;
	const errors: string[] = [];

	for (const file of files) {
		try {
			const result = await downloadAndReplaceImages(app, file, false);
			if (result.total > 0) notesWithImages++;
			totalSaved += result.saved;
			totalFailed += result.failed;
			for (const err of result.errors) {
				errors.push(`${file.path}: ${err}`);
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			errors.push(`${file.path}: ${msg}`);
			totalFailed++;
		}
	}

	const failedSuffix = totalFailed > 0 ? `, ${totalFailed} failed` : '';
	const summary =
		`${files.length} note(s) scanned, ${notesWithImages} contained images, ` +
		`${totalSaved} image(s) saved${failedSuffix}.`;
	new Notice(summary, 8000);

	if (errors.length > 0) {
		new Notice(`Errors in ${errors.length} file(s). Check console for details.`);
	}
}

async function auditAttachmentLinks(app: App): Promise<void> {
	const root = app.vault.getAbstractFileByPath('/');
	if (!(root instanceof TFolder)) {
		new Notice('Could not access vault root');
		return;
	}
	const files = collectMarkdownFiles(root);
	const issues = [];
	let totalAttachments = 0;
	let referencedAttachments = new Set<string>();

	for (const file of files) {
		const content = await app.vault.read(file);
		const urls = findRemoteImageUrls(content);

		for (const url of urls) {
			if (looksLikeImage(url)) {
				issues.push(createPathIssue(
					'broken_link',
					file.path,
					url,
					'Remote image not downloaded to vault',
					'high',
				));
			}
		}

		// Find all attachment links in the note
		for (const pattern of LINK_PATTERNS) {
			pattern.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = pattern.exec(content)) !== null) {
				const link = match[2] ?? match[1] ?? '';
				if (!link || link.startsWith('http') || link.startsWith('#')) continue;

				const linkPath = normalizePath(link);
				const fileObj = app.vault.getAbstractFileByPath(linkPath);
				if (fileObj && fileObj instanceof TFile && isAttachmentFilename(fileObj.name)) {
					referencedAttachments.add(linkPath);
					totalAttachments++;

					// Check if attachment is in proper folder
					const properFolder = getAttachmentFolderForNote(app, file.path);
					const linkDir = linkPath.substring(0, linkPath.lastIndexOf('/'));
					if (properFolder && linkDir !== properFolder) {
						issues.push(createPathIssue(
							'misplaced',
							file.path,
							link,
							'Attachment not in proper folder for this note',
							'medium',
							`${properFolder}/${fileObj.name}`,
						));
					}
				}
			}
		}
	}

	// Check for unsafe filenames
	const allFiles = app.vault.getAllLoadedFiles();
	for (const f of allFiles) {
		if (f instanceof TFile && isAttachmentFilename(f.name)) {
			if (hasUnsafeFilename(f.name)) {
				issues.push(createPathIssue(
					'unsafe_filename',
					f.path,
					f.name,
					'Filename contains unsafe characters',
					'low',
				));
			}
		}
	}

	const report = createPathAuditReport(files.length, totalAttachments, issues);
	const reportText = generateAttachmentReport(report);

	// Create a modal or notice with the report
	new Notice(`Audit complete: ${report.summary.brokenLinks} broken links, ${report.summary.missingAttachments} missing, ${report.summary.misplaced} misplaced`);
	new Notice(reportText.substring(0, 200) + '...');
}

export default class UnifiedAttachmentManager extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new UnifiedAttachmentManagerSettingTab(this.app, this));

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
			},
		});

		this.addCommand({
			id: 'localize-remote-images-folder',
			name: 'Localize remote images in folder',
			callback: async () => {
				new Notice('Use the context menu on a folder to localize images in that folder');
			},
		});

		this.addCommand({
			id: 'localize-remote-images-vault',
			name: 'Localize remote images across vault',
			callback: () => {
				const root = this.app.vault.getAbstractFileByPath('/');
				if (root instanceof TFolder) {
					void saveImagesInFolder(this.app, root, this.settings.showProgress ?? true);
				} else {
					new Notice('Could not access vault root');
				}
			},
		});

		this.addCommand({
			id: 'audit-attachment-links',
			name: 'Audit attachment links',
			callback: () => {
				void auditAttachmentLinks(this.app);
			},
		});

		this.addCommand({
			id: 'preview-attachment-organization',
			name: 'Preview attachment organization',
			callback: () => {
				new Notice('Organization preview feature coming soon');
			},
		});

		this.addCommand({
			id: 'find-duplicate-attachments',
			name: 'Find duplicate attachments',
			callback: () => {
				new Notice('Duplicate detection coming soon');
			},
		});

		this.addCommand({
			id: 'review-unused-attachments',
			name: 'Review potentially unused attachments',
			callback: () => {
				new Notice('Orphan detection coming soon');
			},
		});

		this.addCommand({
			id: 'undo-last-operation',
			name: 'Undo last operation',
			callback: () => {
				new Notice('No operations to undo');
			},
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('Localize remote images in folder')
							.setIcon('image-down')
							.onClick(() => {
								void saveImagesInFolder(this.app, file, this.settings.showProgress ?? true);
							});
					});
				}
			}),
		);
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

	async loadSettings() {
		const data = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

		new Setting(containerEl).setName('Unified attachment manager').setHeading();

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
