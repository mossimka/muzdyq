import { describe, expect, it } from 'vitest'

import en from './locales/en.json'
import kk from './locales/kk.json'
import ru from './locales/ru.json'

type Json = { [key: string]: Json | string }

function flatten(value: Json, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === 'object'
      ? flatten(entry, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

function leaves(value: Json, prefix = ''): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === 'object'
      ? leaves(entry, `${prefix}${key}.`)
      : [[`${prefix}${key}`, entry]],
  )
}

describe('translation catalogues', () => {
  it('have exactly the same key set in en, ru and kk', () => {
    const english = flatten(en as Json).sort()
    expect(flatten(ru as Json).sort()).toEqual(english)
    expect(flatten(kk as Json).sort()).toEqual(english)
  })

  it('contain no empty strings', () => {
    for (const [locale, catalogue] of Object.entries({ en, ru, kk })) {
      for (const [key, text] of leaves(catalogue as Json)) {
        expect(text.trim(), `${locale}:${key}`).not.toBe('')
      }
    }
  })

  it('translate the interface into three languages', () => {
    expect(flatten(en as Json).length).toBeGreaterThan(300)
    expect((en as Json).locale).toBeDefined()
  })
})
