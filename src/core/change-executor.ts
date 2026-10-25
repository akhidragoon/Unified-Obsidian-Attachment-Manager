import { Operation, OperationType, OperationStatus, Plan } from './operation-planner';

export interface ExecutionResult {
	success: boolean;
	completedOperations: string[];
	failedOperations: string[];
	errors: string[];
}

export interface ExecutionOptions {
	dryRun?: boolean;
	onProgress?: (completed: number, total: number) => void;
	onError?: (operationId: string, error: string) => void;
}

export function executeOperation(
	op: Operation,
	existingPaths: Set<string>,
	options: ExecutionOptions = {},
): Promise<OperationStatus> {
	return new Promise((resolve) => {
		if (options.dryRun) {
			op.status = OperationStatus.Completed;
			resolve(OperationStatus.Completed);
			return;
		}

		try {
			switch (op.type) {
				case OperationType.Download:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.CreateFile:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.RenameFile:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.MoveFile:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.RewriteReference:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.RepairPath:
					op.status = OperationStatus.Completed;
					break;
				case OperationType.DeleteFile:
					op.status = OperationStatus.Completed;
					break;
				default:
					op.status = OperationStatus.Failed;
			}
		} catch {
			op.status = OperationStatus.Failed;
			options.onError?.(op.id, `Execution failed for ${op.type}`);
		}

		resolve(op.status);
	});
}

export function executePlan(
	plan: Plan,
	existingPaths: Set<string>,
	options: ExecutionOptions = {},
): ExecutionResult {
	const completedOperations: string[] = [];
	const failedOperations: string[] = [];
	const errors: string[] = [];

	const operations = [...plan.operations];
	let completedCount = 0;
	const total = operations.length;

	for (const op of operations) {
		if (op.status !== OperationStatus.Valid && op.status !== OperationStatus.Pending) {
			continue;
		}

		op.status = OperationStatus.Executing;

		try {
			executeOperation(op, existingPaths, options)
				.then((status) => {
					if (status === OperationStatus.Completed) {
						completedOperations.push(op.id);
						completedCount++;
						options.onProgress?.(completedCount, total);
					} else {
						failedOperations.push(op.id);
						errors.push(`Operation ${op.id} (${op.type}) failed`);
						options.onError?.(op.id, `Operation ${op.type} failed`);
					}
				})
				.catch((err: Error) => {
					failedOperations.push(op.id);
					errors.push(`Operation ${op.id} failed: ${err.message}`);
					options.onError?.(op.id, err.message);
				});
		} catch (err: Error) {
			op.status = OperationStatus.Failed;
			failedOperations.push(op.id);
			errors.push(`Operation ${op.id} failed: ${err.message}`);
			options.onError?.(op.id, err.message);
		}
	}

	return {
		success: failedOperations.length === 0,
		completedOperations,
		failedOperations,
		errors,
	};
}

export function executePlanAsync(
	plan: Plan,
	existingPaths: Set<string>,
	options: ExecutionOptions = {},
): Promise<ExecutionResult> {
	return new Promise((resolve) => {
		const completedOperations: string[] = [];
		const failedOperations: string[] = [];
		const errors: string[] = [];

		let index = 0;
		const total = plan.operations.length;

		const next = () => {
			if (index >= total) {
				resolve({
					success: failedOperations.length === 0,
					completedOperations,
					failedOperations,
					errors,
				});
				return;
			}

			const op = plan.operations[index++];

			if (!op || (op.status !== OperationStatus.Valid && op.status !== OperationStatus.Pending)) {
				next();
				return;
			}

			op.status = OperationStatus.Executing;

			executeOperation(op, existingPaths, options)
				.then((status) => {
					if (status === OperationStatus.Completed) {
						completedOperations.push(op.id);
						options.onProgress?.(completedOperations.length, total);
					} else {
						failedOperations.push(op.id);
						errors.push(`Operation ${op.id} (${op.type}) failed`);
						options.onError?.(op.id, `Operation ${op.type} failed`);
					}
					next();
				})
				.catch((err: Error) => {
					failedOperations.push(op.id);
					errors.push(`Operation ${op.id} failed: ${err.message}`);
					options.onError?.(op.id, err.message);
					next();
				});
		};

		next();
	});
}

export function isOperationExecutable(op: Operation): boolean {
	return op.status === OperationStatus.Valid || op.status === OperationStatus.Pending;
}

export function resetOperationStatus(plan: Plan): void {
	for (const op of plan.operations) {
		if (op.status === OperationStatus.Failed) {
			op.status = OperationStatus.Pending;
		}
	}
}

export function getExecutionSummary(result: ExecutionResult): string {
	const { success, completedOperations, failedOperations, errors } = result;
	let summary = `Execution ${success ? 'completed' : 'completed with errors'}: `;
	summary += `${completedOperations.length} succeeded, ${failedOperations.length} failed`;
	if (errors.length > 0) {
		summary += `\nErrors:\n${errors.join('\n')}`;
	}
	return summary;
}