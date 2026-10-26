/**
 * Settings migration.
 *
 * Migrates settings from old versions to the current schema. Each migration
 * is a function that transforms a settings record from one version to the next.
 * Migrations are additive and run in order.
 */

export interface MigrationResult {
	migrated: boolean;
	errors: string[];
	migratedRecord: Record<string, unknown>;
}

export interface MigrationStep {
	fromVersion: string;
	toVersion: string;
	migrate: (record: Record<string, unknown>) => Record<string, unknown>;
}

export class SettingsMigration {
	private readonly migrations: MigrationStep[];

	public constructor() {
		this.migrations = [
			{
				fromVersion: '0.0.0',
				toVersion: '0.1.0',
				migrate: (record) => this.migrate000To010(record)
			},
			{
				fromVersion: '0.1.0',
				toVersion: '0.2.0',
				migrate: (record) => this.migrate010To020(record)
			}
		];
	}

	/**
	 * Migrate a settings record from its stored version to the current version.
	 * Returns the migrated record and whether any migration was applied.
	 */
	migrate(record: Record<string, unknown>, storedVersion: string): MigrationResult {
		const errors: string[] = [];
		let current: Record<string, unknown> = record;
		let currentVersion = storedVersion || '0.0.0';
		let migrated = false;

		for (const migration of this.migrations) {
			if (this.versionLessThan(currentVersion, migration.fromVersion)) {
				continue;
			}
			if (this.versionGreaterThanOrEqual(currentVersion, migration.toVersion)) {
				continue;
			}

			try {
				current = migration.migrate(current);
				currentVersion = migration.toVersion;
				migrated = true;
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Unknown error';
				errors.push(`Migration ${migration.fromVersion}->${migration.toVersion}: ${msg}`);
			}
		}

		return { migrated, errors, migratedRecord: current };
	}

	private versionLessThan(a: string, b: string): boolean {
		return this.compareVersions(a, b) < 0;
	}

	private versionGreaterThanOrEqual(a: string, b: string): boolean {
		return this.compareVersions(a, b) >= 0;
	}

	private compareVersions(a: string, b: string): number {
		const pa = a.split('.').map(Number);
		const pb = b.split('.').map(Number);
		for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
			const va = pa[i] ?? 0;
			const vb = pb[i] ?? 0;
			if (va < vb) return -1;
			if (va > vb) return 1;
		}
		return 0;
	}

	/**
	 * Migration 0.0.0 -> 0.1.0: Initial settings schema.
	 * No changes needed - this is the baseline.
	 */
	private migrate000To010(record: Record<string, unknown>): Record<string, unknown> {
		return record;
	}

	/**
	 * Migration 0.1.0 -> 0.2.0: Add all rename/delete handler settings.
	 * All new fields are off by default.
	 */
	private migrate010To020(record: Record<string, unknown>): Record<string, unknown> {
		return {
			...record,
			shouldHandleRenames: false,
			shouldUpdateFileNameAliases: true,
			shouldRenameAttachmentFolder: false,
			shouldRenameAttachmentFiles: false,
			shouldDeleteConflictingAttachments: false,
			shouldHandleDeletions: false,
			emptyFolderBehavior: 'keep',
			shouldDeleteEmptyNoteFolders: false,
			shouldRescueSharedAttachments: false,
			notePriorities: [],
			rescueAttachmentUsedByMultipleNotesMode: 'prompt',
			treatAsAttachmentExtensions: ['.excalidraw.md', 'property:excalidraw-plugin'],
			includePaths: [],
			excludePaths: []
		};
	}
}

export const settingsMigration = new SettingsMigration();
