/**
 * Image downloader service.
 *
 * Handles downloading remote images from markdown notes and replacing references
 * with local file paths.
 */

import { App, Notice, TFile, TFolder, Vault, requestUrl, normalizePath } from 'obsidian';
import { type PluginSettings } from '../settings/settings';
import { RollbackManager } from './rollback-manager';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif', '.avif'];

const IMAGE_PATTERNS = [
	/!\[[^\]]*]\(\s*(https?:\/\/[^)\s]+)/g,
	/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi,
	/<img\b[^>]*\bsrc\s*=\s*'([^']+)'/gi,
	/!\[\[(https?:\/\/[^\]]+)]]/g,
	/]\(\s*(https?:\/\/[^)\s]+)/g,
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

export async function downloadAndReplaceImages(
	app: App,
	file: TFile,
	showNotice: boolean,
	rollbackManager?: RollbackManager | null
): Promise<DownloadResult> {
	const content = await app.vault.read(file);
	const urls = findRemoteImageUrls(content);

	const result: DownloadResult = {
		total: urls.length,
		saved: 0,
		failed: 0,
		errors: []
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
			rollbackManager?.recordCreateBinary(filePath, `Download image: ${url}`);
		} catch (e: unknown) {
			result.failed++;
			const msg = e instanceof Error ? e.message : 'Unknown error';
			result.errors.push(`${url}: ${msg}`);
		}
	}

	let updatedContent = content;
	for (const [url, localPath] of urlToLocal) {
		const formatted = formatMarkdownLinkTarget(localPath);
		const escapedUrl = escapeForRegex(url);

		// Replace markdown image: ![alt](url) -> ![alt](local)
		const mdImageRe = new RegExp(
			'!\\[([^\\]]*)\\]\\(' + escapedUrl + '\\)',
			'g'
		);
		updatedContent = updatedContent.replace(mdImageRe, `![$1](${formatted})`);

		// Replace markdown link: [text](url) -> [text](local)
		const mdLinkRe = new RegExp(
			'\\[([^\\]]*)\\]\\(' + escapedUrl + '\\)',
			'g'
		);
		updatedContent = updatedContent.replace(mdLinkRe, `[$1](${formatted})`);

		// Replace HTML img: <img src="url"> -> <img src="local">
		const htmlImgRe = new RegExp(
			'(<img\\b[^>]*\\bsrc\\s*=\\s*[\'"])' + escapedUrl + '([\'"])',
			'gi'
		);
		updatedContent = updatedContent.replace(htmlImgRe, `$1${formatted}$2`);

		// Replace wiki embed: ![[url]] -> ![[local]]
		const wikiRe = new RegExp(
			'!\\[\\[' + escapedUrl + '\\]\\]',
			'g'
		);
		updatedContent = updatedContent.replace(wikiRe, `![[${formatted}]]`);
	}

	updatedContent = collapseLinkedImages(updatedContent);

	if (updatedContent !== content) {
		await app.vault.modify(file, updatedContent);
		rollbackManager?.recordModify(file.path, content, `Localize remote images in: ${file.name}`);
	}

	if (showNotice) {
		if (result.failed > 0) {
			new Notice(`Saved ${result.saved}/${result.total} images. ${result.failed} failed.`);
		} else {
			new Notice(`All ${result.saved} images saved locally.`);
		}
	}

	return result;
}

export function collectMarkdownFiles(folder: TFolder): TFile[] {
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

export async function saveImagesInFolder(
	app: App,
	folder: TFolder,
	showNotice: boolean,
	settings: PluginSettings,
	rollbackManager?: RollbackManager | null
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
			const content = await app.vault.read(file);
			const urls = findRemoteImageUrls(content);

			if (urls.length === 0) continue;

			const attachmentFolder = buildAttachmentFolder(app, file);
			await ensureFolder(app.vault, attachmentFolder);

			const urlToLocal = new Map<string, string>();
			let saved = 0;
			let failed = 0;

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
					saved++;
					rollbackManager?.recordCreateBinary(filePath, `Download image: ${url}`);
				} catch (e: unknown) {
					failed++;
					const msg = e instanceof Error ? e.message : 'Unknown error';
					errors.push(`${file.path}: ${url}: ${msg}`);
				}
			}

			let updatedContent = content;
			for (const [url, localPath] of urlToLocal) {
				const formatted = formatMarkdownLinkTarget(localPath);
				const escapedUrl = escapeForRegex(url);

				// Replace markdown image: ![alt](url) -> ![alt](local)
				const mdImageRe = new RegExp(
					'!\\[([^\\]]*)\\]\\(' + escapedUrl + '\\)',
					'g'
				);
				updatedContent = updatedContent.replace(mdImageRe, `![$1](${formatted})`);

				// Replace markdown link: [text](url) -> [text](local)
				const mdLinkRe = new RegExp(
					'\\[([^\\]]*)\\]\\(' + escapedUrl + '\\)',
					'g'
				);
				updatedContent = updatedContent.replace(mdLinkRe, `[$1](${formatted})`);

				// Replace HTML img: <img src="url"> -> <img src="local">
				const htmlImgRe = new RegExp(
					'(<img\\b[^>]*\\bsrc\\s*=\\s*[\'"])' + escapedUrl + '([\'"])',
					'gi'
				);
				updatedContent = updatedContent.replace(htmlImgRe, `$1${formatted}$2`);

				// Replace wiki embed: ![[url]] -> ![[local]]
				const wikiRe = new RegExp(
					'!\\[\\[' + escapedUrl + '\\]\\]',
					'g'
				);
				updatedContent = updatedContent.replace(wikiRe, `![[${formatted}]]`);
			}

			updatedContent = collapseLinkedImages(updatedContent);

			if (updatedContent !== content) {
				await app.vault.modify(file, updatedContent);
				rollbackManager?.recordModify(file.path, content, `Localize remote images in: ${file.name}`);
			}

			notesWithImages++;
			totalSaved += saved;
			totalFailed += failed;
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
		console.error('Save remote images errors:\n' + errors.join('\n'));
	}
}
