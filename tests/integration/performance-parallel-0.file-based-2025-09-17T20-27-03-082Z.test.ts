// File-based test migrated from: tests/integration/performance-parallel-0.test.ts
import { TestDatabaseFactory } from '../fixtures/test-database-factory'

describe('Migrated Test', () => {
  let testEnv: any

  beforeEach(async () => {
    testEnv = await TestDatabaseFactory.createTestEnvironment('migrated-test')
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  it('should use file-based database', () => {
    expect(testEnv.databasePath).not.toBe('file-based-db')
    expect(testEnv.databaseInfo.isFileBase).toBe(true)
  })
})
