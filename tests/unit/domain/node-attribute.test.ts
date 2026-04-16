import { describe, expect, it } from 'bun:test'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'

describe('NodeAttribute', () => {
  it('sanitizes unsafe object keys when parsing stored JSON values', () => {
    const nodeAttribute = NodeAttribute.create(
      'node-1',
      'attr-1',
      '{"safe":true,"__proto__":{"polluted":true},"nested":{"constructor":{"prototype":{"polluted":true}}}}',
    )

    const parsed = nodeAttribute.getParsedValue()

    expect(parsed).toEqual({
      safe: true,
      nested: {},
    })
    expect(Object.hasOwn(parsed, '__proto__')).toBe(false)
  })
})
