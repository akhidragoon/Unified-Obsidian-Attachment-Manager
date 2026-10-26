/**
 * Path compatibility handler - vault pass over path-compatibility.ts.
 * Finds every file and folder whose path or name is invalid on an enabled platform,
 * reports them, and repairs them.
 */

import { App, Notice, TAbstractFile, TFolder } from 'obsidian';
import {
	PATH_COMPATIBILITY_PLATFORMS,
	PathCompatibilityPlatform,
	PathCompatibilityViolation,
	findPathCompatibilityViolations,
	repairName,
} from './path-compatibility';

export interface PathCompatibilityEntry {
	readonly newPath: string | null;
	readonly path: string;
	readonly violations: readonly PathCompatibilityViolation[];
}

export interface PathCompatibilityScope {
	readonly maxVaultRootPathLength: number;
	readonly platforms: readonly PathCompatibilityPlatform[];
	readonly shouldNormalizeUnicodeNames: boolean;
}

export interface FixOutcome {
	readonly type: 'collision' | 'notNeeded' | 'repaired' | 'unrepairable';
	readonly path: string;
}

export class PathCompatibilityCheckResult {
	public readonly entries: PathCompatibilityEntry[] = [];
	public vaultRootWarning: string | null = null;

	public add(entry: PathCompatibilityEntry): void {
		this.entries.push(entry);
	}

	public toString(app: App, reportPath: string): string {
		const title = 'Path Compatibility';
		const warningLine = this.vaultRootWarning === null
			? ''
			: `> [!WARNING]\n> ${this.vaultRootWarning}\n\n`;

		if (this.entries.length === 0) {
			return `# ${title}\n${warningLine}No path compatibility issues found\n\n`;
		}

		let $string = `# ${title} (${this.entries.length} items)\n${warningLine}`;

		for (const entry of this.entries) {
			$string += `\`${entry.path}\`:\n`;

			for (const violation of entry.violations) {
				$string += `- ${describeViolation(violation)}\n`;
			}

			$string += entry.newPath === null
				? `- Cannot repair\n`
				: `- Would become: \`${entry.newPath}\`\n`;
			$string += '\n';
		}

		return $string;
	}
}

export class PathCompatibilityHandler {
	private readonly app: App;

	public constructor(app: App) {
		this.app = app;
	}

	public check(result: PathCompatibilityCheckResult): void {
		const scope = this.resolveScope();
		if (scope === null) {
			return;
		}

		if (scope.platforms.length > 0) {
			result.vaultRootWarning = this.buildVaultRootWarning();
		}

		for (const file of this.getSortedAbstractFiles()) {
			const violations = this.findViolations(file, scope);
			if (violations.length === 0) {
				continue;
			}

			const newName = this.repair(file, scope);
			result.add({
				newPath: newName === null
					? null
					: this.joinPath(this.getParentPath(file), newName),
				path: file.path,
				violations,
			});
		}
	}

	public async fix(): Promise<FixOutcome[]> {
		const scope = this.resolveScope();
		if (scope === null) {
			new Notice('No path compatibility platforms enabled');
			return [];
		}

		const vaultRootWarning = scope.platforms.length > 0
			? this.buildVaultRootWarning()
			: null;
		if (vaultRootWarning !== null) {
			new Notice(vaultRootWarning);
		}

		const results: FixOutcome[] = [];
		let repairedCount = 0;

		for (const file of this.getSortedAbstractFiles()) {
			const outcome = await this.fixFile(file, scope);
			results.push(outcome);
			if (outcome.type === 'repaired') {
				repairedCount++;
			}
		}

		if (repairedCount === 0) {
			new Notice('Nothing to repair');
		} else {
			new Notice(`Repaired ${repairedCount} item(s)`);
		}

		return results;
	}

	public resolveScope(): PathCompatibilityScope | null {
		// Default to checking Windows + the current platform
		const currentPlatform = this.getCurrentPlatform();
		const platforms: PathCompatibilityPlatform[] = [];

		if (currentPlatform && currentPlatform !== PathCompatibilityPlatform.Windows) {
			platforms.push(PathCompatibilityPlatform.Windows, currentPlatform);
		} else if (currentPlatform === PathCompatibilityPlatform.Windows) {
			platforms.push(PathCompatibilityPlatform.Windows);
		} else {
			platforms.push(...PATH_COMPATIBILITY_PLATFORMS);
		}

		if (platforms.length === 0) {
			return null;
		}

		return {
			maxVaultRootPathLength: this.resolveMaxVaultRootPathLength(),
			platforms,
			shouldNormalizeUnicodeNames: false,
		};
	}

	private findViolations(
		file: TAbstractFile,
		scope: PathCompatibilityScope,
	): PathCompatibilityViolation[] {
		return findPathCompatibilityViolations({
			isFolder: file instanceof TFolder,
			maxVaultRootPathLength: scope.maxVaultRootPathLength,
			path: file.path,
			platforms: scope.platforms,
		});
	}

	private repair(
		file: TAbstractFile,
		scope: PathCompatibilityScope,
	): string | null {
		const { basename, extension } = this.splitName(file);

		return repairName({
			basename,
			extension,
			isFolder: file instanceof TFolder,
			maxVaultRootPathLength: scope.maxVaultRootPathLength,
			parentPath: this.getParentPath(file),
			platforms: scope.platforms,
		});
	}

	private async fixFile(
		file: TAbstractFile,
		scope: PathCompatibilityScope,
	): Promise<FixOutcome> {
		const violations = this.findViolations(file, scope);
		if (violations.length === 0) {
			return { type: 'notNeeded', path: file.path };
		}

		const newName = this.repair(file, scope);
		if (newName === null) {
			return { type: 'unrepairable', path: file.path };
		}

		const newPath = this.joinPath(this.getParentPath(file), newName);

		try {
			await this.app.vault.rename(file, newPath);
			return { type: 'repaired', path: file.path };
		} catch {
			return { type: 'collision', path: file.path };
		}
	}

	private buildVaultRootWarning(): string | null {
		return null;
	}

	private resolveMaxVaultRootPathLength(): number {
		const adapter = (this.app.vault as unknown as { adapter?: { basePath?: string } })
			.adapter;
		const basePath = adapter?.basePath ?? '';
		return basePath.length;
	}

	private getSortedAbstractFiles(): TAbstractFile[] {
		return this.app.vault.getAllLoadedFiles()
			.filter((file) => !(file instanceof TFolder && file.isRoot()))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	private getParentPath(file: TAbstractFile): string {
		if (file.parent === null || file.parent.isRoot()) {
			return '';
		}
		return file.parent.path;
	}

	private joinPath(parentPath: string, name: string): string {
		return parentPath === '' ? name : `${parentPath}/${name}`;
	}

	private splitName(file: TAbstractFile): { basename: string; extension: string } {
		if (file instanceof TFolder) {
			return { basename: file.name, extension: '' };
		}

		const name = file.name;
		const dotIndex = name.lastIndexOf('.');
		if (dotIndex <= 0) {
			return { basename: name, extension: '' };
		}
		return { basename: name.slice(0, dotIndex), extension: name.slice(dotIndex + 1) };
	}

	private getCurrentPlatform(): PathCompatibilityPlatform | null {
		if ((window as unknown as { navigator?: { platform?: string } }).navigator?.platform) {
			const p = (window.navigator as unknown as { platform: string }).platform;
			if (/Win/i.test(p)) return PathCompatibilityPlatform.Windows;
			if (/Mac/i.test(p)) return PathCompatibilityPlatform.MacOs;
			if (/Linux/i.test(p)) return PathCompatibilityPlatform.Linux;
			if (/iPhone|iPad|iPod/i.test(p)) return PathCompatibilityPlatform.Ios;
			if (/Android/i.test(p)) return PathCompatibilityPlatform.Android;
		}
		return null;
	}
}

function describeViolation(violation: PathCompatibilityViolation): string {
	const platform = violation.platform === null ? '' : violation.platform;
	return `${violation.type} (${platform})`;
}
