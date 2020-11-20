import { Context, LIFECYCLE_SCOPES, logger } from 'scoped-lambda-context';

export default class LambdaWrappper {
	static wrapClass(clazz, ...clazzConstructionOpts) {
		const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
		const { externalInterface } = new LambdaWrappper(clazz, parentContext, clazzConstructionOpts);
		return externalInterface;
	}

	constructor(Clazz, parentContext, clazzConstructionOpts) {
		this.rootContextInitialized = false;
		this.instance = new Clazz(...clazzConstructionOpts);
		this.parentContext = parentContext;
		this.externalInterface = Context.bindToParentContext(this.externalInterface.bind(this), parentContext);
	}

	async externalInterface(event, awsContext) {
		if (!this.rootContextInitialized) {
			await this.initializeRootContext();
		}
		return Context.startSubContext(
			LIFECYCLE_SCOPES.EVENT,
			async () => this.handleAwsEvent(event, awsContext),
			async () => this.initializeEventContext(event, awsContext),
		);
	}

	async handleAwsEvent(event, awsContext) {
		logger.debug('Processing event', event, awsContext);
		return this.instance.processEvent(event, awsContext);
	}

	async initializeRootContext() {
		Context.setContextVariable('ACCOUNT_ID', process.env.ACCOUNT_ID);
		Context.setContextVariable('REGION', process.env.AWS_REGION);
		Context.setContextVariable('STAGE', process.env.STAGE);
		Context.setContextVariable('VERSION', process.env.AWS_LAMBDA_FUNCTION_VERSION);
		logger.debug('Initialized root context');
		this.rootContextInitialized = true;
	}

	async initializeEventContext(event, awsContext) {
		Context.setContextVariable('EVENT', event);
		Context.setContextVariable('AWS_EVENT_CONTEXT', awsContext);
		const { groups: { alias } } = awsContext.invokedFunctionArn
			.match(/^arn:aws:lambda:(?<region>.+):(?<accountId>.+):function:(?<functionName>.+):(?<alias>.+)$/);
		Context.setContextVariable('ALIAS', alias);
		Context.setContextVariable('EVENT_ALIAS', alias);
		logger.debug('Initialized event context');
	}
}
