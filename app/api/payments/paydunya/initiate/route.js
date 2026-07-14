import { NextResponse } from 'next/server'

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

export async function POST(request) {
  try {
    const { planId, planName, price, tutorId } = await request.json()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const payload = {
      invoice: {
        items: {
          item_0: {
            name: `Abonnement ${planName} — MonRépétiteur`,
            quantity: 1,
            unit_price: String(price),
            total_price: String(price),
            description: `Abonnement mensuel ${planName}`,
          },
        },
        total_amount: price,
        description: `Abonnement ${planName} MonRépétiteur`,
      },
      store: {
        name: 'MonRépétiteur',
        tagline: "La plateforme des répétiteurs en Afrique de l'Ouest",
        postal_address: 'Abidjan, Côte d\'Ivoire',
      },
      actions: {
        cancel_url: `${appUrl}/abonnement`,
        return_url: `${appUrl}/abonnement?status=success&plan=${planId}`,
        callback_url: `${appUrl}/api/payments/paydunya/webhook`,
      },
      custom_data: {
        tutor_id: tutorId,
        plan: planId,
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
