import { describe, expect, test } from 'vitest'
import { WebCryptoHmac } from '../../src/infrastructure/WebCryptoHmac'
import { RecordVisit } from '../../src/usecases/RecordVisit'
import { FakeVisitReporter } from '../support/fakes'

describe('RecordVisit', () => {
  test('reporta la visita con el visitante anónimo, nunca la IP', async () => {
    const reporter = new FakeVisitReporter()
    await new RecordVisit(reporter, new WebCryptoHmac(), 'salt').execute({
      ip: '1.2.3.4', userAgent: 'Android', origin: { country: 'CO', asn: 3816 }, sala: '123', versionId: 'v1',
    })
    expect(reporter.visits).toHaveLength(1)
    expect(reporter.visits[0]).toMatchObject({ visitor: '54141d36667ccb701eb8e36f34855d2b', version_id: 'v1', country: 'CO', asn: 3816, user_agent: 'Android', session_code: '123' })
    expect(JSON.stringify(reporter.visits)).not.toContain('1.2.3.4')
  })

  test('sin sal o sin IP el visitante va en null', async () => {
    const reporter = new FakeVisitReporter()
    await new RecordVisit(reporter, new WebCryptoHmac(), undefined).execute({ ip: '1.2.3.4', userAgent: null, origin: {}, sala: null, versionId: 1 })
    await new RecordVisit(reporter, new WebCryptoHmac(), 'salt').execute({ ip: null, userAgent: null, origin: {}, sala: null, versionId: 1 })
    expect(reporter.visits.map(v => v.visitor)).toEqual([null, null])
  })
})
