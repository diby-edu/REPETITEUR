// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

const ORIGINAL_ENV = { ...process.env }

function setTestEnv() {
  Object.assign(process.env, {
    PAYDUNYA_MODE: 'test',
    PAYDUNYA_MASTER_KEY: 'mk',
    PAYDUNYA_PRIVATE_KEY: 'pk',
    PAYDUNYA_PUBLIC_KEY: 'pubk',
    PAYDUNYA_TOKEN: 'tok',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    NEXT_PUBLIC_APP_URL: 'https://monrepetiteur.test',
  })
}

function makeRequest({ body, token } = {}) {
  return new Request('http://localhost/api/payments/paydunya/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
}

describe('POST /api/payments/paydunya/initiate', () => {
  let POST

  beforeEach(async () => {
    vi.resetModules()
    setTestEnv()
    mockGetUser.mockReset()
    global.fetch = vi.fn()
    ;({ POST } = await import('../route.js'))
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('rejette une requête sans en-tête Authorization (401)', async () => {
    const res = await POST(makeRequest({ body: { planId: 'premium' } }))
    expect(res.status).toBe(401)
  })

  it('rejette un en-tête Authorization malformé (sans "Bearer ", improbable) comme non authentifié', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: { Authorization: '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'premium' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejette un token invalide/expiré (401)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const res = await POST(makeRequest({ body: { planId: 'premium' }, token: 'bad-token' }))
    expect(res.status).toBe(401)
  })

  it('rejette un planId inconnu (400)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(makeRequest({ body: { planId: 'plan-qui-nexiste-pas' }, token: 'good' }))
    expect(res.status).toBe(400)
  })

  it('rejette le plan gratuit — un plan à prix 0 ne doit jamais générer de facture PayDunya', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(makeRequest({ body: { planId: 'gratuit' }, token: 'good' }))
    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejette une requête sans planId du tout (improbable)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(makeRequest({ body: {}, token: 'good' }))
    expect(res.status).toBe(400)
  })

  it('ignore un prix falsifié envoyé par le client et recalcule le vrai prix du plan', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-real-id' } }, error: null })
    global.fetch.mockResolvedValue({ json: async () => ({ response_code: '00', token: 'pd-token-123' }) })

    await POST(makeRequest({
      body: { planId: 'standard', price: 1, planName: 'Standard', tutorId: 'un-autre-id-injecte' },
      token: 'good',
    }))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, options] = global.fetch.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.invoice.total_amount).toBe(3000)
    expect(payload.invoice.items.item_0.unit_price).toBe('3000')
  })

  it('dérive le tutorId du token de session, jamais du body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-real-id' } }, error: null })
    global.fetch.mockResolvedValue({ json: async () => ({ response_code: '00', token: 'pd-token-123' }) })

    await POST(makeRequest({
      body: { planId: 'premium', tutorId: 'quelquun-dautre' },
      token: 'good',
    }))

    const [, options] = global.fetch.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.custom_data.tutor_id).toBe('tutor-real-id')
  })

  it('renvoie l\'URL de paiement si PayDunya répond correctement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-1' } }, error: null })
    global.fetch.mockResolvedValue({ json: async () => ({ response_code: '00', token: 'abc' }) })
    const res = await POST(makeRequest({ body: { planId: 'premium' }, token: 'good' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.checkoutUrl).toContain('abc')
  })

  it('renvoie une erreur 400 si PayDunya rejette la création de facture', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-1' } }, error: null })
    global.fetch.mockResolvedValue({ json: async () => ({ response_code: '01', response_text: 'clé invalide' }) })
    const res = await POST(makeRequest({ body: { planId: 'premium' }, token: 'good' }))
    expect(res.status).toBe(400)
  })

  it('ne plante pas sur un corps JSON invalide (renvoie 500 plutôt qu\'une exception non gérée)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-1' } }, error: null })
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: { Authorization: 'Bearer good', 'Content-Type': 'application/json' },
      body: 'pas-du-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('ne plante pas si PayDunya (fetch) échoue réseau', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'tutor-1' } }, error: null })
    global.fetch.mockRejectedValue(new Error('network down'))
    const res = await POST(makeRequest({ body: { planId: 'premium' }, token: 'good' }))
    expect(res.status).toBe(500)
  })
})
