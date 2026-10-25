import { describe, it, expect } from 'vitest';
import {
	OperationType,
	OperationStatus,
	validateOperation,
	checkCollisions,
	createPlan,
	validatePlan,
	filterExecutableOperations,
	generatePreview,
	topologicalSort,
	Operation,
	estimateDuration,
} from '../../src/core/operation-planner';
import { ReferenceSpan, ReferenceType } from '../../src/core/path-resolver';

describe('Operation Planner', () => {
	describe('validateOperation', () => {
		it('should pass validation for valid download operation', () => {
			const op = {
				id: 'op1',
				type: OperationType.Download,
				status: OperationStatus.Pending,
				description: 'test',
				sourcePath: 'https://example.com/img.png',
				targetPath: 'attachments/img.png',
				references: [],
			};
			const result = validateOperation(op, new Set());
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail validation when target exists', () => {
			const op = {
				id: 'op1',
				type: OperationType.Download,
				status: OperationStatus.Pending,
				description: 'test',
				sourcePath: 'https://example.com/img.png',
				targetPath: 'attachments/img.png',
				references: [],
			};
			const result = validateOperation(op, new Set(['attachments/img.png']));
			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Target path already exists: attachments/img.png');
		});

		it('should fail validation for path traversal', () => {
			const op = {
				id: 'op1',
				type: OperationType.CreateFile,
				status: OperationStatus.Pending,
				description: 'test',
				targetPath: '../evil/file.png',
			};
			const result = validateOperation(op, new Set());
			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Path traversal detected: ../evil/file.png');
		});

		it('should fail when download has no source', () => {
			const op = {
				id: 'op1',
				type: OperationType.Download,
				status: OperationStatus.Pending,
				description: 'test',
				targetPath: 'attachments/img.png',
			};
			const result = validateOperation(op, new Set());
			expect(result.valid).toBe(false);
		});

		it('should fail when rewrite has no oldLink', () => {
			const op = {
				id: 'op1',
				type: OperationType.RewriteReference,
				status: OperationStatus.Pending,
				description: 'test',
				newLink: 'new.png',
			};
			const result = validateOperation(op, new Set());
			expect(result.valid).toBe(false);
		});
	});

	describe('checkCollisions', () => {
		it('should detect no collisions when targets are unique', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1', sourcePath: 'a', targetPath: 'file1.png' },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Pending, description: 'd2', sourcePath: 'b', targetPath: 'file2.png' },
			];
			const result = checkCollisions(ops, new Set());
			expect(result.hasCollision).toBe(false);
			expect(result.conflicts).toHaveLength(0);
		});

		it('should detect collision when targets overlap', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1', sourcePath: 'a', targetPath: 'file.png' },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Pending, description: 'd2', sourcePath: 'b', targetPath: 'file.png' },
			];
			const result = checkCollisions(ops, new Set());
			expect(result.hasCollision).toBe(true);
			expect(result.conflicts.length).toBeGreaterThan(0);
		});

		it('should detect collision with existing file', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1', sourcePath: 'a', targetPath: 'existing.png' },
			];
			const result = checkCollisions(ops, new Set(['existing.png']));
			expect(result.hasCollision).toBe(true);
		});
	});

	describe('createPlan', () => {
		it('should create plan with operations', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'test' },
			];
			const plan = createPlan('Test Plan', ops);
			expect(plan.name).toBe('Test Plan');
			expect(plan.operations).toHaveLength(1);
			expect(plan.createdAt).toBeGreaterThan(0);
		});
	});

	describe('validatePlan', () => {
		it('should mark valid operations as Valid', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd', sourcePath: 'https://a.com/x.png', targetPath: 'x.png', references: [] },
			];
			const plan = createPlan('Plan', ops);
			const validated = validatePlan(plan, new Set());
			expect(validated.operations[0]!.status).toBe(OperationStatus.Valid);
		});

		it('should mark invalid operations as Invalid', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd', sourcePath: 'a', targetPath: 'x.png' },
			];
			const plan = createPlan('Plan', ops);
			const validated = validatePlan(plan, new Set(['x.png']));
			expect(validated.operations[0]!.status).toBe(OperationStatus.Invalid);
		});

		it('should detect collisions in plan', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1', sourcePath: 'a', targetPath: 'x.png' },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Pending, description: 'd2', sourcePath: 'b', targetPath: 'x.png' },
			];
			const plan = createPlan('Plan', ops);
			const validated = validatePlan(plan, new Set());
			expect(validated.operations.some(op => op.status === OperationStatus.Invalid)).toBe(true);
			expect(validated.warnings!.length).toBeGreaterThan(0);
		});
	});

	describe('filterExecutableOperations', () => {
		it('should filter only Valid operations', () => {
			const ops = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Valid, description: 'a' },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Invalid, description: 'b' },
			];
			const plan = createPlan('Plan', ops);
			const executable = filterExecutableOperations(plan);
			expect(executable).toHaveLength(1);
			expect(executable[0]!.id).toBe('op1');
		});
	});

	describe('topologicalSort', () => {
		it('should return operations in dependency order', () => {
			const ops: Operation[] = [
				{ id: 'op3', type: OperationType.RewriteReference, status: OperationStatus.Pending, description: 'third', dependencies: ['op2'] },
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'first' },
				{ id: 'op2', type: OperationType.RewriteReference, status: OperationStatus.Pending, description: 'second', dependencies: ['op1'] },
			];
			const result = topologicalSort(ops);
			expect(result).toHaveLength(3);
			expect(result[0]!.id).toBe('op1');
			expect(result[1]!.id).toBe('op2');
			expect(result[2]!.id).toBe('op3');
		});

		it('should handle circular dependencies gracefully', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'a', dependencies: ['op2'] },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Pending, description: 'b', dependencies: ['op1'] },
			];
			const result = topologicalSort(ops);
			expect(result).toHaveLength(2);
		});

		it('should handle no dependencies', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'a' },
				{ id: 'op2', type: OperationType.Download, status: OperationStatus.Pending, description: 'b' },
			];
			const result = topologicalSort(ops);
			expect(result).toHaveLength(2);
		});
	});

	describe('generatePreview', () => {
		it('should generate preview text', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Valid, description: 'Download image' },
				{ id: 'op2', type: OperationType.RewriteReference, status: OperationStatus.Valid, description: 'Rewrite ref' },
			];
			const plan = createPlan('Test Plan', ops);
			const preview = generatePreview(plan);
			expect(preview).toContain('Test Plan');
			expect(preview).toContain('Download image');
			expect(preview).toContain('Rewrite ref');
		});

		it('should include warnings in preview', () => {
			const plan = createPlan('Plan with warnings', []);
			plan.warnings = ['Something happened'];
			const preview = generatePreview(plan);
			expect(preview).toContain('Something happened');
		});
	});

	describe('estimateDuration', () => {
		it('should estimate duration for downloads', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1' },
			];
			expect(estimateDuration(ops)).toBe(2000);
		});

		it('should estimate duration for mixed operations', () => {
			const ops: Operation[] = [
				{ id: 'op1', type: OperationType.Download, status: OperationStatus.Pending, description: 'd1' },
				{ id: 'op2', type: OperationType.RewriteReference, status: OperationStatus.Pending, description: 'r1' },
			];
			expect(estimateDuration(ops)).toBe(2100);
		});

		it('should return 0 for empty operations', () => {
			expect(estimateDuration([])).toBe(0);
		});
	});
});