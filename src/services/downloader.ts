export interface DownloadOptions {
	timeout?: number;
	maxSize?: number;
	userAgent?: string;
	validateContentType?: boolean;
}

export interface DownloadResult {
	success: boolean;
	data?: ArrayBuffer;
	contentType?: string;
	size?: number;
	error?: string;
}

export interface DownloadProgress {
	loaded: number;
	total?: number;
}

export function isExternalImageUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return false;
		}
		const ext = parsed.pathname.toLowerCase().split('.').pop();
		return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext || '');
	} catch {
		return false;
	}
}

export function getFilenameFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname;
		const parts = pathname.split('/').filter(Boolean);
		const last = parts[parts.length - 1];
		if (last && last.includes('.')) {
			return last;
		}
		return 'image.png';
	} catch {
		return 'image.png';
	}
}

export function sanitizeUrlFilename(filename: string): string {
	return filename
		.replace(/[<>:"/\\|?*]/g, '_')
		.replace(/^\.+/, '')
		.replace(/\.+$/, '')
		.replace(/_{2,}/g, '_')
		.trim() || 'image.png';
}

export function generateUniqueFilename(
	baseName: string,
	existingPaths: Set<string>,
): string {
	if (!existingPaths.has(baseName)) {
		return baseName;
	}

	const lastDot = baseName.lastIndexOf('.');
	let name: string;
	let ext: string;

	if (lastDot > 0) {
		name = baseName.substring(0, lastDot);
		ext = baseName.substring(lastDot);
	} else {
		name = baseName;
		ext = '';
	}

	let counter = 1;
	let candidate: string;
	do {
		candidate = `${name}_${counter}${ext}`;
		counter++;
	} while (existingPaths.has(candidate));

	return candidate;
}

export async function downloadImage(
	url: string,
	options: DownloadOptions = {},
): Promise<DownloadResult> {
	const timeout = options.timeout || 30000;
	const maxSize = options.maxSize || 10 * 1024 * 1024;

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': options.userAgent || 'Obsidian-Plugin',
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
		}

		const contentType = response.headers.get('content-type') || undefined;
		if (options.validateContentType && contentType && !contentType.startsWith('image/')) {
			return { success: false, error: `Invalid content type: ${contentType}` };
		}

		const buffer = await response.arrayBuffer();

		if (buffer.byteLength > maxSize) {
			return { success: false, error: `File too large: ${buffer.byteLength} bytes` };
		}

		return {
			success: true,
			data: buffer,
			contentType,
			size: buffer.byteLength,
		};
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: String(err) };
	}
}

export function isValidImageUrl(url: string): boolean {
	return isExternalImageUrl(url);
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return { valid: false, error: 'Only HTTP(S) URLs are supported' };
		}
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL' };
	}
}

export function createDownloadPlan(
	urls: string[],
	targetFolder: string,
	existingPaths: Set<string>,
): Array<{ url: string; filename: string; targetPath: string }> {
	return urls.map(url => {
		const baseName = sanitizeUrlFilename(getFilenameFromUrl(url));
		const filename = generateUniqueFilename(baseName, existingPaths);
		existingPaths.add(filename);
		return {
			url,
			filename,
			targetPath: targetFolder ? `${targetFolder}/${filename}` : filename,
		};
	});
}