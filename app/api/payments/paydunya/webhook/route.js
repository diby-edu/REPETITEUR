import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isLive = process.env.PAYDUNYA_MODE === 'live'

const PAYDUNYA_BASE = isLive
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1'

const pdHeaders = {
  'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
  'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
  'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY,
  'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN,
}

// Client admin (service role) pour bypasser le RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    // PayDunya envoie le token dans body.data.hash
    const token = body.data?.hash

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    // Vérifier le paiement auprès de PayDunya
    const verifyRes = await fetch(`${PAYDUNYA_BASE}/checkout-invoice/confirm/${token}`, {
      headers: pdHeaders,
    })
    const invoice = await verifyRes.json()

    // Ignorer si paiement pas encore complété
    if (invoice.response_code !== '00' || invoice.status !== 'completed') {
      return NextResponse.json({ status: 'ignored' })
    }

    const tutorId = invoice.custom_data?.tutor_id
    const plan = invoice.custom_data?.plan

    if (!tutorId || !plan) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Activer l'abonnement PAYANT via la RPC : gère is_active + dates, et
    // déclenche le parrainage (qualifie le filleul, applique les mois offerts
    // en réserve, marque le 1er paiement).
    const { error } = await supabaseAdmin.rpc('activate_paid_subscription', {
      p_tutor: tutorId, p_plan: plan, p_months: 1,
    })

    if (error) {
      console.error('[PayDunya webhook] Supabase error:', error)
      return NextResponse.json({ error: 'Erreur Supabase' }, { status: 500 })
    }

    console.log(`[PayDunya webhook] Abonnement ${plan} activé pour ${tutorId}`)
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[PayDunya webhook]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
