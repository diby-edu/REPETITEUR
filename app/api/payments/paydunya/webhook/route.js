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

    // Vérifier si le répétiteur est vérifié (pour mettre is_active à true)
    const { data: tutor } = await supabaseAdmin
      .from('tutors')
      .select('verification_status')
      .eq('id', tutorId)
      .single()

    const isVerified = tutor?.verification_status === 'verified'

    // Calculer les dates (1 mois)
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    const endDateStr = endDate.toISOString().split('T')[0]

    // Activer l'abonnement dans Supabase
    const { error } = await supabaseAdmin
      .from('tutors')
      .update({
        subscription_plan: plan,
        subscription_start: startDate,
        subscription_end: endDateStr,
        subscription_status: 'active',
        is_active: isVerified,
      })
      .eq('id', tutorId)

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
