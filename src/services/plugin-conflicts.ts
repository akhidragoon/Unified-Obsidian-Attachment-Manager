/**
 * Plugin conflict detection.
 *
 * Declares what this plugin refuses to run beside (blocking) and what it merely warns about.
 * Blocking conflicts hold this plugin's feature surface shut until the conflict lifts.
 * Warning conflicts let both plugins run but notify the user.
 */

import { App, TFolder, Vault } from 'obsidian';

export enum PluginConflictSeverity {
	Block = 'block',
	Warn = 'warn'
}

export interface PluginConflict {
	pluginId: string;
	pluginName: string;
	conflictingVersionRange: string;
	reason: string;
	severity: PluginConflictSeverity;
}

export interface PluginConflictOwner {
	firstSupportedVersion: string;
	conflictingVersionRange?: string;
	pluginId: string;
	pluginName: string;
}

export interface PluginConflictResult {
	blocking: PluginConflict[];
	warning: PluginConflict[];
	hasActiveBlockingConflicts: boolean;
	hasActiveWarningConflicts: boolean;
}

/**
 * Plugins that used to carry a rename/delete handler of their own, and the version
 * of each that gave it up. Two handlers acting on one rename corrupt links, so
 * this plugin declares each of them as a BLOCKING conflict.
 */
const RENAME_DELETE_HANDLER_OWNERS: readonly PluginConflictOwner[] = [
	{
		firstSupportedVersion: '12.0.0',
		pluginId: 'obsidian-custom-attachment-location',
		pluginName: 'Custom Attachment Location'
	},
	{
		firstSupportedVersion: '4.0.0',
		pluginId: 'consistent-attachments-and-links',
		pluginName: 'Consistent Attachments and Links'
	},
	{
		firstSupportedVersion: '5.0.0',
		pluginId: 'better-markdown-links',
		pluginName: 'Better Markdown Links'
	},
	{
		firstSupportedVersion: '4.0.0',
		pluginId: 'external-rename-handler',
		pluginName: 'External Rename Handler'
	},
	{
		firstSupportedVersion: '3.0.0',
		pluginId: 'frontmatter-markdown-links',
		pluginName: 'Frontmatter Markdown Links'
	}
];

/**
 * Plugins whose command overlaps with this plugin's. Declared as WARNING only
 * because it's annoying rather than destructive.
 */
const COMMAND_OVERLAP_CONFLICTS: readonly PluginConflictOwner[] = [
	{
		firstSupportedVersion: '4.1.0',
		pluginId: 'consistent-attachments-and-links',
		pluginName: 'Consistent Attachments and Links'
	}
];

export class PluginConflictDetector {
	/**
	 * Declares conflicts based on installed plugin versions.
	 * In a real implementation, this would check the Obsidian plugin registry
	 * for installed plugin versions. For now, it checks the manifest of
	 * installed plugins in the vault's .obsidian/plugins directory.
	 */
	constructor(
		private readonly app: App,
		private readonly pluginId: string,
		private readonly pluginName: string,
		private readonly pluginVersion: string
	) {}

	/**
	 * Check for conflicts with installed plugins.
	 * Returns blocking conflicts first, then warnings.
	 */
	getConflicts(installedPlugins: Array<{ id: string; name: string; version: string }>): PluginConflictResult {
		const blocking: PluginConflict[] = [];
		const warning: PluginConflict[] = [];

		for (const owner of RENAME_DELETE_HANDLER_OWNERS) {
			const installed = installedPlugins.find(p => p.id === owner.pluginId);
			if (!installed) continue;

			const conflicting = this.versionInRange(installed.version, owner.firstSupportedVersion);
			if (conflicting) {
				blocking.push({
					pluginId: owner.pluginId,
					pluginName: owner.pluginName,
					conflictingVersionRange: `<${owner.firstSupportedVersion}`,
					reason: `This plugin is waiting for ${owner.pluginName} ${owner.firstSupportedVersion} or newer. `
						+ 'Until then that plugin handles renames and deletes itself, and two handlers acting on one '
						+ 'rename corrupt links between them. Update it and this plugin picks the work back up on its '
						+ 'own, with no restart and nothing here to switch back on.',
					severity: PluginConflictSeverity.Block
				});
			}
		}

		for (const owner of COMMAND_OVERLAP_CONFLICTS) {
			const installed = installedPlugins.find(p => p.id === owner.pluginId);
			if (!installed) continue;

			const conflicting = this.versionInRange(installed.version, owner.firstSupportedVersion);
			if (conflicting) {
				warning.push({
					pluginId: owner.pluginId,
					pluginName: owner.pluginName,
					conflictingVersionRange: owner.conflictingVersionRange || `<${owner.firstSupportedVersion}`,
					reason: 'Both plugins add a Delete empty folders command, so it appears '
						+ 'twice in the command palette and running either copy sweeps the vault again.',
					severity: PluginConflictSeverity.Warn
				});
			}
		}

		return {
			blocking,
			warning,
			hasActiveBlockingConflicts: blocking.length > 0,
			hasActiveWarningConflicts: warning.length > 0
		};
	}

	/**
	 * Check if an installed version is in the conflicting range (below firstSupportedVersion).
	 */
	private versionInRange(installedVersion: string, firstSupportedVersion: string): boolean {
		const installed = this.parseVersion(installedVersion);
		const supported = this.parseVersion(firstSupportedVersion);
		if (!installed || !supported) return false;
		return installed.major < supported.major
			|| (installed.major === supported.major && installed.minor < supported.minor)
			|| (installed.major === supported.major && installed.minor === supported.minor && installed.patch < supported.patch);
	}

	private parseVersion(version: string): { major: number; minor: number; patch: number } | null {
		const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
		if (!match || !match[1] || !match[2] || !match[3]) return null;
		return {
			major: parseInt(match[1], 10),
			minor: parseInt(match[2], 10),
			patch: parseInt(match[3], 10)
		};
	}

	/**
	 * Get the list of installed plugins from the vault.
	 */
	async getInstalledPlugins(): Promise<Array<{ id: string; name: string; version: string }>> {
		try {
			const vault = this.app.vault;
			const configDir = vault.configDir;
			const pluginsDir = vault.getAbstractFileByPath(configDir + '/plugins') as TFolder | null;
			if (!pluginsDir) return [];

			const plugins: Array<{ id: string; name: string; version: string }> = [];
			for (const entry of pluginsDir.children) {
				if (!(entry instanceof TFolder)) {
					continue;
				}
				try {
					const entryId = entry.name;
					const manifest = await vault.adapter.read(configDir + '/plugins/' + entryId + '/manifest.json');
					const parsed = JSON.parse(manifest) as Record<string, unknown>;
					plugins.push({
						id: (parsed.id as string) || entryId,
						name: (parsed.name as string) || entryId,
						version: (parsed.version as string) || '0.0.0'
					});
				} catch {
					// Skip plugins with unreadable manifests
				}
			}
			return plugins;
		} catch {
			return [];
		}
	}
}
