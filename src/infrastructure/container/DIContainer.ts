/**
 * Dependency Injection Container
 * Type-safe container for managing application dependencies
 */

export type ServiceToken<T = any> = symbol | string

export interface ServiceRegistration<T = any> {
  token: ServiceToken<T>
  factory: ServiceFactory<T>
  singleton: boolean
  dependencies: ServiceToken[]
}

export type ServiceFactory<T = any> = (container: DIContainer) => T | Promise<T>

export class DIContainer {
  private registrations = new Map<ServiceToken, ServiceRegistration>()
  private singletonInstances = new Map<ServiceToken, any>()
  private resolutionStack = new Set<ServiceToken>()

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    dependencies: ServiceToken[] = []
  ): void {
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
  registerSingleton<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    dependencies: ServiceToken[] = []
  ): void {
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
    // Check singleton cache first
    if (this.singletonInstances.has(token)) {
      return this.singletonInstances.get(token)
    }

    // Check for circular dependencies
    if (this.resolutionStack.has(token)) {
      const stackArray = Array.from(this.resolutionStack).map(t => String(t))
      throw new Error(`Circular dependency detected for token: ${String(token)}\nDependency chain: ${stackArray.join(' -> ')} -> ${String(token)}`)
    }

    const registration = this.registrations.get(token)
    if (!registration) {
      throw new Error(`Service not registered for token: ${String(token)}`)
    }

    this.resolutionStack.add(token)

    try {
      // Resolve dependencies first
      const dependencyInstances = await Promise.all(
        registration.dependencies.map((depToken) => this.resolve(depToken))
      )

      // Create instance
      const instance = await registration.factory(this)

      // Cache singleton
      if (registration.singleton) {
        this.singletonInstances.set(token, instance)
      }

      return instance
    } finally {
      this.resolutionStack.delete(token)
    }
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
    this.resolutionStack.clear()
  }

  /**
   * Create a child container that inherits parent registrations
   */
  createChild(): DIContainer {
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
