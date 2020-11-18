import cls from 'cls-hooked';
import Context from '../src/context';
import LIFECYCLE_SCOPES from '../src/lifecycleScopes';
import logger, { setLogger } from '../src/logger';
import createTestLogger from './testLogger';

beforeAll(() => {
	setLogger(createTestLogger());
	logger.level = 'info';
});

it('Should not be constructable', async () => {
	expect(() => new Context()).toThrow();
});

it('Should allow to create hierarchical contexts', async () => {
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		Context.setContextVariable('foo', 'bar');
		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			Context.setContextVariable('foo', 'baz');
			await Promise.all(new Array(5).fill().map((_, idx) => Context.startSubContext(LIFECYCLE_SCOPES.RECORD, async () => {
				Context.setContextVariable('alias', `next${idx}`);
				await (async () => {
					expect(Context.getContextVariable('alias')).toBe(`next${idx}`);
					expect([...Context.getContextHierarchy()].map((ctx) => Context.getContextName(ctx))).toEqual([
						LIFECYCLE_SCOPES.RECORD,
						LIFECYCLE_SCOPES.EVENT,
						LIFECYCLE_SCOPES.EXECUTION,
					]);
				})();
			})));
			expect(Context.getContextVariable('alias')).not.toBeDefined();
			expect(Context.getContextVariable('foo')).toBe('baz');
		});
		expect(Context.getContextVariable('foo')).toBe('bar');
	});
});

it('Should call lifecycle events', async () => {
	const variableWithLifecycle = {
		onContextStart: jest.fn(() => Promise.resolve()),
		onContextEnd: jest.fn(() => Promise.resolve()),
	};
	let executionContext;
	let eventContext;
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		executionContext = Context.getCurrentContext();
		Context.setContextVariable('foo', variableWithLifecycle);
		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			eventContext = Context.getCurrentContext();
		});
	});
	expect(variableWithLifecycle.onContextStart.mock.calls).toEqual([
		[LIFECYCLE_SCOPES.EVENT, eventContext, executionContext],
	]);
	expect(variableWithLifecycle.onContextEnd.mock.calls).toEqual([
		[LIFECYCLE_SCOPES.EVENT, eventContext, executionContext],
		[LIFECYCLE_SCOPES.EXECUTION, executionContext, null],
	]);
});

it('should be able to bind functions to parent contexts', () => {
	const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
	const parentBoundGetter = Context.bindToParentContext(() => Context.getContextVariable('foo'), parentContext);
	const parentBoundSetter = Context.bindToParentContext((value) => Context.setContextVariable('foo', value), parentContext);
	parentBoundSetter('bar');
	expect(parentBoundGetter()).toBe('bar');
});

it('should be able to bind functions to non-parent contexts', async () => {
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		expect(() => Context.bindToParentContext(() => {}, Context.getCurrentContext())).toThrow(
			new Error('Cannot bind to non-parent context'),
		);
	});
});

it('bound functions should have context associated in exceptions', () => {
	const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
	const parentBoundRejector = Context.bindToParentContext(() => { throw new Error('foo'); }, parentContext);
	expect(cls.ERROR_SYMBOL).toBeDefined();
	try {
		parentBoundRejector();
		expect.fail();
	} catch (err) {
		expect(err[cls.ERROR_SYMBOL]).toBe(parentContext); // eslint-disable-line jest/no-conditional-expect, jest/no-try-expect
	}
});

it('bound functions should handle falsy exceptions', () => {
	const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
	const parentBoundRejector = Context.bindToParentContext(() => { throw null; }, parentContext); // eslint-disable-line no-throw-literal
	try {
		parentBoundRejector();
		expect.fail();
	} catch (err) {
		expect(err).toBe(null); // eslint-disable-line jest/no-conditional-expect, jest/no-try-expect
	}
});
