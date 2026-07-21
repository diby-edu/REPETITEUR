'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

import { SUBSCRIPTION_PLANS } from '../data/constants'
import { StatusBadge } from '../components/common/Badge'
import { CheckCircle, Star, Zap, CreditCard, X, Shield, AlertCircle, Clock } from 'lucide-react'
import { formatFCFA, formatDateShort, getSubscriptionDaysLeft } from '../utils/helpers'
import DashboardLayout from '../components/layout/DashboardLayout'

export default function SubscriptionPage() {
  const { currentUser, refreshCurrentUser } = useAuth()
  const { updateTutorSubscription } = useApp()
  const router = useRouter()
  const [confirmModal, setConfirmModal] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Détecter le retour depuis PayDunya
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('status') === 'success') {
      setPaymentPending(true)
      router.replace('/abonnement')
    }
  }, [])

  const sub = currentUser?.subscription
  const daysLeft = getSubscriptionDaysLeft(sub?.endDate)
  const currentPlan = sub?.plan || 'gratuit'

  const handleChoosePlan = (planId) => {
    if (planId === currentPlan && sub?.status === 'active') return
    setConfirmModal(planId)
  }

  const handleConfirm = async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === confirmModal)
    setProcessing(true)
    setPaymentError('')

    // Plan gratuit → pas de paiement
    if (plan.price === 0) {
      await updateTutorSubscription(currentUser.id, confirmModal)
      await refreshCurrentUser()
      setProcessing(false)
      setConfirmModal(null)
      setSuccess(true)
      return
    }

    // Plan payant → PayDunya
    try {
      const res = await fetch('/api/payments/paydunya/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          tutorId: currentUser.id,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Erreur lors de la création du paiement')
      }

      // Rediriger vers la page de paiement PayDunya
      window.location.href = data.checkoutUrl
    } catch (err) {
      console.error(err)
      setPaymentError(err.message || 'Erreur de paiement. Réessayez.')
      setProcessing(false)
    }
  }

  const planToConfirm = SUBSCRIPTION_PLANS.find(p => p.id === confirmModal)

  return (
    <DashboardLayout>
      {/* Payment modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                <CreditCard size={22} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {planToConfirm?.price === 0 ? 'Plan Gratuit' : 'Paiement sécurisé'}
                </h3>
                <p className="text-sm text-gray-500">Plan {planToConfirm?.name}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold">{planToConfirm?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Durée</span>
                <span className="font-semibold">1 mois</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-primary text-lg">{formatFCFA(planToConfirm?.price || 0)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
              <Shield size={12} />
              {planToConfirm?.price === 0
                ? 'Plan gratuit — aucun paiement requis'
                : 'Vous serez redirigé vers PayDunya pour payer par mobile money'}
            </div>
            {paymentError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{paymentError}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} disabled={processing} className="btn-outline flex-1 text-sm">
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={processing}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : planToConfirm?.price === 0 ? (
                  'Activer le plan gratuit'
                ) : (
                  <>Payer {formatFCFA(planToConfirm?.price || 0)} →</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Choisissez votre abonnement</h1>
          <p className="text-gray-500">Développez votre activité de répétiteur avec le bon plan</p>
        </div>

        {/* Current plan */}
        {sub && (
          <div className="card mb-8 bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Votre abonnement actuel</p>
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-bold text-xl text-gray-900">Plan {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}</h3>
                  <StatusBadge status={sub.status} />
                </div>
                {sub.status === 'active' && (
                  <p className="text-sm text-gray-500 mt-1">
                    Expire le <span className="font-semibold text-gray-700">{formatDateShort(sub.endDate)}</span>
                    {' '}(<span className={daysLeft <= 5 ? 'text-red-500 font-semibold' : 'text-gray-600'}>{daysLeft} jours restants</span>)
                  </p>
                )}
              </div>
              {daysLeft <= 10 && sub.status === 'active' && (
                <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-xl">
                  <Zap size={14} />
                  Renouvelez bientôt pour rester visible
                </div>
              )}
            </div>
          </div>
        )}

        {paymentPending && (
          <div className="card mb-6 border-blue-200 bg-blue-50">
            <div className="flex items-start gap-3">
              <Clock size={22} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800">Paiement reçu — activation en cours</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Votre abonnement sera activé dans quelques instants. Rechargez la page si votre statut ne change pas après 1 minute.
                </p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="card mb-6 border-green-200 bg-green-50">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle size={22} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Félicitations ! Votre profil est maintenant visible.</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Abonnement actif jusqu'au <strong>{formatDateShort(currentUser.subscription?.endDate)}</strong>.
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                Important : si vous ne renouvelez pas avant cette date —
              </p>
              <ul className="space-y-1 text-xs text-yellow-700">
                <li>• Votre profil disparaît des recherches</li>
                <li>• Vos avis et votre note deviennent invisibles</li>
                <li>• Les parents qui vous ont en favoris voient « ce répétiteur n'est plus disponible sur MonRépétiteur »</li>
              </ul>
            </div>
          </div>
        )}

        {/* Ce que vous perdez sans abonnement actif */}
        {(!sub || sub.status !== 'active') && (
          <div className="card mb-8 border-orange-200 bg-orange-50">
            <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
              Sans abonnement actif, vous perdez :
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                'Profil invisible dans les recherches',
                'Vos avis et votre note masqués',
                'Les parents favoris voient « plus disponible »',
                'Vos demandes en cours suspendues',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <X size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-orange-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {SUBSCRIPTION_PLANS.map(plan => {
            const isCurrent = currentPlan === plan.id
            const isRecommended = plan.recommended

            return (
              <div
                key={plan.id}
                className={`card relative flex flex-col ${
                  isRecommended
                    ? 'border-2 border-primary shadow-card-hover'
                    : isCurrent
                    ? 'border-2 border-secondary'
                    : ''
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star size={10} fill="white" /> Recommandé
                    </span>
                  </div>
                )}

                {isCurrent && sub?.status === 'active' && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full">
                      Actuel
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="font-display font-bold text-xl text-gray-900 mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{formatFCFA(plan.price)}</span>
                    {plan.price > 0 && <span className="text-gray-400 text-sm">/ mois</span>}
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                  {plan.restrictions.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <X size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-400">{r}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={isCurrent && sub?.status === 'active'}
                  className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${
                    isRecommended
                      ? 'bg-primary text-white hover:bg-primary-600'
                      : isCurrent && sub?.status === 'active'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'btn-outline'
                  }`}
                >
                  {isCurrent && sub?.status === 'active' ? 'Plan actuel' :
                   plan.price === 0 ? 'Commencer gratuitement' : `Choisir ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>

        {/* Payment methods note */}
        <div className="card bg-gray-50 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-3">Méthodes de paiement disponibles</p>
          <div className="flex flex-wrap justify-center gap-3 mb-3">
            {['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave', 'Virement bancaire'].map(m => (
              <span key={m} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full font-medium text-gray-600">
                {m}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Le paiement est simulé dans cette démo. En production, vous pouvez payer via mobile money ou virement.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
