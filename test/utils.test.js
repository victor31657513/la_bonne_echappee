import { describe, it, expect } from 'vitest'
import { closestIdx } from '../src/utils.js'

describe('closestIdx', () => {
  it('returns index of closest point', () => {
    const path = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 }
    ]
    const cpos = { x: 1.2, z: 0 }
    expect(closestIdx(cpos, path)).toBe(1)
  })
})
