import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	resolvePath,
	isExternalUrl,
	normalizeVaultPath,
	isAttachmentPath,
	isWithinVault,
	getRelativePath,
	formatLinkTarget,
	stripWikiLink,
	isUnicodeNormalized,
	normalizeUnicode,
	isPathTraversing,
	type PathResolverOptions,
} from '../../src/core/path-resolver';

// Create a mock vault
function createMockVault(files: Array<{ path: string }>): any {
	return {
		getMarkdownFiles: vi.fn(() => files),
	};
}

const defaultOptions: PathResolverOptions = {
	attachmentFolder: 'attachments',
	ignoreCase: false,
	ignoreExtensions: [],
};

describe('Path Resolver', () => {
	let vault: any;

	beforeEach(() => {
		vault = createMockVault([
			{ path: 'note.md' },
			{ path: 'attachments/image.png' },
			{ path: 'folder/note.md' },
			{ path: 'folder/image.png' },
			{ path: 'sub/folder/nested.md' },
			{ path: 'test folder/with spaces.md' },
		]);
	});

	describe('isExternalUrl', () => {
		it('should return true for http URLs', () => {
			expect(isExternalUrl('https://example.com/image.png')).toBe(true);
		});

		it('should return true for https URLs', () => {
			expect(isExternalUrl('http://example.com/image.png')).toBe(true);
		});

		it('should return false for relative paths', () => {
			expect(isExternalUrl('./relative/path')).toBe(false);
			expect(isExternalUrl('/absolute/path')).toBe(false);
			expect(isExternalUrl('attachment.png')).toBe(false);
		});

		it('should return false for empty strings', () => {
			expect(isExternalUrl('')).toBe(false);
		});
	});

	describe('normalizeVaultPath', () => {
		it('should normalize double slashes', () => {
			expect(normalizeVaultPath('a//b//c')).toBe('a/b/c');
		});

		it('should trim leading and trailing slashes', () => {
			expect(normalizeVaultPath('/a/b/')).toBe('a/b');
			expect(normalizeVaultPath('//a//b//')).toBe('a/b');
		});

		it('should handle empty strings', () => {
			expect(normalizeVaultPath('')).toBe('');
		});
	});

	describe('resolvePath', () => {
		it('should resolve exact internal path match', () => {
			const result = resolvePath('attachments/image.png', 'note.md', defaultOptions, vault);
			expect(result.resolvedPath).toBe('attachments/image.png');
			expect(result.missing).toBe(false);
			expect(result.isAmbiguous).toBe(false);
		});

		it('should resolve relative path from source note', () => {
			const result = resolvePath('image.png', 'folder/note.md', defaultOptions, vault);
			expect(result.resolvedPath).toBe('folder/image.png');
			expect(result.missing).toBe(false);
		});

		it('should resolve root-relative path', () => {
			const result = resolvePath('/attachments/image.png', 'note.md', defaultOptions, vault);
			expect(result.resolvedPath).toBe('attachments/image.png');
			expect(result.missing).toBe(false);
		});

		it('should return missing for non-existent file', () => {
			const result = resolvePath('nonexistent.png', 'note.md', defaultOptions, vault);
			expect(result.resolvedPath).toBe(null);
			expect(result.missing).toBe(true);
		});

		it('should report ambiguous matches', () => {
			// Both 'note.md' and 'folder/note.md' exist - but resolvePath only matches exact paths
			// Ambiguity would come from case-insensitive matches
			const result = resolvePath('note.md', 'folder/note.md', defaultOptions, vault);
			expect(result.missing).toBe(false);
		});

		it('should handle empty path', () => {
			const result = resolvePath('', 'note.md', defaultOptions, vault);
			expect(result.missing).toBe(true);
			expect(result.resolvedPath).toBe(null);
		});

		it('should handle empty source note path', () => {
			const result = resolvePath('attachments/image.png', '', defaultOptions, vault);
			expect(result.missing).toBe(true);
			expect(result.resolvedPath).toBe(null);
		});

		it('should handle root-relative vault paths', () => {
			const result = resolvePath('/attachments/image.png', 'folder/sub/note.md', defaultOptions, vault);
			expect(result.resolvedPath).toBe('attachments/image.png');
			expect(result.missing).toBe(false);
		});
	});

	describe('isAttachmentPath', () => {
		it('should return true for paths starting with attachment folder', () => {
			expect(isAttachmentPath('attachments/image.png', defaultOptions)).toBe(true);
		});

		it('should return false for other paths', () => {
			expect(isAttachmentPath('note.md', defaultOptions)).toBe(false);
		});
	});

	describe('isWithinVault', () => {
		it('should return true for paths inside vault root', () => {
			expect(isWithinVault('attachments/image.png', '/')).toBe(true);
			expect(isWithinVault('folder/note.md', '/')).toBe(true);
		});

		it('should handle root vault', () => {
			expect(isWithinVault('/attachments/image.png', '/')).toBe(true);
		});
	});

	describe('getRelativePath', () => {
		it('should return relative path from root', () => {
			expect(getRelativePath('attachments/image.png', '/')).toBe('attachments/image.png');
		});

		it('should return relative path from subfolder', () => {
			expect(getRelativePath('/attachments/image.png', '/')).toBe('attachments/image.png');
		});
	});

	describe('formatLinkTarget', () => {
		it('should wrap paths with spaces in angle brackets', () => {
			expect(formatLinkTarget('my image.png')).toBe('<my image.png>');
		});

		it('should wrap paths with parentheses', () => {
			expect(formatLinkTarget('image (1).png')).toBe('<image (1).png>');
		});

		it('should return clean paths unchanged', () => {
			expect(formatLinkTarget('image.png')).toBe('image.png');
		});

		it('should handle empty strings', () => {
			expect(formatLinkTarget('')).toBe('');
		});
	});

	describe('stripWikiLink', () => {
		it('should extract target from wikilink', () => {
			expect(stripWikiLink('[[image.png]]')).toBe('image.png');
		});

		it('should handle wikilink with alias', () => {
			expect(stripWikiLink('[[image.png|alt]]')).toBe('image.png');
		});

		it('should return plain links unchanged', () => {
			expect(stripWikiLink('image.png')).toBe('image.png');
		});
	});

	describe('isUnicodeNormalized', () => {
		it('should return true for NFC strings', () => {
			expect(isUnicodeNormalized('hello')).toBe(true);
		});

		it('should return false for NFD strings', () => {
			// 'e\u0301' is é in NFD form
			expect(isUnicodeNormalized('e\u0301')).toBe(false);
		});
	});

	describe('normalizeUnicode', () => {
		it('should normalize to NFC', () => {
			expect(normalizeUnicode('e\u0301')).toBe('é');
		});

		it('should leave NFC strings unchanged', () => {
			expect(normalizeUnicode('é')).toBe('é');
		});
	});

	describe('isPathTraversing', () => {
		it('should detect path traversal with ..', () => {
			expect(isPathTraversing('../../etc/passwd')).toBe(true);
		});

		it('should return false for safe paths', () => {
			expect(isPathTraversing('attachments/image.png')).toBe(false);
		});

		it('should detect traversal in subpaths', () => {
			expect(isPathTraversing('folder/../../etc/passwd')).toBe(true);
		});
	});
});
