import { ReferenceSpan } from './path-resolver';

export enum OperationType {
	Download = 'Download',
	CreateFile = 'CreateFile',
	RenameFile = 'RenameFile',
	RewriteReference = 'RewriteReference',
	RepairPath = 'RepairPath',
	MoveFile = 'MoveFile',
	DeleteFile = 'DeleteFile',
}

export enum OperationStatus {
	Pending = 'Pending',
	Validating = 'Validating',
	Valid = 'Valid',
	Invalid = 'Invalid',
	Executing = 'Executing',
	Completed = 'Completed',
	Failed = 'Failed',
	RolledBack = 'RolledBack',
}

export interface Operation {
	id: string;
	type: OperationType;
	status: OperationStatus;
	description: string;
	sourcePath?: string;
	targetPath?: string;
	oldLink?: string;
	newLink?: string;
	references?: ReferenceSpan[];
	validationErrors?: string[];
	dependencies?: string[];
	warnings?: string[];
	metadata?: Record<string, unknown>;
}

export interface Plan {
	id: string;
	name: string;
	operations: Operation[];
	createdAt: number;
	estimatedDuration?: number;
	warnings?: string[];
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface CollisionCheck {
	hasCollision: boolean;
	conflicts: string[];
}

export function generateOperationId(): string {
	return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDownloadOperation(
	url: string,
	targetPath: string,
	references: ReferenceSpan[],
): Operation {
	return {
		id: generateOperationId(),
		type: OperationType.Download,
		status: OperationStatus.Pending,
		description: `Download ${url} to ${targetPath}`,
		sourcePath: url,
		targetPath,
		references,
	};
}

export function createRewriteReferenceOperation(
	oldLink: string,
	newLink: string,
	references: ReferenceSpan[],
): Operation {
	return {
		id: generateOperationId(),
		type: OperationType.RewriteReference,
		status: OperationStatus.Pending,
		description: `Rewrite ${oldLink} -> ${newLink}`,
		oldLink,
		newLink,
		references,
	};
}

export function createMoveFileOperation(
	sourcePath: string,
	targetPath: string,
): Operation {
	return {
		id: generateOperationId(),
		type: OperationType.MoveFile,
		status: OperationStatus.Pending,
		description: `Move ${sourcePath} -> ${targetPath}`,
		sourcePath,
		targetPath,
	};
}

export function createRenameFileOperation(
	sourcePath: string,
	targetPath: string,
): Operation {
	return {
		id: generateOperationId(),
		type: OperationType.RenameFile,
		status: OperationStatus.Pending,
		description: `Rename ${sourcePath} -> ${targetPath}`,
		sourcePath,
		targetPath,
	};
}

export function createCreateFileOperation(
	targetPath: string,
	content: string,
): Operation {
	return {
		id: generateOperationId(),
		type: OperationType.CreateFile,
		status: OperationStatus.Pending,
		description: `Create ${targetPath}`,
		targetPath,
		metadata: { content },
	};
}

export function validateOperation(op: Operation, existingPaths: Set<string>): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (op.targetPath) {
		if (existingPaths.has(op.targetPath)) {
			errors.push(`Target path already exists: ${op.targetPath}`);
		}
		if (op.targetPath.startsWith('..') || op.targetPath.includes('..')) {
			errors.push(`Path traversal detected: ${op.targetPath}`);
		}
	}

	if (op.type === OperationType.Download && !op.sourcePath) {
		errors.push('Download operation requires sourcePath (URL)');
	}

	if (op.type === OperationType.RewriteReference && (!op.oldLink || !op.newLink)) {
		errors.push('RewriteReference operation requires oldLink and newLink');
	}

	if (op.type === OperationType.MoveFile && (!op.sourcePath || !op.targetPath)) {
		errors.push('MoveFile operation requires sourcePath and targetPath');
	}

	if (op.type === OperationType.RenameFile && (!op.sourcePath || !op.targetPath)) {
		errors.push('RenameFile operation requires sourcePath and targetPath');
	}

	if (op.references && op.references.length === 0) {
		warnings.push('Operation has no associated references');
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

export function checkCollisions(operations: Operation[], existingPaths: Set<string>): CollisionCheck {
	const targetPaths = new Map<string, string[]>();
	const conflicts: string[] = [];

	for (const op of operations) {
		if (op.targetPath) {
			const existing = targetPaths.get(op.targetPath) || [];
			existing.push(op.id);
			targetPaths.set(op.targetPath, existing);
		}
	}

	for (const [path, opIds] of targetPaths) {
		if (opIds.length > 1) {
			conflicts.push(`Multiple operations target same path: ${path} (${opIds.join(', ')})`);
		}
		if (existingPaths.has(path)) {
			conflicts.push(`Operation targets existing file: ${path}`);
		}
	}

	return {
		hasCollision: conflicts.length > 0,
		conflicts,
	};
}

export function checkDependencies(operations: Operation[]): Map<string, string[]> {
	const depGraph = new Map<string, string[]>();

	for (const op of operations) {
		depGraph.set(op.id, op.dependencies || []);
	}

	return depGraph;
}

export function topologicalSort(operations: Operation[]): Operation[] {
	const graph = checkDependencies(operations);
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>();

	for (const [id] of graph) {
		inDegree.set(id, 0);
		adj.set(id, []);
	}

	for (const [id, deps] of graph) {
		for (const dep of deps) {
			if (adj.has(dep)) {
				adj.get(dep)!.push(id);
				inDegree.set(id, (inDegree.get(id) || 0) + 1);
			}
		}
	}

	const queue = Array.from(inDegree.entries())
		.filter(([, deg]) => deg === 0)
		.map(([id]) => id);

	const result: Operation[] = [];
	const opMap = new Map(operations.map(op => [op.id, op]));

	while (queue.length > 0) {
		const id = queue.shift()!;
		const op = opMap.get(id);
		if (op) result.push(op);

		for (const neighbor of adj.get(id) || []) {
			const newDeg = (inDegree.get(neighbor) || 0) - 1;
			inDegree.set(neighbor, newDeg);
			if (newDeg === 0) {
				queue.push(neighbor);
			}
		}
	}

	if (result.length !== operations.length) {
		const remaining = operations.filter(op => !result.includes(op));
		return [...result, ...remaining];
	}

	return result;
}

export function generatePreview(plan: Plan): string {
	const lines: string[] = [
		`# Operation Plan: ${plan.name}`,
		`Operations: ${plan.operations.length}`,
		'',
	];

	for (const op of plan.operations) {
		const status = op.status;
		const errors = op.validationErrors?.length ? ` ❌ ${op.validationErrors.join(', ')}` : '';
		lines.push(`- [${status}] ${op.type}: ${op.description}${errors}`);
		if (op.warnings && op.warnings.length > 0) {
			for (const w of op.warnings) {
				lines.push(`  ⚠ ${w}`);
			}
		}
	}

	if (plan.warnings && plan.warnings.length > 0) {
		lines.push('', '## Warnings:');
		for (const w of plan.warnings) {
			lines.push(`- ⚠ ${w}`);
		}
	}

	return lines.join('\n');
}

export function createPlan(name: string, operations: Operation[]): Plan {
	return {
		id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
		name,
		operations,
		createdAt: Date.now(),
	};
}

export function validatePlan(plan: Plan, existingPaths: Set<string>): Plan {
	const warnings: string[] = [];

	for (const op of plan.operations) {
		const result = validateOperation(op, existingPaths);
		op.validationErrors = result.errors;
		op.warnings = result.warnings;
		op.status = result.valid ? OperationStatus.Valid : OperationStatus.Invalid;
		warnings.push(...result.warnings);
	}

	const collisions = checkCollisions(plan.operations, existingPaths);
	if (collisions.hasCollision) {
		warnings.push(...collisions.conflicts);
		for (const op of plan.operations) {
			if (collisions.conflicts.some(c => c.includes(op.targetPath || ''))) {
				op.status = OperationStatus.Invalid;
				op.validationErrors = op.validationErrors || [];
				op.validationErrors.push(...collisions.conflicts.filter(c => c.includes(op.targetPath || '')));
			}
		}
	}

	const sorted = topologicalSort(plan.operations);
	plan.operations = sorted;
	plan.warnings = warnings;

	return plan;
}

export function filterExecutableOperations(plan: Plan): Operation[] {
	return plan.operations.filter(op => op.status === OperationStatus.Valid);
}

export function estimateDuration(operations: Operation[]): number {
	let total = 0;
	for (const op of operations) {
		switch (op.type) {
			case OperationType.Download:
				total += 2000;
				break;
			case OperationType.MoveFile:
			case OperationType.RenameFile:
				total += 500;
				break;
			case OperationType.RewriteReference:
				total += 100;
				break;
			case OperationType.CreateFile:
				total += 200;
				break;
			default:
				total += 100;
		}
	}
	return total;
}