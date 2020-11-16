import Context from '../../src/context';
import logger, { setLogger } from '../../src/logger';
import SimpleWrapper from '../../src/wrappers/simpleWrapper';
import createTestLogger from '../testLogger';

beforeAll(() => {
	setLogger(createTestLogger());
	logger.level = 'info';
});

it('Parent context should be the same for executions of the same lambda', async () => {
	class TestLambda {
		processEvent() {
			return [...Context.getContextHierarchy()].reverse();
		}
	}
	const wrapped = SimpleWrapper.wrapClass(TestLambda);
	const firstCallContexts = await wrapped();
	expect(firstCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	const secondCallContexts = await wrapped();
	expect(secondCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	// Execution context should be the same
	expect(firstCallContexts[0]).toBe(secondCallContexts[0]);
	// Event context should not be the same
	expect(firstCallContexts[1]).not.toBe(secondCallContexts[1]);
});
