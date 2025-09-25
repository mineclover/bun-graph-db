// File-based test migrated from: tests/fixtures/enhanced-test-isolation-helpers.ts
import { createTestEnvironment } from '../fixtures/test-database-factory'

describe('Migrated Test', () => {
  let testEnv: any

  beforeEach(async () => {
    testEnv = await createTestEnvironment('migrated-test')
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  it('should use file-based database', () => {
    expect(testEnv.databasePath).not.toBe('file-based-db')
    expect(testEnv.databaseInfo.type).toBe('file')
  })
})
