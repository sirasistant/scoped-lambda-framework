import { Context, LIFECYCLE_SCOPES } from 'scoped-lambda-context';

export default class SimpleWrapper {
	static wrapClass(clazz, ...opts) {
		const parentContext = Context.createParentContext(LIFECYCLE_SCOPES.EXECUTION);
		const { externalInterface } = new SimpleWrapper(clazz, parentContext, ...opts);
		return externalInterface;
	}

	constructor(Clazz, parentContext) {
		this.parentContextInitialized = false;
		this.instance = new Clazz();
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
		);
	}

	async handleAwsEvent(event, awsContext) {
		await this.initializeEventContext(event, awsContext);
		return this.instance.processEvent(event, awsContext);
	}

	async initializeParentContext() {
		this.parentContextInitialized = true;
	}

	async initializeEventContext() {

	}
}
