import { describe, it, expect } from 'vitest';
import {
	scanReferences,
	getExternalImageUrls,
	filterOutCodeBlockReferences,
	deduplicateUrls,
	getUniqueExternalUrls,
	isCodeBlock,
	isInlineCode,
	isCodeOrInlineCode,
	ReferenceType,
} from '../../src/core/reference-scanner';

describe('Reference Scanner', () => {
	describe('markdown images', () => {
		it('should scan markdown images', () => {
			const result = scanReferences('![alt](image.png)');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.InternalImage);
			expect(result.references[0]!.link).toBe('image.png');
		});

		it('should scan markdown images with special characters in alt text', () => {
			const result = scanReferences('![alt-text](image.png)');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.link).toBe('image.png');
		});

		it('should scan markdown images with titles', () => {
			const result = scanReferences('![alt](image.png "title")');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.InternalImage);
		});

		it('should detect external markdown images', () => {
			const result = scanReferences('![alt](https://example.com/image.png)');
			expect(result.references[0]!.type).toBe(ReferenceType.ExternalImage);
			expect(result.externalUrls).toContain('https://example.com/image.png');
		});
	});

	describe('markdown links', () => {
		it('should scan markdown links', () => {
			const result = scanReferences('[link text](page.md)');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.InternalLink);
			expect(result.references[0]!.link).toBe('page.md');
		});

		it('should detect external markdown links', () => {
			const result = scanReferences('[link](https://example.com/page)');
			expect(result.references[0]!.type).toBe(ReferenceType.ExternalUrl);
			expect(result.externalUrls).toContain('https://example.com/page');
		});
	});

	describe('wiki embeds', () => {
		it('should scan wiki embeds', () => {
			const result = scanReferences('![[image.png]]');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.InternalWikiImage);
			expect(result.references[0]!.link).toBe('image.png');
		});

		it('should scan wiki embeds with aliases', () => {
			const result = scanReferences('![[image.png|alias]]');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.link).toBe('image.png|alias');
		});

		it('should detect external wiki embeds', () => {
			const result = scanReferences('![[https://example.com/image.png]]');
			expect(result.references[0]!.type).toBe(ReferenceType.ExternalImage);
		});
	});

	describe('wiki links', () => {
		it('should scan wiki links', () => {
			const result = scanReferences('[[page]]');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.InternalWikilink);
			expect(result.references[0]!.link).toBe('page');
		});

		it('should scan wiki links with aliases', () => {
			const result = scanReferences('[[page|alias]]');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.link).toBe('page|alias');
		});

		it('should detect external wiki links', () => {
			const result = scanReferences('[[https://example.com/page]]');
			expect(result.references[0]!.type).toBe(ReferenceType.ExternalUrl);
		});
	});

	describe('HTML images', () => {
		it('should scan HTML images', () => {
			const result = scanReferences('<img src="image.png" alt="test">');
			expect(result.references).toHaveLength(1);
			expect(result.references[0]!.type).toBe(ReferenceType.HtmlImage);
			expect(result.references[0]!.link).toBe('image.png');
		});

		it('should detect external HTML images', () => {
			const result = scanReferences('<img src="https://example.com/image.png">');
			expect(result.references[0]!.type).toBe(ReferenceType.ExternalImage);
			expect(result.externalUrls).toContain('https://example.com/image.png');
		});
	});

	describe('frontmatter', () => {
		it('should detect frontmatter URLs', () => {
			const content = '---\nsource: https://example.com/article\n---\ncontent';
			const result = scanReferences(content);
			expect(result.references.some(r => r.type === ReferenceType.Frontmatter)).toBe(true);
			expect(result.externalUrls).toContain('https://example.com/article');
		});

		it('should not match non-URL frontmatter fields', () => {
			const content = '---\ntitle: My Note\ntags: [a, b]\n---\ncontent';
			const result = scanReferences(content);
			expect(result.references).toHaveLength(0);
		});

		it('should handle empty frontmatter', () => {
			const content = '---\n---\ncontent';
			const result = scanReferences(content);
			expect(result.references).toHaveLength(0);
		});
	});

	describe('code block filtering', () => {
		it('should filter out references in code blocks', () => {
			const content = '![[image.png]]\n\n```\n![[codeblock.png]]\n```\n';
			const allRefs = scanReferences(content).references;
			const filtered = filterOutCodeBlockReferences(allRefs, content);
			expect(filtered).toHaveLength(1);
			expect(filtered[0]!.link).toBe('image.png');
		});

		it('should not filter references outside code blocks', () => {
			const content = '![[image.png]]\n\n# Heading\n![[image2.png]]';
			const allRefs = scanReferences(content).references;
			const filtered = filterOutCodeBlockReferences(allRefs, content);
			expect(filtered).toHaveLength(2);
		});

		it('should filter inline code references', () => {
			const content = 'See `![[inline.png]]` for details.';
			const allRefs = scanReferences(content).references;
			const filtered = filterOutCodeBlockReferences(allRefs, content);
			expect(filtered).toHaveLength(0);
		});
	});

	describe('deduplication', () => {
		it('should deduplicate URLs', () => {
			const result = deduplicateUrls(['a.png', 'b.png', 'a.png', 'c.png', 'b.png']);
			expect(result).toHaveLength(3);
			expect(result).toContain('a.png');
			expect(result).toContain('b.png');
			expect(result).toContain('c.png');
		});

		it('should handle empty array', () => {
			expect(deduplicateUrls([])).toEqual([]);
		});
	});

	describe('getUniqueExternalUrls', () => {
		it('should extract unique external URLs from references', () => {
			const refs = [
				{ type: ReferenceType.ExternalUrl, link: 'https://a.com', start: 0, end: 12 },
				{ type: ReferenceType.ExternalUrl, link: 'https://a.com', start: 13, end: 25 },
				{ type: ReferenceType.InternalLink, link: 'page.md', start: 26, end: 32 },
				{ type: ReferenceType.ExternalImage, link: 'https://b.com/img.png', start: 33, end: 50 },
			];
			const result = getUniqueExternalUrls(refs);
			expect(result).toHaveLength(2);
			expect(result).toContain('https://a.com');
			expect(result).toContain('https://b.com/img.png');
		});

		it('should return empty array when no external URLs', () => {
			const refs = [
				{ type: ReferenceType.InternalLink, link: 'page.md', start: 0, end: 6 },
			];
			expect(getUniqueExternalUrls(refs)).toEqual([]);
		});
	});

	describe('code block detection', () => {
		it('should detect position in fenced code block', () => {
			const content = 'text\n```\ncode here\n```\nmore text';
			expect(isCodeBlock(content, 0)).toBe(false);
			expect(isCodeBlock(content, 15)).toBe(true); // inside "code here"
			expect(isCodeBlock(content, 23)).toBe(false); // after closing fence
		});

		it('should handle no code blocks', () => {
			const content = 'just some text';
			expect(isCodeBlock(content, 5)).toBe(false);
		});

		it('should detect inline code positions', () => {
			const content = 'text `code` more';
			expect(isInlineCode(content, 6)).toBe(true);  // inside "code"
			expect(isInlineCode(content, 5)).toBe(false); // opening backtick
			expect(isInlineCode(content, 10)).toBe(false); // closing backtick
		});

		it('should return false for inline code without closing backtick', () => {
			const content = 'text `code';
			expect(isInlineCode(content, 6)).toBe(false);
		});
	});

	describe('getExternalImageUrls', () => {
		it('should return unique external image URLs', () => {
			const content = '![a](https://example.com/img1.png)\n![b](https://example.com/img1.png)\n![c](https://example.com/img2.png)';
			const result = getExternalImageUrls(content);
			expect(result).toHaveLength(2);
			expect(result).toContain('https://example.com/img1.png');
			expect(result).toContain('https://example.com/img2.png');
		});

		it('should return empty array for no external images', () => {
			const result = getExternalImageUrls('![alt](image.png)');
			expect(result).toEqual([]);
		});
	});
});