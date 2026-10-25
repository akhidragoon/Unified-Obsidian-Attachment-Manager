import { normalizePath, Vault } from 'obsidian';

export enum ReferenceType {
	InternalWikilink = 'InternalWikilink',
	InternalLink = 'InternalLink',
	InternalImage = 'InternalImage',
	InternalWikiImage = 'InternalWikiImage',
	ExternalUrl = 'ExternalUrl',
	ExternalImage = 'ExternalImage',
	HtmlImage = 'HtmlImage',
	Frontmatter = 'Frontmatter',
	Unknown = 'Unknown',
}

export interface ResolvedPath {
	resolvedPath: string | null;
	isAmbiguous: boolean;
	candidates: string[];
	missing: boolean;
}

export interface PathResolverOptions {
	attachmentFolder: string;
	ignoreCase: boolean;
	ignoreExtensions: string[];
}

export interface ReferenceSpan {
	type: ReferenceType;
	link: string;
	start: number;
	end: number;
	originalLine?: number;
}

const httpPattern = /^https?:\/\//i;

export function isExternalUrl(link: string): boolean {
	return httpPattern.test(link);
}

export function normalizeVaultPath(path: string): string {
	if (!path) return path;
	return normalizePath(path).replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

export function isPathAmbiguous(path: string, vault: Vault): boolean {
	const normalized = normalizeVaultPath(path);
	const candidates: string[] = [];
	
	vault.getMarkdownFiles().forEach((file) => {
		const filePath = file.path;
		if (filePath === normalized || filePath.toLowerCase() === normalized.toLowerCase()) {
			candidates.push(filePath);
		}
	});
	
	return candidates.length > 1;
}

export function getCandidatesForPath(path: string, vault: Vault): string[] {
	const normalized = normalizeVaultPath(path);
	const candidates: string[] = [];
	
	vault.getMarkdownFiles().forEach((file) => {
		const filePath = file.path;
		if (filePath === normalized) {
			candidates.push(filePath);
		}
	});
	
	return candidates;
}

export function resolvePath(
	path: string,
	sourceNotePath: string,
	options: PathResolverOptions,
	vault: Vault,
): ResolvedPath {
	if (!path || !sourceNotePath) {
		return {
			resolvedPath: null,
			isAmbiguous: false,
			candidates: [],
			missing: true,
		};
	}
	
	const isRootRelative = path.startsWith('/');
	const normalizedPath = normalizeVaultPath(path);
	
	let fullPath: string;
	if (isRootRelative) {
		fullPath = normalizedPath;
	} else {
		const sourceDir = sourceNotePath.substring(0, sourceNotePath.lastIndexOf('/'));

		fullPath = sourceDir ? `${sourceDir}/${normalizedPath}` : normalizedPath;
	}
	
	const candidates = getCandidatesForPath(fullPath, vault);
	
	if (candidates.length === 1) {
		return {
			resolvedPath: candidates[0]!,
			isAmbiguous: false,
			candidates: [],
			missing: false,
		};
	}
	
	if (candidates.length > 1) {
		return {
			resolvedPath: candidates[0]!,
			isAmbiguous: true,
			candidates,
			missing: false,
		};
	}
	
	return {
		resolvedPath: null,
		isAmbiguous: false,
		candidates: [],
		missing: true,
	};
}

export function decodeUrl(url: string): string {
	try {
		return decodeURIComponent(url);
	} catch {
		return url;
	}
}

export function encodeUrl(url: string): string {
	try {
		return encodeURIComponent(url);
	} catch {
		return url;
	}
}

export function isAttachmentPath(path: string, options: PathResolverOptions): boolean {
	const normalized = normalizeVaultPath(path);
	return normalized.startsWith(options.attachmentFolder);
}

export function isWithinVault(path: string, vaultRoot: string): boolean {
	const normalizedPath = normalizeVaultPath(path);
	const normalizedRoot = normalizeVaultPath(vaultRoot);
	return normalizedPath.startsWith(normalizedRoot) || normalizedPath === normalizedRoot;
}

export function getRelativePath(absPath: string, vaultRoot: string): string {
	const normalizedPath = normalizeVaultPath(absPath);
	const normalizedRoot = normalizeVaultPath(vaultRoot);
	
	if (normalizedPath.startsWith(normalizedRoot)) {
		const relative = normalizedPath.slice(normalizedRoot.length);
		return relative.startsWith('/') ? relative.slice(1) : relative;
	}
	
	return normalizedPath;
}

export function formatLinkTarget(target: string): string {
	if (!target) return target;
	if (/[\s()<>]/.test(target)) {
		return `<${target}>`;
	}
	return target;
}

export function stripWikiLink(link: string): string {
	const wikilinkMatch = link.match(/^\[\[([^\]|]+)/);
	if (wikilinkMatch) {
		return wikilinkMatch[1] ?? link;
	}
	return link;
}

export function isUnicodeNormalized(str: string): boolean {
	return str === str.normalize('NFC');
}

export function normalizeUnicode(str: string): string {
	return str.normalize('NFC');
}

export function isPathTraversing(path: string): boolean {
	const normalized = normalizeVaultPath(path);
	const parts = normalized.split('/');
	return parts.some((part) => part === '..');
}