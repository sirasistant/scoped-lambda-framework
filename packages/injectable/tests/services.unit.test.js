import {
	Context, LIFECYCLE_SCOPES, logger, setLogger,
} from 'scoped-lambda-context';
import createTestLogger from './testLogger';
import Injectable, { TRANSIENT_SCOPE } from '../src/injectable';
import Inject from '../src/inject';
import Service from '../src/service';
import getInjectable from '../src/getInjectable';
import AutoRegisterInjectable from '../src/autoRegisterInjectable';

class StoreDeps {
	constructor(...deps) {
		this.deps = deps;
	}
}
beforeAll(() => {
	setLogger(createTestLogger());
	logger.level = 'info';
});

it('Should inject dependencies', async () => {
	@AutoRegisterInjectable
	@Injectable({
		dependencies: ['fakeSharedDependency', 'fakeSecondLevelDependency'],
	})
	class FakeTopLevelDependency extends StoreDeps {}

	@AutoRegisterInjectable
	@Injectable()
	class FakeSecondLevelDependency extends StoreDeps {}

	@AutoRegisterInjectable
	@Injectable()
	class FakeSharedDependency extends StoreDeps {}

	class FakeLambda {
		@Inject('fakeTopLevelDependency', 'fakeSharedDependency')
		async processEvent() {
			expect(this.fakeTopLevelDependency instanceof FakeTopLevelDependency).toBeTruthy();
			expect(this.fakeSharedDependency instanceof FakeSharedDependency).toBeTruthy();
			expect(this.fakeTopLevelDependency.deps[0]).toBe(this.fakeSharedDependency);
			expect(this.fakeTopLevelDependency.deps[1] instanceof FakeSecondLevelDependency).toBeTruthy();
		}
	}
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();
		await fakeLambda.processEvent();
	});
});

it('Should attach injectables to the correct scopes', async () => {
	@AutoRegisterInjectable
	@Injectable({
		dependencies: ['fakeExecutionDependency'],
		scope: LIFECYCLE_SCOPES.EVENT,
	})
	class FakeEventDependency extends StoreDeps {}

	@AutoRegisterInjectable
	@Injectable()
	class FakeExecutionDependency extends StoreDeps {}

	class FakeLambda {
		@Inject('fakeEventDependency')
		async processEvent() {
			expect(this.fakeEventDependency instanceof FakeEventDependency).toBeTruthy();
			expect((await getInjectable('fakeExecutionDependency')) instanceof FakeExecutionDependency).toBeTruthy();
		}
	}
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();

		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			await fakeLambda.processEvent();
		});

		await expect(getInjectable('fakeEventDependency')).rejects
			.toThrow(new Error('Cannot locate scope EVENT of fakeEventDependency'));

		expect((await getInjectable('fakeExecutionDependency')) instanceof FakeExecutionDependency).toBeTruthy();
	});

	await expect(getInjectable('fakeExecutionDependency')).rejects
		.toThrow(new Error('Cannot locate scope EXECUTION of fakeExecutionDependency'));
});

it('Should fail with injectables that depend on others with higher scopes', async () => {
	@AutoRegisterInjectable
	@Injectable({
		scope: LIFECYCLE_SCOPES.EVENT,
	})
	class FakeEventDependency extends StoreDeps {}

	@AutoRegisterInjectable
	@Injectable({
		dependencies: ['fakeEventDependency'],
	})
	class FakeExecutionDependency extends StoreDeps {}

	class FakeLambda {
		@Inject('fakeExecutionDependency')
		async processEvent() {
		}
	}
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();

		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			await expect(fakeLambda.processEvent()).rejects.toThrow(new Error('Cannot locate injectable with scope EVENT within a scope EXECUTION'));
		});
	});
});

it('Should call lifecycle events in services built before the subcontext is started', async () => {
	let started = false;
	let ended = false;
	const customScope = 'TEST';
	@AutoRegisterInjectable
	@Injectable()
	class FakeDependency extends Service {
		async onTestContextStart() {
			started = true;
		}

		async onTestContextEnd() {
			ended = true;
		}
	}

	class FakeLambda {
		@Inject('fakeDependency')
		async processEvent() {
			await Context.startSubContext(customScope, async () => {
				expect(started).toBeTruthy();
			});
			expect(ended).toBeTruthy();
			return true;
		}
	}
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();

		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			expect(await fakeLambda.processEvent()).toBe(true);
		});
	});
});

it('Should handle transient injectables', async () => {
	@AutoRegisterInjectable
	@Injectable({
		scope: TRANSIENT_SCOPE,
	})
	class TransientDependency extends Service {}

	class FakeLambda {
		@Inject('transientDependency')
		async processEvent() {
			expect(this.transientDependency instanceof TransientDependency).toBeTruthy();
			const freshTransientInjectable = await getInjectable('transientDependency');
			expect(freshTransientInjectable instanceof TransientDependency).toBeTruthy();
			expect(freshTransientInjectable).not.toBe(this.transientDependency);
		}
	}

	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();

		await Context.startSubContext(LIFECYCLE_SCOPES.EVENT, async () => {
			await fakeLambda.processEvent();
		});
	});
});

it('Should throw if injecting unknown injectables', async () => {
	class FakeLambda {
		@Inject('unexistingDependency')
		async processEvent() {}
	}

	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const fakeLambda = new FakeLambda();

		await expect(fakeLambda.processEvent()).rejects.toThrow(new Error('Unknown injectable unexistingDependency'));
	});
});

it('Should handle misusing injectable decorator', async () => {
	class FakeLambda {
		@AutoRegisterInjectable
		@Injectable
		async processEvent() {}
	}
	await Context.startSubContext(LIFECYCLE_SCOPES.EXECUTION, async () => {
		const lambda = new FakeLambda();

		await lambda.processEvent();

		await expect(getInjectable('processEvent')).rejects.toThrow(new Error('Unknown injectable processEvent'));
	});
});
