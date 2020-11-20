import { Context, logger, setLogger } from 'scoped-lambda-context';
import createTestLogger from './testLogger';
import LambdaWrapper from '../src/lambdaWrapper';

const invokedFunctionArn = 'arn:aws:lambda:eu-west-1:12345:function:functionName:invokedAlias';
const awsRequestId = 'requestId';

beforeAll(() => {
	setLogger(createTestLogger());
	logger.level = 'info';
	process.env.ACCOUNT_ID = '12345';
	process.env.AWS_REGION = 'eu-west-1';
	process.env.STAGE = 'STAGING';
	process.env.AWS_LAMBDA_FUNCTION_VERSION = '42';
});

it('Should have the same EXECUTION context for executions of the same lambda', async () => {
	class TestLambda {
		processEvent() {
			return [...Context.getContextHierarchy()].reverse();
		}
	}
	const wrapped = LambdaWrapper.wrapClass(TestLambda);
	const firstCallContexts = await wrapped({}, { invokedFunctionArn, awsRequestId: 'foo' });
	expect(firstCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	const secondCallContexts = await wrapped({}, { invokedFunctionArn, awsRequestId: 'bar' });
	expect(secondCallContexts.map((ctx) => Context.getContextName(ctx))).toEqual(['EXECUTION', 'EVENT']);
	// Execution context should be the same
	expect(firstCallContexts[0]).toBe(secondCallContexts[0]);
	// Event context should not be the same
	expect(firstCallContexts[1]).not.toBe(secondCallContexts[1]);
});

it('Should set the context variables', async () => {
	const event = { foo: 'bar' };
	const awsEventContext = { invokedFunctionArn, awsRequestId };
	class TestLambda {
		processEvent() {
			expect(Context.getContextVariable('ACCOUNT_ID')).toBe('12345');
			expect(Context.getContextVariable('REGION')).toBe('eu-west-1');
			expect(Context.getContextVariable('STAGE')).toBe('STAGING');
			expect(Context.getContextVariable('VERSION')).toBe('42');
			expect(Context.getContextVariable('EVENT')).toBe(event);
			expect(Context.getContextVariable('AWS_EVENT_CONTEXT')).toBe(awsEventContext);
			expect(Context.getContextVariable('ALIAS')).toBe('invokedAlias');
			expect(Context.getContextVariable('CORRELATION_ID')).toBe(awsRequestId);
		}
	}
	const wrapped = LambdaWrapper.wrapClass(TestLambda);
	await wrapped(event, awsEventContext);
});
