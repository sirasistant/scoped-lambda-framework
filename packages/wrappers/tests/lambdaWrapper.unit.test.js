import { Context, logger, setLogger } from 'scoped-lambda-context';
import createTestLogger from './testLogger';
import LambdaWrapper from '../src/lambdaWrapper';

const invokedFunctionArn = 'arn:aws:lambda:region:account:function:functionName:alias';

beforeAll(() => {
	setLogger(createTestLogger());
	logger.level = 'info';
	process.env.ACCOUNT_ID = 'ACCOUNT_ID';
	process.env.AWS_REGION = 'REGION';
	process.env.STAGE = 'STAGE';
	process.env.AWS_LAMBDA_FUNCTION_VERSION = '42';
});

it('Should have the same EXECUTION context for executions of the same lambda', async () => {
	class TestLambda {
		processEvent() {
			return [...Context.getContextHierarchy()].reverse();
		}
	}
	const wrapped = LambdaWrapper.wrapClass(TestLambda);
	const firstCallContexts = await wrapped({}, { invokedFunctionArn });
	expect(firstCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	const secondCallContexts = await wrapped({}, { invokedFunctionArn });
	expect(secondCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	// Execution context should be the same
	expect(firstCallContexts[0]).toBe(secondCallContexts[0]);
	// Event context should not be the same
	expect(firstCallContexts[1]).not.toBe(secondCallContexts[1]);
});
