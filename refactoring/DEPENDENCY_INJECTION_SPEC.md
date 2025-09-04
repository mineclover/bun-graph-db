# 의존성 주입 시스템 상세 설계

> **이 문서는 [REFACTOR_SPECIFICATION.md](./REFACTOR_SPECIFICATION.md)의 의존성 주입 부분을 상세히 다룹니다.**

## 🎯 DI 전환 목표

현재 Service Locator 패턴(안티패턴)을 실제 Dependency Injection 패턴으로 변경하여 결합도를 낮추고 테스트 용이성을 향상

## 📋 현재 상태 분석

### 문제점 1: Service Locator 패턴 (안티패턴)
```typescript
// 현재: DependencyContainer.ts - Service Locator 패턴
export class DependencyContainer {
  private static instance: DependencyContainer  // Singleton
  private dependencies = new Map<string, any>() // 전역 상태

  // 문제: 클래스들이 컨테이너에 직접 의존
  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer()
    }
    return DependencyContainer.instance
  }

  // 문제: 타입 안전성 부족, 런타임 에러 가능성
  resolve<T>(name: string): T {
    const instance = this.dependencies.get(name)
    if (!instance) {
      throw new Error(`Dependency '${name}' not registered`)
    }
    return instance as T
  }
}
```

### 문제점 2: 강결합된 Repository 생성
```typescript
// 현재: Repository들이 Database 객체에 직접 의존
private registerDependencies(): void {
  const database = dbConnection.getDatabase() // Bun SQLite 타입
  
  // 문제: Repository가 구체적인 Database 구현체에 의존
  const nodeRepository = new SqliteNodeRepository(database)
  const tableRepository = new SqliteTableRepository(database)
}
```

### 문제점 3: Use Case의 과도한 의존성
```typescript
// 현재: Use Case 생성자에 너무 많은 의존성
const createNodeUseCase = new CreateNodeUseCase(
  nodeRepository,           // 1
  nodeAttributeRepository,  // 2
  tableRepository,         // 3
  attributeRepository,     // 4
  logger                   // 5
)
```

## 🏗️ 새로운 DI 구조 설계

### 1. Core DI Container

#### IDIContainer Interface
```typescript
export interface IDIContainer {
  // 서비스 등록
  register<T>(token: ServiceToken<T>, provider: ServiceProvider<T>): void
  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void
  registerTransient<T>(token: ServiceToken<T>, factory: () => T): void
  registerInstance<T>(token: ServiceToken<T>, instance: T): void
  
  // 서비스 해결
  resolve<T>(token: ServiceToken<T>): T
  resolveOptional<T>(token: ServiceToken<T>): T | null
  
  // 스코프 관리
  createScope(): IDIContainer
  dispose(): Promise<void>
  
  // 검증
  validateRegistrations(): ValidationResult[]
}

// Type-safe service tokens
export class ServiceToken<T> {
  constructor(
    public readonly name: string,
    public readonly description?: string
  ) {}
  
  toString(): string {
    return this.name
  }
}

export type ServiceProvider<T> = {
  useFactory: () => T
  dependencies?: ServiceToken<any>[]
} | {
  useClass: new (...args: any[]) => T
  dependencies?: ServiceToken<any>[]
} | {
  useValue: T
}
```

#### DIContainer 구현체
```typescript
export class DIContainer implements IDIContainer {
  private services = new Map<ServiceToken<any>, ServiceRegistration<any>>()
  private instances = new Map<ServiceToken<any>, any>()
  private scopes = new Set<DIContainer>()
  private disposed = false

  register<T>(token: ServiceToken<T>, provider: ServiceProvider<T>): void {
    if (this.disposed) {
      throw new DIError('Container has been disposed')
    }

    this.services.set(token, {
      token,
      provider,
      lifetime: ServiceLifetime.TRANSIENT
    })
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    this.services.set(token, {
      token,
      provider: { useFactory: factory },
      lifetime: ServiceLifetime.SINGLETON
    })
  }

  resolve<T>(token: ServiceToken<T>): T {
    if (this.disposed) {
      throw new DIError('Cannot resolve from disposed container')
    }

    // 이미 생성된 싱글톤 인스턴스 확인
    if (this.instances.has(token)) {
      return this.instances.get(token)!
    }

    const registration = this.services.get(token)
    if (!registration) {
      throw new DIError(`Service '${token.name}' is not registered`)
    }

    // 의존성 해결 및 인스턴스 생성
    const instance = this.createInstance(registration)
    
    // 싱글톤인 경우 캐시
    if (registration.lifetime === ServiceLifetime.SINGLETON) {
      this.instances.set(token, instance)
    }

    return instance
  }

  private createInstance<T>(registration: ServiceRegistration<T>): T {
    const { provider } = registration

    if ('useValue' in provider) {
      return provider.useValue
    }

    if ('useFactory' in provider) {
      // 의존성 주입을 통한 팩토리 호출
      const dependencies = provider.dependencies || []
      const resolvedDeps = dependencies.map(dep => this.resolve(dep))
      return provider.useFactory(...resolvedDeps)
    }

    if ('useClass' in provider) {
      // 생성자 주입을 통한 클래스 인스턴스 생성
      const dependencies = provider.dependencies || []
      const resolvedDeps = dependencies.map(dep => this.resolve(dep))
      return new provider.useClass(...resolvedDeps)
    }

    throw new DIError('Invalid service provider configuration')
  }

  createScope(): IDIContainer {
    const scope = new DIContainer()
    
    // 부모 컨테이너의 등록 정보 상속
    for (const [token, registration] of this.services) {
      scope.services.set(token, { ...registration })
    }
    
    this.scopes.add(scope)
    return scope
  }

  async dispose(): Promise<void> {
    if (this.disposed) return

    // 하위 스코프들 정리
    for (const scope of this.scopes) {
      await scope.dispose()
    }

    // Disposable 인스턴스들 정리
    for (const instance of this.instances.values()) {
      if (instance && typeof instance.dispose === 'function') {
        await instance.dispose()
      }
    }

    this.services.clear()
    this.instances.clear()
    this.scopes.clear()
    this.disposed = true
  }
}

enum ServiceLifetime {
  TRANSIENT = 'transient',
  SINGLETON = 'singleton'
}

interface ServiceRegistration<T> {
  token: ServiceToken<T>
  provider: ServiceProvider<T>
  lifetime: ServiceLifetime
}
```

### 2. Service Tokens 정의

#### DatabaseTokens.ts
```typescript
// Database 관련 service token들
export const DatabaseTokens = {
  Connection: new ServiceToken<IDatabaseConnection>('IDatabaseConnection'),
  Config: new ServiceToken<DatabaseConfig>('DatabaseConfig'),
  Provider: new ServiceToken<DatabaseProvider>('DatabaseProvider')
} as const
```

#### RepositoryTokens.ts
```typescript
// Repository 관련 service token들  
export const RepositoryTokens = {
  Table: new ServiceToken<ITableRepository>('ITableRepository'),
  Node: new ServiceToken<INodeRepository>('INodeRepository'),
  Attribute: new ServiceToken<IAttributeRepository>('IAttributeRepository'),
  AttributeType: new ServiceToken<IAttributeTypeRepository>('IAttributeTypeRepository'),
  NodeAttribute: new ServiceToken<INodeAttributeRepository>('INodeAttributeRepository'),
  NodeRelation: new ServiceToken<INodeRelationRepository>('INodeRelationRepository'),
  RelationType: new ServiceToken<IRelationTypeRepository>('IRelationTypeRepository'),
  QueryTemplate: new ServiceToken<IQueryTemplateRepository>('IQueryTemplateRepository')
} as const
```

#### UseCaseTokens.ts
```typescript
// Use Case 관련 service token들
export const UseCaseTokens = {
  CreateTable: new ServiceToken<CreateTableUseCase>('CreateTableUseCase'),
  CreateNode: new ServiceToken<CreateNodeUseCase>('CreateNodeUseCase'),
  SearchNodes: new ServiceToken<SearchNodesUseCase>('SearchNodesUseCase'),
  CreateRelation: new ServiceToken<CreateRelationUseCase>('CreateRelationUseCase'),
  // ... 기타 use case들
} as const
```

### 3. Module 기반 등록 시스템

#### DatabaseModule.ts
```typescript
export class DatabaseModule {
  static register(container: IDIContainer): void {
    // Database Configuration
    container.registerInstance(
      DatabaseTokens.Config,
      this.createDatabaseConfig()
    )

    // Database Connection (Singleton)
    container.registerSingleton(
      DatabaseTokens.Connection,
      () => {
        const config = container.resolve(DatabaseTokens.Config)
        return DatabaseProviderFactory.create(config.provider, config)
      }
    )
  }

  private static createDatabaseConfig(): DatabaseConfig {
    return {
      provider: (process.env.DATABASE_PROVIDER as DatabaseProvider) || 'bun-sqlite',
      path: process.env.DATABASE_PATH || './data/bun-graph-db.sqlite',
      d1Database: globalThis.DB, // Cloudflare Worker에서 자동 주입
      options: {
        enableWAL: process.env.NODE_ENV === 'production',
        timeout: parseInt(process.env.DATABASE_TIMEOUT || '30000')
      }
    }
  }
}
```

#### RepositoryModule.ts
```typescript
export class RepositoryModule {
  static register(container: IDIContainer): void {
    // Table Repository
    container.register(
      RepositoryTokens.Table,
      {
        useClass: DatabaseTableRepository,
        dependencies: [DatabaseTokens.Connection, CommonTokens.Logger]
      }
    )

    // Node Repository  
    container.register(
      RepositoryTokens.Node,
      {
        useClass: DatabaseNodeRepository,
        dependencies: [DatabaseTokens.Connection, CommonTokens.Logger]
      }
    )

    // Attribute Repository
    container.register(
      RepositoryTokens.Attribute,
      {
        useClass: DatabaseAttributeRepository,
        dependencies: [DatabaseTokens.Connection, CommonTokens.Logger]
      }
    )

    // ... 기타 repository들
  }
}
```

#### UseCaseModule.ts
```typescript  
export class UseCaseModule {
  static register(container: IDIContainer): void {
    // Create Table Use Case
    container.register(
      UseCaseTokens.CreateTable,
      {
        useClass: CreateTableUseCase,
        dependencies: [
          RepositoryTokens.Table,
          CommonTokens.Logger
        ]
      }
    )

    // Create Node Use Case
    container.register(
      UseCaseTokens.CreateNode,
      {
        useClass: CreateNodeUseCase,
        dependencies: [
          RepositoryTokens.Node,
          RepositoryTokens.NodeAttribute,
          RepositoryTokens.Table,
          RepositoryTokens.Attribute,
          CommonTokens.Logger
        ]
      }
    )

    // ... 기타 use case들
  }
}
```

### 4. Container 조립

#### ContainerBootstrap.ts
```typescript
export class ContainerBootstrap {
  static createContainer(): IDIContainer {
    const container = new DIContainer()

    // Core modules registration
    this.registerCoreModules(container)
    
    // Application modules registration  
    this.registerApplicationModules(container)
    
    // Infrastructure modules registration
    this.registerInfrastructureModules(container)
    
    // Presentation modules registration
    this.registerPresentationModules(container)

    // Validate all registrations
    const validationResults = container.validateRegistrations()
    if (validationResults.length > 0) {
      throw new DIError('Container validation failed', validationResults)
    }

    return container
  }

  private static registerCoreModules(container: IDIContainer): void {
    // Logger
    container.registerSingleton(
      CommonTokens.Logger,
      () => new ConsoleLogger(
        process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
        true
      )
    )

    // Configuration
    ConfigurationModule.register(container)
  }

  private static registerApplicationModules(container: IDIContainer): void {
    UseCaseModule.register(container)
  }

  private static registerInfrastructureModules(container: IDIContainer): void {
    DatabaseModule.register(container)
    RepositoryModule.register(container)
  }

  private static registerPresentationModules(container: IDIContainer): void {
    GraphQLModule.register(container)
  }
}
```

### 5. Repository 의존성 주입 적용

#### Before (현재)
```typescript
export class SqliteNodeRepository implements INodeRepository {
  constructor(private db: Database) {} // 구체적인 Bun Database 타입
}
```

#### After (DI 적용)
```typescript
export class DatabaseNodeRepository implements INodeRepository {
  constructor(
    private connection: IDatabaseConnection, // 추상화된 인터페이스
    private logger: ILogger
  ) {}

  async create(node: Node): Promise<Node> {
    this.logger.debug('DatabaseNodeRepository.create', { node })
    
    try {
      const result = await this.connection.execute(`
        INSERT INTO nodes (table_id, content, title, description) 
        VALUES (?, ?, ?, ?)
      `, [node.tableId, node.content, node.title, node.description])

      const created = await this.connection.queryFirst<NodeRow>(`
        SELECT * FROM nodes WHERE id = ?
      `, [result.lastInsertRowid])

      return this.mapToEntity(created!)
    } catch (error) {
      this.logger.error('Failed to create node', { error, node })
      throw new RepositoryException('Failed to create node', error)
    }
  }
}
```

### 6. GraphQL Resolver DI 적용

#### GraphQLModule.ts
```typescript
export class GraphQLModule {
  static register(container: IDIContainer): void {
    // Query Resolvers
    container.register(
      GraphQLTokens.TableQueries,
      {
        useClass: TableQueries,
        dependencies: [
          RepositoryTokens.Table,
          UseCaseTokens.CreateTable,
          CommonTokens.Logger
        ]
      }
    )

    // Mutation Resolvers
    container.register(
      GraphQLTokens.TableMutations,
      {
        useClass: TableMutations,
        dependencies: [
          UseCaseTokens.CreateTable,
          UseCaseTokens.UpdateTable,
          UseCaseTokens.DeleteTable,
          CommonTokens.Logger
        ]
      }
    )

    // Schema Builder
    container.register(
      GraphQLTokens.SchemaBuilder,
      {
        useFactory: () => {
          const dependencies: SchemaBuilderDependencies = {
            tableRepository: container.resolve(RepositoryTokens.Table),
            nodeRepository: container.resolve(RepositoryTokens.Node),
            // ... 기타 의존성들
            logger: container.resolve(CommonTokens.Logger)
          }
          return new GraphQLSchemaBuilder(dependencies)
        }
      }
    )
  }
}
```

### 7. Application 진입점 수정

#### index.ts (새로운 구조)
```typescript
import { ContainerBootstrap } from './src/infrastructure/container/ContainerBootstrap.js'
import { GraphQLTokens } from './src/infrastructure/container/tokens/GraphQLTokens.js'
import { createYoga } from 'graphql-yoga'

async function main() {
  // DI Container 생성
  const container = ContainerBootstrap.createContainer()

  try {
    // GraphQL Schema 빌드
    const schemaBuilder = container.resolve(GraphQLTokens.SchemaBuilder)
    const schema = schemaBuilder.build()

    // Logger 가져오기
    const logger = container.resolve(CommonTokens.Logger)

    // GraphQL Yoga 서버 설정
    const yoga = createYoga({
      schema,
      logging: {
        debug: (...args) => logger.debug('GraphQL Debug', { args }),
        info: (...args) => logger.info('GraphQL Info', { args }),
        warn: (...args) => logger.warn('GraphQL Warning', { args }),
        error: (...args) => logger.error('GraphQL Error', { args }),
      },
      cors: true,
      graphiql: true
    })

    // 서버 시작
    const server = Bun.serve({
      fetch: yoga,
      port: 4000,
      hostname: '0.0.0.0',
    })

    logger.info(`🚀 Server ready at http://localhost:4000${yoga.graphqlEndpoint}`)

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Server shutting down...')
      
      try {
        server.stop()
        await container.dispose() // DI Container 정리
        logger.info('✅ Server stopped successfully')
      } catch (error) {
        logger.error('❌ Error during shutdown', { error })
      }
      
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

  } catch (error) {
    const logger = container.resolve(CommonTokens.Logger)
    logger.error('💥 Failed to start server', { error })
    await container.dispose()
    process.exit(1)
  }
}

main().catch(console.error)
```

## 🔄 Migration Plan

### Phase 1: DI Container 구현
1. `IDIContainer` 인터페이스 정의
2. `DIContainer` 구현체 작성
3. Service Token 시스템 구현
4. 기본적인 등록/해결 기능 테스트

### Phase 2: Token 및 Module 시스템
1. 모든 Service Token 정의
2. Module 기반 등록 시스템 구현
3. `ContainerBootstrap` 구현
4. 의존성 검증 시스템 추가

### Phase 3: Repository Layer 변경
1. Repository들을 추상화된 인터페이스 기반으로 수정
2. DI를 통한 생성자 주입 적용
3. 기존 테스트 케이스 수정

### Phase 4: Application Layer 변경  
1. Use Case들의 DI 적용
2. GraphQL Resolver들의 DI 적용
3. 진입점(`index.ts`) 수정

### Phase 5: 기존 Container 제거
1. 기존 `DependencyContainer` 제거
2. 관련 참조들 모두 수정
3. 통합 테스트 실행

## 🎯 기대 효과

1. **낮은 결합도**: 구체적인 구현체가 아닌 인터페이스에 의존
2. **높은 테스트성**: Mock 객체 주입으로 단위 테스트 용이
3. **타입 안전성**: Service Token을 통한 컴파일 타임 타입 체크
4. **확장성**: 새로운 구현체 추가가 용이
5. **설정 관리**: 환경별 다른 구현체 주입 가능
6. **리소스 관리**: 자동 생명주기 관리 및 정리
7. **검증**: 컨테이너 등록 상태 검증 가능

## ⚠️ 주의사항

1. **Breaking Changes**: 모든 클래스의 생성자 변경 필요
2. **순환 의존성**: Service Token 정의 시 순환 참조 주의
3. **성능**: DI로 인한 약간의 성능 오버헤드
4. **복잡성**: 초기 학습 곡선 존재
5. **디버깅**: 의존성 해결 과정에서 디버깅이 어려울 수 있음
6. **메모리**: 싱글톤 인스턴스들의 메모리 사용량 고려