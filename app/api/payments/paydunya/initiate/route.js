import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLANS } from '../../../../../src/data/constants'

const isLive = process.env.PAYDUNYA_MODE === 'live'

const PAYDUNYA_BASE = isLive
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1'

const CHECKOUT_BASE = isLive
  ? 'https://app.paydunya.com/checkout/invoice'
  : 'https://app.paydunya.com/sandbox-checkout/invoice'

const pdHeaders = {
  'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
  'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
  'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY,
  'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN,
  'Content-Type': 'application/json',
}

// Client anon — sert uniquement à vérifier le token du tuteur connecté.
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    // Le tuteur est dérivé de sa session authentifiée, jamais du body —
    // sinon n'importe qui peut initier un paiement pour un autre tutorId.
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
    }

    // Le prix est recalculé depuis SUBSCRIPTION_PLANS, jamais reçu du client —
    // sinon un prix falsifié produit une facture PayDunya légitime pour ce montant.
    const { planId } = await request.json()
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId)
    if (!plan || !(plan.price > 0)) {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 })
    }

    const tutorId = user.id
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Remise filleul (−X % sur le 1er mois payant) si éligible — calculée
    // côté serveur via une RPC, jamais reçue du client.
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    let discountPct = 0
    try {
      const { data } = await supabaseUser.rpc('referee_discount_for_me')
      discountPct = Number(data) || 0
    } catch { /* remise ignorée si indisponible */ }
    const price = discountPct > 0
      ? Math.max(1, Math.round(plan.price * (100 - discountPct) / 100))
      : plan.price
    const label = discountPct > 0
      ? `Abonnement ${plan.name} — MonRépétiteur (−${discountPct}% parrainage)`
      : `Abonnement ${plan.name} — MonRépétiteur`

    const payload = {
      invoice: {
        items: {
          item_0: {
            name: label,
            quantity: 1,
            unit_price: String(price),
            total_price: String(price),
            description: `Abonnement mensuel ${plan.name}`,
          },
        },
        total_amount: price,
        description: `Abonnement ${plan.name} MonRépétiteur`,
      },
      store: {
        name: 'MonRépétiteur',
        tagline: "La plateforme des répétiteurs en Côte d'Ivoire",
        postal_address: 'Abidjan, Côte d\'Ivoire',
      },
      actions: {
        cancel_url: `${appUrl}/abonnement`,
        return_url: `${appUrl}/abonnement?status=success&plan=${plan.id}`,
        callback_url: `${appUrl}/api/payments/paydunya/webhook`,
      },
      custom_data: {
        tutor_id: tutorId,
        plan: plan.id,
      },
    }

    const res = await fetch(`${PAYDUNYA_BASE}/checkout-invoice/create`, {
      method: 'POST',
      headers: pdHeaders,
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.response_code !== '00') {
      return NextResponse.json(
        { error: data.response_text || 'Erreur PayDunya' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      checkoutUrl: `${CHECKOUT_BASE}/${data.token}`,
      token: data.token,
    })
  } catch (err) {
    console.error('[PayDunya initiate]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
