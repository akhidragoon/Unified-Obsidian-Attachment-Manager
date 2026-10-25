import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, requestUrl, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS } from './settings/settings';
import type { PluginSettings } from './settings/settings';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif', '.avif'];

const IMAGE_PATTERNS = [
	/!\[[^\]]*]\(\s*(https?:\/\/[^)\s]+)/g,
	/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi,
	/<img\b[^>]*\bsrc\s*=\s*'([^']+)'/gi,
	/!\[\[(https?:\/\/[^\]]+)]]/g,
];

const FRONTMATTER_IMAGE_PATTERN = /^[a-zA-Z_-]+:\s*(https?:\/\/\S+)/gm;

function isImageUrl(url: string): boolean {
	try {
		const cleanUrl = url.split('?')[0] || url;
		const lower = cleanUrl.toLowerCase();
		return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
	} catch {
		return false;
	}
}

function getFileExtension(url: string): string {
	try {
		const cleanUrl = url.split('?')[0] || url;
		const lower = cleanUrl.toLowerCase();
		if (lower.includes('jpeg') || lower.endsWith('.jpg')) return 'jpg';
		if (lower.endsWith('.png')) return 'png';
		if (lower.endsWith('.gif')) return 'gif';
		if (lower.endsWith('.bmp')) return 'bmp';
		if (lower.endsWith('.svg')) return 'svg';
		if (lower.endsWith('.webp')) return 'webp';
		if (lower.endsWith('.ico')) return 'ico';
		if (lower.endsWith('.tiff') || lower.endsWith('.tif')) return 'tif';
		if (lower.endsWith('.avif')) return 'avif';
		return 'png';
	} catch {
		return 'png';
	}
}

function randomString(length: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatLinkTarget(path: string): string {
	if (!path) return path;
	if (/[\s()<>]/.test(path)) {
		return `<${path}>`;
	}
	return path;
}

function unwrapLinkedImages(content: string): string {
	const linkedImagePattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)"]+)(?:\s+"[^"]*")?\s*\)/g;
	return content.replace(linkedImagePattern, (match, alt, imgUrl, linkUrl) => {
		if (imgUrl === linkUrl && imgUrl.startsWith('http')) {
			return `![${alt}](${imgUrl})`;
		}
		return match;
	});
}

async function ensureFolderExists(vault: any, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	const existing = (vault as any).getAbstractFileByPath?.(normalized);
	if (existing) return;
	const parts = normalized.split('/').filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const exists = (vault as any).getAbstractFileByPath?.(current);
		if (!exists) {
			await (vault as any).createFolder?.(current);
		}
	}
}

function getAttachmentFolder(vault: any, file: TFile, settings: PluginSettings): string {
	const config = (vault as any).config || {};
	const configPath = config?.attachmentFolderPath as string | undefined;
	const fileDir = file.parent?.path || '';
	const noteBase = file.basename;

	if (!configPath || configPath === '/') {
		return fileDir || '';
	}
	if (configPath === './') {
		return fileDir ? `${fileDir}/${noteBase}` : noteBase;
	}
	if (configPath.startsWith('./')) {
		const sub = configPath.substring(2);
		if (fileDir) {
			return `${fileDir}/${sub}`;
		}
		return sub;
	}
	if (fileDir) {
		return `${fileDir}/${noteBase}`;
	}
	return noteBase;
}

function findRemoteImages(content: string): Set<string> {
	const urls = new Set<string>();

	for (const pattern of IMAGE_PATTERNS) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const url = String(match[1] ?? '').trim();
			if (url && url.startsWith('http') && isImageUrl(url)) {
				urls.add(url);
			}
		}
	}

	const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (frontmatterMatch) {
		const fm = frontmatterMatch[1] ?? '';
		FRONTMATTER_IMAGE_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = FRONTMATTER_IMAGE_PATTERN.exec(fm)) !== null) {
			const url = String(match[1] ?? '').trim();
			if (url && url.startsWith('http') && isImageUrl(url)) {
				urls.add(url);
			}
		}
	}

	return urls;
}

async function saveRemoteImages(app: App, file: TFile, showNotice: boolean, attachmentFolder: string): Promise<void> {
	try {
		const content = await app.vault.read(file);
		const urls = findRemoteImages(content);
		
		if (urls.size === 0) {
			if (showNotice) {
				new Notice('No remote images found in this note.');
			}
			return;
		}

		if (attachmentFolder) {
			await ensureFolderExists(app.vault, attachmentFolder);
		}

		if (showNotice) {
			new Notice(`Found ${urls.size} remote image(s). Downloading...`);
		}

		const urlToPath = new Map<string, string>();
		let saved = 0;
		let failed = 0;

		for (const url of urls) {
			try {
				const response = await requestUrl({ url });
				const arrayBuffer = response.arrayBuffer;
				const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
				
				let ext = getFileExtension(url);
				if (contentType.includes('image/')) {
					if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
					else if (contentType.includes('png')) ext = 'png';
					else if (contentType.includes('gif')) ext = 'gif';
					else if (contentType.includes('webp')) ext = 'webp';
					else if (contentType.includes('svg')) ext = 'svg';
					else if (contentType.includes('bmp')) ext = 'bmp';
				}

				const fileName = `${randomString(12)}.${ext}`;
				const savePath = (attachmentFolder ? normalizePath(`${attachmentFolder}/${fileName}`) : normalizePath(fileName)) || fileName;
				
				await app.vault.createBinary(savePath, arrayBuffer);
				urlToPath.set(url, savePath);
				saved++;
			} catch (err) {
				failed++;
				console.error('Failed to download image:', url, err);
			}
		}

		let newContent = content;
		for (const [url, localPath] of urlToPath) {
			const formatted = formatLinkTarget(localPath);
			const regex = new RegExp(escapeRegex(url), 'g');
			newContent = newContent.replace(regex, formatted);
		}

		newContent = unwrapLinkedImages(newContent);

		if (newContent !== content) {
			await app.vault.modify(file, newContent);
		}

		if (showNotice) {
			if (failed > 0) {
				new Notice(`Saved ${saved}/${urls.size} images. ${failed} failed.`);
			} else {
				new Notice(`All ${saved} images saved locally.`);
			}
		}
	} catch (err) {
		console.error('Error localizing images:', err);
		if (showNotice) {
			new Notice(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}
}

function collectMarkdownFiles(folder: any): TFile[] {
	const files: TFile[] = [];
	const walk = (f: any) => {
		const children = f.children;
		if (Array.isArray(children)) {
			for (const child of children) {
				if (child instanceof TFile && child.extension === 'md') {
					files.push(child);
				} else if (child && typeof child === 'object' && 'children' in child) {
					walk(child);
				}
			}
		}
	};
	walk(folder);
	return files;
}

async function saveImagesInFolder(app: App, folder: any, showNotice: boolean, settings: PluginSettings): Promise<void> {
	const files = collectMarkdownFiles(folder);
	if (files.length === 0) {
		if (showNotice) new Notice('No Markdown notes found in this folder.');
		return;
	}

	if (showNotice) new Notice(`Scanning ${files.length} note(s) for remote images...`);

	let notesProcessed = 0;
	let totalSaved = 0;
	let totalFailed = 0;
	const errors: string[] = [];

	for (const file of files) {
		try {
			const content = await app.vault.read(file);
			const urls = findRemoteImages(content);

			if (urls.size === 0) continue;

			const attachmentFolder = getAttachmentFolder(app.vault, file, settings);
			if (attachmentFolder) {
				await ensureFolderExists(app.vault, attachmentFolder);
			}

			const urlToPath = new Map<string, string>();
			let saved = 0;
			let failed = 0;

			for (const url of urls) {
				try {
					const response = await requestUrl({ url });
					const arrayBuffer = response.arrayBuffer;
					const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';

					let ext = getFileExtension(url);
					if (contentType.includes('image/')) {
						if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
						else if (contentType.includes('png')) ext = 'png';
						else if (contentType.includes('gif')) ext = 'gif';
						else if (contentType.includes('webp')) ext = 'webp';
						else if (contentType.includes('svg')) ext = 'svg';
						else if (contentType.includes('bmp')) ext = 'bmp';
					}

					const fileName = `${randomString(12)}.${ext}`;
					const savePath = (attachmentFolder ? normalizePath(`${attachmentFolder}/${fileName}`) : normalizePath(fileName)) || fileName;

					await app.vault.createBinary(savePath, arrayBuffer);
					urlToPath.set(url, savePath);
					saved++;
				} catch (err) {
					failed++;
					console.error('Failed to download image:', url, err);
				}
			}

			let newContent = content;
			for (const [url, localPath] of urlToPath) {
				const formatted = formatLinkTarget(localPath);
				const regex = new RegExp(escapeRegex(url), 'g');
				newContent = newContent.replace(regex, formatted);
			}

			newContent = unwrapLinkedImages(newContent);

			if (newContent !== content) {
				await app.vault.modify(file, newContent);
			}

			notesProcessed++;
			totalSaved += saved;
			totalFailed += failed;
		} catch (err) {
			errors.push(`${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	if (showNotice) {
		const failedStr = totalFailed > 0 ? `, ${totalFailed} failed` : '';
		new Notice(`${files.length} note(s) scanned, ${notesProcessed} had images, ${totalSaved} image(s) saved${failedStr}`, 8000);
	}
	if (errors.length > 0) {
		console.error('Save remote images errors:\n' + errors.join('\n'));
	}
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
				if (!file || file.extension !== 'md') return false;
				if (!checking) {
					const attachmentFolder = getAttachmentFolder(this.app.vault, file, this.settings);
					saveRemoteImages(this.app, file, this.settings.showProgress ?? true, attachmentFolder);
				}
				return true;
			},
		});

		this.addCommand({
			id: 'localize-remote-images-folder',
			name: 'Localize remote images in folder',
			callback: async () => {
				new Notice('Use the context menu on a folder, or select a folder and run this command');
			},
		});

		this.addCommand({
			id: 'localize-remote-images-vault',
			name: 'Localize remote images across vault',
			callback: () => {
				new Notice('Vault-wide processing requires confirmation');
			},
		});

		this.addCommand({
			id: 'audit-attachment-links',
			name: 'Audit attachment links',
			callback: () => {
				new Notice('Audit feature coming soon');
			},
		});

		this.addCommand({
			id: 'preview-attachment-organization',
			name: 'Preview attachment organization',
			callback: () => {
				new Notice('Organization preview coming soon');
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
								void 						void saveImagesInFolder(this.app, file, this.settings.showProgress ?? true, this.settings);
							});
					});
				}
			}),
		);
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) } as PluginSettings;
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
