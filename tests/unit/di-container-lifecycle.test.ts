import { describe, expect, test } from 'bun:test'
import { DIContainer } from '../../src/infrastructure/container/DIContainer'

describe('DIContainer lifecycle', () => {
  test('disposes owned singleton resources in reverse creation order', async () => {
    const container = new DIContainer()
    const calls: string[] = []
    const first = Symbol('first')
    const second = Symbol('second')

    container.registerSingleton(first, () => ({ close: () => calls.push('first') }))
    container.registerSingleton(second, () => ({ dispose: () => calls.push('second') }))

    await container.resolve(first)
    await container.resolve(second)
    await container.dispose()

    expect(calls).toEqual(['second', 'first'])
    await expect(container.resolve(first)).rejects.toThrow('disposed container')
  })

  test('does not dispose singleton instances inherited by a child container', async () => {
    const parent = new DIContainer()
    const token = Symbol('shared')
    const calls: string[] = []

    parent.registerInstance(token, { close: () => calls.push('parent') })
    const inheritedChild = parent.createChild()

    await inheritedChild.dispose()
    expect(calls).toEqual([])

    await parent.dispose()
    expect(calls).toEqual(['parent'])
  })
})
