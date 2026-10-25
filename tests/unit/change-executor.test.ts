import { describe, it, expect } from 'vitest';
import {
	executeOperation,
	executePlan,
	executePlanAsync,
	isOperationExecutable,
	resetOperationStatus,
	getExecutionSummary,
	ExecutionResult,
	ExecutionOptions,
} from '../../src/core/change-executor';
import { Operation, OperationType, OperationStatus } from '../../src/core/operation-planner';

describe('Change Executor', () => {
	const baseOp: Operation = {
		id: 'op1',
		type: OperationType.Download,
		status: OperationStatus.Pending,
		description: 'Download test image',
		sourcePath: 'https://example.com/img.png',
		targetPath: 'attachments/img.png',
	};

	describe('executeOperation', () => {
		it('should complete download operation in dry run', async () => {
			const result = await executeOperation(baseOp, new Set(), { dryRun: true });
			expect(result).toBe(OperationStatus.Completed);
			expect(baseOp.status).toBe(OperationStatus.Completed);
		});

		it('should complete operation normally', async () => {
			const result = await executeOperation(baseOp, new Set(), {});
			expect(result).toBe(OperationStatus.Completed);
			expect(baseOp.status).toBe(OperationStatus.Completed);
		});

		it('should set failed status on error', async () => {
			const op: Operation = {
				id: 'op2',
				type: OperationType.RewriteReference,
				status: OperationStatus.Executing,
				description: 'Rewrite',
			};
			const result = await executeOperation(op, new Set(), {});
			expect(result).toBe(OperationStatus.Failed);
			expect(op.status).toBe(OperationStatus.Failed);
		});
	});

	describe('executePlan', () => {
		it('should return success when no operations fail', async () => {
			const ops = [
				{ ...baseOp, id: 'op1', status: OperationStatus.Valid },
			];
			const plan = {
				id: 'plan1',
				name: 'Test Plan',
				operations: ops,
				createdAt: Date.now(),
			};
			const result = await executePlan(plan as any, new Set(), {});
			expect(result.success).toBe(true);
			expect(result.completedOperations).toHaveLength(1);
			expect(result.failedOperations).toHaveLength(0);
		});

		it('should handle plan with no operations', async () => {
			const plan = {
				id: 'plan1',
				name: 'Empty Plan',
				operations: [],
				createdAt: Date.now(),
			};
			const result = await executePlan(plan as any, new Set(), {});
			expect(result.success).toBe(true);
			expect(result.completedOperations).toHaveLength(0);
		});
	});

	describe('executePlanAsync', () => {
		it('should process operations sequentially', async () => {
			const ops = [
				{ ...baseOp, id: 'op1', status: OperationStatus.Valid },
				{ ...baseOp, id: 'op2', status: OperationStatus.Valid },
			];
			const plan = {
				id: 'plan1',
				name: 'Async Plan',
				operations: ops,
				createdAt: Date.now(),
			};
			const result = await executePlanAsync(plan as any, new Set(), {});
			expect(result.success).toBe(true);
			expect(result.completedOperations).toHaveLength(2);
		});
	});

	describe('isOperationExecutable', () => {
		it('should return true for Valid operations', () => {
			expect(isOperationExecutable({ ...baseOp, status: OperationStatus.Valid } as Operation)).toBe(true);
		});

		it('should return true for Pending operations', () => {
			expect(isOperationExecutable(baseOp)).toBe(true);
		});

		it('should return false for Invalid operations', () => {
			expect(isOperationExecutable({ ...baseOp, status: OperationStatus.Invalid } as Operation)).toBe(false);
		});
	});

	describe('resetOperationStatus', () => {
		it('should reset failed operations to pending', () => {
			const op = { ...baseOp, status: OperationStatus.Failed };
			resetOperationStatus({ operations: [op], id: 'p', name: 'p', createdAt: 0 } as any);
			expect(op.status).toBe(OperationStatus.Pending);
		});

		it('should not reset non-failed operations', () => {
			const op = { ...baseOp, status: OperationStatus.Completed };
			resetOperationStatus({ operations: [op], id: 'p', name: 'p', createdAt: 0 } as any);
			expect(op.status).toBe(OperationStatus.Completed);
		});
	});

	describe('getExecutionSummary', () => {
		it('should generate summary string', () => {
			const result: ExecutionResult = {
				success: true,
				completedOperations: ['op1'],
				failedOperations: [],
				errors: [],
			};
			const summary = getExecutionSummary(result);
			expect(summary).toContain('op1');
		});

		it('should include errors in summary', () => {
			const result: ExecutionResult = {
				success: false,
				completedOperations: [],
				failedOperations: ['op2'],
				errors: ['Operation op2 failed'],
			};
			const summary = getExecutionSummary(result);
			expect(summary).toContain('failed');
			expect(summary).toContain('Operation op2 failed');
		});
	});
});