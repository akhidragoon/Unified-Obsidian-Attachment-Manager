/**
 * Plugin dependents tracking.
 *
 * Keeps track of which plugins depend on this one, so the settings tab can say
 * why this plugin is in the vault.
 */

import { App } from 'obsidian';

export interface PluginDependent {
	pluginId: string;
	pluginName: string;
	pluginVersion: string;
}

export interface PluginDependentsComponentConstructorParams {
	app: App;
	pluginId: string;
}

export class PluginDependentsComponent {
	private readonly app: App;
	private readonly dependents = new Map<string, PluginDependent>();
	private readonly pluginId: string;

	public constructor(params: PluginDependentsComponentConstructorParams) {
		this.app = params.app;
		this.pluginId = params.pluginId;
	}

	/**
	 * The enabled plugins that depend on this one, sorted by name.
	 */
	public getDependents(): PluginDependent[] {
		return [...this.dependents.values()].sort((a, b) => a.pluginName.localeCompare(b.pluginName));
	}

	/**
	 * Call this during onload to start listening for plugin load/unload events.
	 * Without obsidian-lib, this is a stub that returns no dependents.
	 */
	public registerEvents(): void {
		// Plugin dependents tracking requires obsidian-lib's plugin lifecycle events.
		// Without obsidian-lib, this is a stub.
	}
}
