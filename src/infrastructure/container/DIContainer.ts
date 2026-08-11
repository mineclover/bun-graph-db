/**
 * Dependency Injection Container
 * Type-safe container for managing application dependencies
 */

export type ServiceToken<_T = unknown> = symbol | string

export interface ServiceRegistration<T = unknown> {
  token: ServiceToken<T>
  factory: ServiceFactory<T>
  singleton: boolean
  dependencies: ServiceToken[]
}

export type ServiceFactory<T = unknown> = (container: DIContainer) => T | Promise<T>

type DisposableService = {
  dispose?: () => void | Promise<void>
  close?: () => void | Promise<void>
  [Symbol.dispose]?: () => void
  [Symbol.asyncDispose]?: () => Promise<void>
}

export class DIContainer {
  private registrations = new Map<ServiceToken, ServiceRegistration>()
  private singletonInstances = new Map<ServiceToken, unknown>()
  private ownedSingletonTokens = new Set<ServiceToken>()
  private pendingSingletons = new Map<ServiceToken, Promise<unknown>>()
  private disposePromise: Promise<void> | undefined
  private disposed = false

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, dependencies: ServiceToken[] = []): void {
    this.registrations.set(token, {
      token,
      factory,
      singleton: false,
      dependencies,
    })
  }

  /**
   * Register a singleton service (same instance each time)
   */
  registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, dependencies: ServiceToken[] = []): void {
    this.registrations.set(token, {
      token,
      factory,
      singleton: true,
      dependencies,
    })
  }

  /**
   * Register an instance as a singleton
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): void {
    this.singletonInstances.set(token, instance)
    this.ownedSingletonTokens.add(token)
    this.registrations.set(token, {
      token,
      factory: () => instance,
      singleton: true,
      dependencies: [],
    })
  }

  /**
   * Resolve a service by token
   */
  async resolve<T>(token: ServiceToken<T>): Promise<T> {
    if (this.disposed) {
      throw new Error('Cannot resolve a service from a disposed container')
    }
    return this.resolveWithChain(token, [])
  }

  private async resolveWithChain<T>(token: ServiceToken<T>, resolutionChain: ServiceToken[]): Promise<T> {
    // Check singleton cache first
    if (this.singletonInstances.has(token)) {
      return this.singletonInstances.get(token) as T
    }

    // Check for circular dependencies
    if (resolutionChain.includes(token)) {
      const stackArray = [...resolutionChain, token].map((t) => String(t))
      throw new Error(
        `Circular dependency detected for token: ${String(token)}\nDependency chain: ${stackArray.join(' -> ')}`,
      )
    }

    const registration = this.registrations.get(token)
    if (!registration) {
      throw new Error(`Service not registered for token: ${String(token)}`)
    }

    if (registration.singleton && this.pendingSingletons.has(token)) {
      return this.pendingSingletons.get(token) as Promise<T>
    }

    const nextChain = [...resolutionChain, token]
    const resolutionContext = this.createResolutionContext(nextChain)

    const instancePromise = (async () => {
      // Resolve dependencies first
      const _dependencyInstances = await Promise.all(
        registration.dependencies.map((depToken) => this.resolveWithChain(depToken, nextChain)),
      )

      // Create instance
      const instance = await registration.factory(resolutionContext)

      // Cache singleton
      if (registration.singleton) {
        this.singletonInstances.set(token, instance)
        this.ownedSingletonTokens.add(token)
      }

      return instance
    })()

    if (registration.singleton) {
      this.pendingSingletons.set(token, instancePromise)
    }

    try {
      return (await instancePromise) as T
    } finally {
      if (registration.singleton) {
        this.pendingSingletons.delete(token)
      }
    }
  }

  private createResolutionContext(resolutionChain: ServiceToken[]): DIContainer {
    const container = this

    return {
      resolve<T>(token: ServiceToken<T>) {
        return container.resolveWithChain(token, resolutionChain)
      },
      isRegistered<T>(token: ServiceToken<T>) {
        return container.isRegistered(token)
      },
      getRegisteredTokens() {
        return container.getRegisteredTokens()
      },
      createChild() {
        return container.createChild()
      },
    } as DIContainer
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.registrations.has(token)
  }

  /**
   * Get all registered tokens
   */
  getRegisteredTokens(): ServiceToken[] {
    return Array.from(this.registrations.keys())
  }

  /**
   * Clear all registrations and instances
   */
  clear(): void {
    this.registrations.clear()
    this.singletonInstances.clear()
    this.ownedSingletonTokens.clear()
    this.pendingSingletons.clear()
  }

  /**
   * Releases singleton resources in reverse creation order. Services may expose
   * `Symbol.asyncDispose`, `dispose`, `close`, or `Symbol.dispose`; this keeps
   * infrastructure adapters such as Bun's SQLite connection out of shutdown
   * wiring in individual transports.
   */
  dispose(): Promise<void> {
    if (!this.disposePromise) {
      this.disposed = true
      this.disposePromise = this.disposeSingletons()
    }
    return this.disposePromise
  }

  private async disposeSingletons(): Promise<void> {
    await Promise.allSettled(this.pendingSingletons.values())

    const instances = Array.from(this.ownedSingletonTokens)
      .reverse()
      .map((token) => this.singletonInstances.get(token))
    const disposedInstances = new Set<unknown>()
    this.clear()

    const errors: unknown[] = []
    for (const instance of instances) {
      if (disposedInstances.has(instance)) {
        continue
      }
      disposedInstances.add(instance)
      try {
        await disposeService(instance)
      } catch (error) {
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Failed to dispose one or more container services')
    }
  }

  /**
   * Create a child container that inherits parent registrations
   */
  createChild(): DIContainer {
    if (this.disposed) {
      throw new Error('Cannot create a child from a disposed container')
    }
    const child = new DIContainer()

    // Copy parent registrations
    for (const [token, registration] of this.registrations) {
      child.registrations.set(token, registration)
    }

    // Copy singleton instances
    for (const [token, instance] of this.singletonInstances) {
      child.singletonInstances.set(token, instance)
    }

    return child
  }
}

async function disposeService(instance: unknown): Promise<void> {
  if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) {
    return
  }

  const disposable = instance as DisposableService
  const asyncDispose = disposable[Symbol.asyncDispose]
  if (asyncDispose) {
    await asyncDispose.call(disposable)
    return
  }
  if (disposable.dispose) {
    await disposable.dispose()
    return
  }
  if (disposable.close) {
    // Prefer an explicit graceful close to a synchronous disposal hook. Bun's
    // Database Symbol.dispose performs strict close(true), which rejects while
    // prepared statements are still unwinding; close() uses deferred close.
    await disposable.close()
    return
  }
  const syncDispose = disposable[Symbol.dispose]
  if (syncDispose) {
    syncDispose.call(disposable)
  }
}
