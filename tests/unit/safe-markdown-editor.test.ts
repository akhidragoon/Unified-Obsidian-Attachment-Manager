import { describe, it, expect } from 'vitest';
import {
	applyEdits,
	applyReferenceEdits,
	replaceLinkTarget,
	replaceWikiLinkTarget,
	replaceHtmlImageSrc,
	replaceFrontmatterUrl,
	replaceAll,
	isCodeOrInlineCode,
	ReferenceType,
} from '../../src/core/safe-markdown-editor';
import { ReferenceSpan } from '../../src/core/path-resolver';

describe('Safe Markdown Editor', () => {
	describe('applyEdits', () => {
		it('should return unchanged content with no edits', () => {
			const result = applyEdits('hello world', []);
			expect(result.changed).toBe(false);
			expect(result.content).toBe('hello world');
		});

		it('should apply single edit', () => {
			const result = applyEdits('hello world', [{ start: 0, end: 5, replacement: 'goodbye' }]);
			expect(result.content).toBe('goodbye world');
			expect(result.changed).toBe(true);
		});

		it('should apply multiple edits in order', () => {
			const content = 'aaaa';
			const result = applyEdits(content, [
				{ start: 0, end: 2, replacement: 'XX' },
				{ start: 2, end: 4, replacement: 'YY' },
			]);
			expect(result.content).toBe('XXYY');
		});

		it('should handle overlapping edits by skipping', () => {
			const content = 'aaaa';
			const result = applyEdits(content, [
				{ start: 0, end: 3, replacement: 'X' },
				{ start: 1, end: 2, replacement: 'Y' },
			]);
			expect(result.content).toBe('Xa');
		});
	});

	describe('applyReferenceEdits', () => {
		it('should replace link target for given reference', () => {
			const content = '![[image.png]]';
			const refs: Array<ReferenceSpan> = [
				{ type: ReferenceType.InternalWikiImage, link: 'image.png', start: 0, end: 15 },
			];
			const mapping = new Map<string, string>([['image.png', 'new-image.png']]);
			const result = applyReferenceEdits(content, refs, mapping);
			expect(result.changed).toBe(true);
			expect(result.content).toBe('![[new-image.png]]');
		});

		it('should skip when mapping has same value', () => {
			const content = '![[image.png]]';
			const refs: Array<ReferenceSpan> = [
				{ type: ReferenceType.InternalWikiImage, link: 'image.png', start: 0, end: 15 },
			];
			const mapping = new Map<string, string>([['image.png', 'image.png']]);
			const result = applyReferenceEdits(content, refs, mapping);
			expect(result.changed).toBe(false);
			expect(result.content).toBe('![[image.png]]');
		});

		it('should filter out code block references', () => {
			const content = '```\n![[code.png]]\n```';
			const refs: Array<ReferenceSpan> = [
				{ type: ReferenceType.InternalWikiImage, link: 'code.png', start: 3, end: 13 },
			];
			const mapping = new Map<string, string>([['code.png', 'new-code.png']]);
			const result = applyReferenceEdits(content, refs, mapping);
			expect(result.changed).toBe(false);
			expect(result.content).toBe(content);
		});
	});

	describe('replaceLinkTarget', () => {
		it('should replace markdown link target', () => {
			const content = '[text](old.png)';
			const result = replaceLinkTarget(content, 'old.png', 'new.png');
			expect(result.content).toBe('[text](new.png)');
			expect(result.changed).toBe(true);
		});

		it('should not replace when old and new are same', () => {
			const content = '[text](old.png)';
			const result = replaceLinkTarget(content, 'old.png', 'old.png');
			expect(result.changed).toBe(false);
			expect(result.content).toBe('[text](old.png)');
		});

		it('should skip code blocks', () => {
			const content = '```\n[text](old.png)\n```';
			const result = replaceLinkTarget(content, 'old.png', 'new.png');
			expect(result.changed).toBe(false);
			expect(result.content).toBe(content);
		});
	});

	describe('replaceWikiLinkTarget', () => {
		it('should replace wiki link target', () => {
			const content = '![[old.png]]';
			const result = replaceWikiLinkTarget(content, 'old.png', 'new.png');
			expect(result.content).toBe('![[new.png]]');
			expect(result.changed).toBe(true);
		});

		it('should skip code blocks', () => {
			const content = '```\n![[old.png]]\n```';
			const result = replaceWikiLinkTarget(content, 'old.png', 'new.png');
			expect(result.changed).toBe(false);
			expect(result.content).toBe(content);
		});
	});

	describe('replaceHtmlImageSrc', () => {
		it('should replace HTML image src', () => {
			const content = '<img src="old.png" alt="test">';
			const result = replaceHtmlImageSrc(content, 'old.png', 'new.png');
			expect(result.content).toContain('src="new.png"');
			expect(result.changed).toBe(true);
		});

		it('should skip code blocks', () => {
			const content = '```\n<img src="old.png">\n```';
			const result = replaceHtmlImageSrc(content, 'old.png', 'new.png');
			expect(result.changed).toBe(false);
			expect(result.content).toBe(content);
		});
	});

	describe('replaceFrontmatterUrl', () => {
		it('should replace frontmatter URL', () => {
			const content = '---\nsource: https://example.com/img.png\n---\ncontent';
			const result = replaceFrontmatterUrl(content, 'https://example.com/img.png', 'https://example.com/new.png');
			expect(result.changed).toBe(true);
			expect(result.content).toContain('https://example.com/new.png');
			expect(result.content).not.toContain('https://example.com/img.png');
		});

		it('should return unchanged when no frontmatter', () => {
			const content = 'just text';
			const result = replaceFrontmatterUrl(content, 'https://example.com/img.png', 'https://example.com/new.png');
			expect(result.changed).toBe(false);
			expect(result.content).toBe('just text');
		});
	});

	describe('replaceAll', () => {
		it('should replace all occurrences', () => {
			const content = 'old old old';
			const result = replaceAll(content, 'old', 'new');
			expect(result.content).toBe('new new new');
			expect(result.changed).toBe(true);
		});

		it('should not replace when old and new are same', () => {
			const result = replaceAll('abc', 'abc', 'abc');
			expect(result.changed).toBe(false);
			expect(result.content).toBe('abc');
		});

		it('should handle empty old string', () => {
			const result = replaceAll('abc', '', 'X');
			expect(result.content).toBe('XabcXbcX');
			expect(result.changed).toBe(true);
		});
	});

	describe('isCodeOrInlineCode', () => {
		it('should detect code in fenced block', () => {
			const content = '```\n![[x.png]]\n```';
			expect(isCodeOrInlineCode(content, 3)).toBe(true);
		});

		it('should detect code in inline code', () => {
			const content = 'See `![[x.png]]` now';
			expect(isCodeOrInlineCode(content, 7)).toBe(true);
		});

		it('should not flag normal content', () => {
			const content = '![[x.png]]';
			expect(isCodeOrInlineCode(content, 0)).toBe(false);
		});
	});
});