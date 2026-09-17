import { expect, it } from 'vitest'
import { pixelDensity } from '../../src/platform/display/pixel-density'
it('renders Retina at 2x without changing logical dimensions or exceeding the pixel budget', () => {
  expect(pixelDensity(768,1024,2)).toBe(2)
  expect(pixelDensity(1024,768,3)).toBe(2)
  expect(pixelDensity(768,900,1)).toBe(1)
  expect(pixelDensity(768,900,NaN)).toBe(1)
  expect(2000 * 1500 * pixelDensity(2000,1500,3) ** 2).toBeLessThanOrEqual(4_194_305)
})
