import { Context, LIFECYCLE_SCOPES } from 'scoped-lambda-context';

export default class LambdaWrappper {
	static wrapClass(clazz, ...clazzConstructionOpts) {
		const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
		const { externalInterface } = new LambdaWrappper(clazz, parentContext, clazzConstructionOpts);
		return externalInterface;
	}

	constructor(Clazz, parentContext, clazzConstructionOpts) {
		this.parentContextInitialized = false;
		this.instance = new Clazz(...clazzConstructionOpts);
		this.parentContext = parentContext;
		this.externalInterface = Context.bindToParentContext(this.externalInterface.bind(this), parentContext);
	}

	async externalInterface(event, awsContext) {
		if (!this.parentContextInitialized) {
			await this.initializeParentContext();
		}
		return Context.startSubContext(
			LIFECYCLE_SCOPES.EVENT,
			async () => this.handleAwsEvent(event, awsContext),
			async () => this.initializeEventContext(event, awsContext),
		);
	}

	async handleAwsEvent(event, awsContext) {
		return this.instance.processEvent(event, awsContext);
	}

	async initializeParentContext() {
		Context.setContextVariable('ACCOUNT_ID', process.env.ACCOUNT_ID);
		Context.setContextVariable('REGION', process.env.AWS_REGION);
		Context.setContextVariable('STAGE', process.env.STAGE);
		Context.setContextVariable('VERSION', process.env.AWS_LAMBDA_FUNCTION_VERSION);
		this.parentContextInitialized = true;
	}

	async initializeEventContext(event, awsContext) {
		Context.setContextVariable('EVENT', event);
		Context.setContextVariable('AWS_EVENT_CONTEXT', awsContext);
		const { alias } = awsContext.invokedFunctionArn
			.match(/^arn:aws:lambda:(?<region>.+):(?<accountId>.+):function:(?<functionName>.+):(?<alias>.+)$/);
		Context.setContextVariable('ALIAS', alias);
	}
}
