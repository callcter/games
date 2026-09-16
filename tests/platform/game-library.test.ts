import { expect, it, vi } from 'vitest'
import { CATEGORIES, categoryOf, readRecent, rememberRecent } from '../../src/app/library'
it('categorizes known games and keeps recent entries unique and bounded', () => {
  const store = new Map<string,string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string,value: string) => store.set(key,value) })
  const allowed = ['sudoku','memory','maze','pipes','tangram']
  for(const id of allowed) rememberRecent(id,allowed)
  rememberRecent('memory',allowed); rememberRecent('invalid',allowed)
  expect(readRecent(allowed)).toEqual(['memory','tangram','pipes','maze'])
  expect(categoryOf('sudoku')).toBe('logic')
  expect(CATEGORIES.some(category => category.id === categoryOf('tangram'))).toBe(true)
  vi.unstubAllGlobals()
})
it('works when local storage is blocked or malformed', () => {
  vi.stubGlobal('localStorage', { getItem: () => '{', setItem: () => { throw new Error('blocked') } })
  expect(readRecent(['sudoku'])).toEqual([])
  expect(() => rememberRecent('sudoku',['sudoku'])).not.toThrow()
  vi.unstubAllGlobals()
})
