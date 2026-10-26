/**
 * First Load Notice component.
 *
 * Shows a welcome notice on first load, explaining that all features are off
 * by default and where to find the settings.
 */

import { App, Notice } from 'obsidian';

export interface FirstLoadNoticeComponentConstructorParams {
	app: App;
	pluginId: string;
	pluginNoticeComponent: any;
}

export class FirstLoadNoticeComponent {
	private readonly app: App;
	private readonly pluginId: string;
	private readonly pluginNoticeComponent: any;

	public constructor(params: FirstLoadNoticeComponentConstructorParams) {
		this.app = params.app;
		this.pluginId = params.pluginId;
		this.pluginNoticeComponent = params.pluginNoticeComponent;
	}

	/**
	 * Show the first load notice if this is a fresh install.
	 */
	public async showIfFirstLoad(wasDataFileMissingOnInitialLoad: boolean): Promise<void> {
		if (!wasDataFileMissingOnInitialLoad) {
			return;
		}

		new Notice(
			'Unified Attachment Manager installed. All features are off by default. '
			+ 'Open Settings → Unified Attachment Manager to enable them.',
			8000
		);
	}
}
