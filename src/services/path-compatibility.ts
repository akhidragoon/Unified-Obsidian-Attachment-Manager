/**
 * Path compatibility checking and repair.
 *
 * Checks which naming constraints each platform imposes, which of them a given path violates,
 * and how to repair a name so it satisfies every enabled platform at once.
 *
 * Pure by design — no App, no vault, no I/O — so the correctness surface is unit-testable.
 */

export enum PathCompatibilityPlatform {
	Android = 'Android',
	Ios = 'Ios',
	Linux = 'Linux',
	MacOs = 'MacOs',
	Windows = 'Windows',
}

export enum PathCompatibilityViolationType {
	ForbiddenCharacter = 'ForbiddenCharacter',
	NameTooLong = 'NameTooLong',
	PathTooLong = 'PathTooLong',
	ReservedName = 'ReservedName',
	TrailingCharacter = 'TrailingCharacter',
	UnicodeNotNormalized = 'UnicodeNotNormalized',
}

export interface PathCompatibilityViolation {
	readonly platform: PathCompatibilityPlatform | null;
	readonly type: PathCompatibilityViolationType;
}

export interface PathCompatibilityProfile {
	readonly hasWindowsNamingRules: boolean;
	readonly maxFilePathLength: number;
	readonly maxFolderPathLength: number;
	readonly maxNameLength: number;
	readonly platform: PathCompatibilityPlatform;
	readonly shouldMeasureInBytes: boolean;
}

export interface FindPathCompatibilityViolationsParams {
	readonly isFolder: boolean;
	readonly maxVaultRootPathLength: number;
	readonly path: string;
	readonly platforms: readonly PathCompatibilityPlatform[];
}

export interface RepairNameParams {
	readonly basename: string;
	readonly extension: string;
	readonly isFolder: boolean;
	readonly maxVaultRootPathLength: number;
	readonly parentPath: string;
	readonly platforms: readonly PathCompatibilityPlatform[];
}

export const PATH_COMPATIBILITY_PLATFORMS: readonly PathCompatibilityPlatform[] = [
	PathCompatibilityPlatform.Windows,
	PathCompatibilityPlatform.Android,
	PathCompatibilityPlatform.Linux,
	PathCompatibilityPlatform.MacOs,
	PathCompatibilityPlatform.Ios,
];

export const PATH_COMPATIBILITY_PLATFORM_LABELS: Record<PathCompatibilityPlatform, string> = {
	[PathCompatibilityPlatform.Android]: 'Android',
	[PathCompatibilityPlatform.Ios]: 'iOS',
	[PathCompatibilityPlatform.Linux]: 'Linux',
	[PathCompatibilityPlatform.MacOs]: 'macOS',
	[PathCompatibilityPlatform.Windows]: 'Windows',
};

const WINDOWS_MAX_FILE_PATH_LENGTH = 259;
const WINDOWS_MAX_FOLDER_PATH_LENGTH = 247;
const WINDOWS_MAX_NAME_LENGTH = 255;
const UNIX_MAX_NAME_BYTES = 255;
const LINUX_MAX_PATH_BYTES = 4096;
const DARWIN_MAX_PATH_BYTES = 1024;

const PATH_COMPATIBILITY_PROFILES: Record<PathCompatibilityPlatform, PathCompatibilityProfile> = {
	[PathCompatibilityPlatform.Android]: {
		hasWindowsNamingRules: false,
		maxFilePathLength: LINUX_MAX_PATH_BYTES,
		maxFolderPathLength: LINUX_MAX_PATH_BYTES,
		maxNameLength: UNIX_MAX_NAME_BYTES,
		platform: PathCompatibilityPlatform.Android,
		shouldMeasureInBytes: true,
	},
	[PathCompatibilityPlatform.Ios]: {
		hasWindowsNamingRules: false,
		maxFilePathLength: DARWIN_MAX_PATH_BYTES,
		maxFolderPathLength: DARWIN_MAX_PATH_BYTES,
		maxNameLength: UNIX_MAX_NAME_BYTES,
		platform: PathCompatibilityPlatform.Ios,
		shouldMeasureInBytes: true,
	},
	[PathCompatibilityPlatform.Linux]: {
		hasWindowsNamingRules: false,
		maxFilePathLength: LINUX_MAX_PATH_BYTES,
		maxFolderPathLength: LINUX_MAX_PATH_BYTES,
		maxNameLength: UNIX_MAX_NAME_BYTES,
		platform: PathCompatibilityPlatform.Linux,
		shouldMeasureInBytes: true,
	},
	[PathCompatibilityPlatform.MacOs]: {
		hasWindowsNamingRules: false,
		maxFilePathLength: DARWIN_MAX_PATH_BYTES,
		maxFolderPathLength: DARWIN_MAX_PATH_BYTES,
		maxNameLength: UNIX_MAX_NAME_BYTES,
		platform: PathCompatibilityPlatform.MacOs,
		shouldMeasureInBytes: true,
	},
	[PathCompatibilityPlatform.Windows]: {
		hasWindowsNamingRules: true,
		maxFilePathLength: WINDOWS_MAX_FILE_PATH_LENGTH,
		maxFolderPathLength: WINDOWS_MAX_FOLDER_PATH_LENGTH,
		maxNameLength: WINDOWS_MAX_NAME_LENGTH,
		platform: PathCompatibilityPlatform.Windows,
		shouldMeasureInBytes: false,
	},
};

export function getProfiles(
	platforms: readonly PathCompatibilityPlatform[],
): PathCompatibilityProfile[] {
	return platforms.map((platform) => PATH_COMPATIBILITY_PROFILES[platform]);
}

/**
 * Forbidden characters that are unsafe in filenames across platforms.
 * Covers Windows reserved characters plus Obsidian's unsafe characters.
 */
const WINDOWS_FORBIDDEN_CHARS = /[<>:"/\\|?*]/g;
const OBSIDIAN_UNSAFE_CHARS_REGEX = (() => {
	const chars: string[] = [];
	for (let i = 0; i < 32; i++) {
		chars.push(String.fromCharCode(i));
	}
	return new RegExp(`[${chars.join('')}]`, 'g');
})();

function replaceForbiddenCharacters(
	$string: string,
	profile: PathCompatibilityProfile,
): string {
	return $string
		.replace(WINDOWS_FORBIDDEN_CHARS, '-')
		.replace(OBSIDIAN_UNSAFE_CHARS_REGEX, '-');
}

/**
 * Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 */
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]?.*)?$/i;

function isWindowsReservedName(name: string): boolean {
	return WINDOWS_RESERVED_NAMES.test(name);
}

function hasWindowsTrailingChars(name: string): boolean {
	return /[. ]$/.test(name);
}

function trimTrailingDotsAndSpaces(name: string): string {
	return name.replace(/[. ]+$/, '');
}

function getName(path: string): string {
	const slashIndex = path.lastIndexOf('/');
	return slashIndex === -1 ? path : path.slice(slashIndex + 1);
}

function measure($string: string, shouldMeasureInBytes: boolean): number {
	return shouldMeasureInBytes ? new Blob([$string]).size : $string.length;
}

export function findPathCompatibilityViolations(
	params: FindPathCompatibilityViolationsParams,
): PathCompatibilityViolation[] {
	const violations: PathCompatibilityViolation[] = [];
	const name = getName(params.path);

	for (const profile of getProfiles(params.platforms)) {
		const maxPathLength = params.isFolder
			? profile.maxFolderPathLength
			: profile.maxFilePathLength;
		const fullPathLength =
			params.maxVaultRootPathLength + 1 + measure(params.path, profile.shouldMeasureInBytes);

		if (fullPathLength > maxPathLength) {
			violations.push({
				platform: profile.platform,
				type: PathCompatibilityViolationType.PathTooLong,
			});
		}

		if (
			measure(name, profile.shouldMeasureInBytes) > profile.maxNameLength
		) {
			violations.push({
				platform: profile.platform,
				type: PathCompatibilityViolationType.NameTooLong,
			});
		}

		if (replaceForbiddenCharacters(name, profile) !== name) {
			violations.push({
				platform: profile.platform,
				type: PathCompatibilityViolationType.ForbiddenCharacter,
			});
		}

		if (!profile.hasWindowsNamingRules) {
			continue;
		}

		if (isWindowsReservedName(name)) {
			violations.push({
				platform: profile.platform,
				type: PathCompatibilityViolationType.ReservedName,
			});
		}

		if (hasWindowsTrailingChars(name)) {
			violations.push({
				platform: profile.platform,
				type: PathCompatibilityViolationType.TrailingCharacter,
			});
		}
	}

	return violations;
}

export function isUnicodeNormalized(name: string): boolean {
	return name === name.normalize('NFC');
}

export function repairName(params: RepairNameParams): null | string {
	const profiles = getProfiles(params.platforms);

	if (profiles.length === 0) {
		return params.extension === ''
			? params.basename
			: `${params.basename}.${params.extension}`;
	}

	let basename = params.basename;
	let extension = params.extension;

	for (const profile of profiles) {
		basename = replaceForbiddenCharacters(basename, profile);
		extension = replaceForbiddenCharacters(extension, profile);
	}

	extension = trimTrailingDotsAndSpaces(extension);
	basename = trimTrailingDotsAndSpaces(basename);

	if (
		profiles.some((profile) => profile.hasWindowsNamingRules) &&
		isWindowsReservedName(`${basename}${extension === '' ? '' : '.'}${extension}`)
	) {
		basename += '_';
	}

	const codePoints = [...basename];

	while (codePoints.length > 0) {
		const candidate = trimTrailingDotsAndSpaces(codePoints.join(''));

		if (candidate === '') {
			return null;
		}

		if (
			doesFitEveryProfile(candidate, extension, profiles, params)
		) {
			return extension === '' ? candidate : `${candidate}.${extension}`;
		}

		codePoints.pop();
	}

	return null;
}

function doesFitEveryProfile(
	basename: string,
	extension: string,
	profiles: PathCompatibilityProfile[],
	params: RepairNameParams,
): boolean {
	const name = extension === '' ? basename : `${basename}.${extension}`;
	const path = params.parentPath === '' ? name : `${params.parentPath}/${name}`;

	return profiles.every((profile) => {
		const maxPathLength = params.isFolder
			? profile.maxFolderPathLength
			: profile.maxFilePathLength;
		const fullPathLength =
			params.maxVaultRootPathLength + 1 + measure(path, profile.shouldMeasureInBytes);

		return (
			measure(name, profile.shouldMeasureInBytes) <= profile.maxNameLength &&
			fullPathLength <= maxPathLength
		);
	});
}
