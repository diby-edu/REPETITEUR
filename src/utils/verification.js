// Logique de dérivation du statut de vérification d'un répétiteur à partir
// des décisions individuelles par document. Extrait de AppContext.jsx pour
// être testable indépendamment de React/Supabase — c'est la logique la plus
// sensible en termes de sécurité de l'application (elle décide qui devient
// visible dans les recherches), elle doit rester correcte sous tous les cas.

// Un dossier n'est "vérifié" que si TOUS les documents soumis (pièce
// d'identité, selfie, chaque diplôme) sont individuellement approuvés, et
// qu'au moins un diplôme a été soumis. Un seul document rejeté (peu importe
// lequel) rejette tout le dossier.
export function deriveDocumentsStatus(documents) {
  const docs = documents || {}
  const idStatus = docs.idReview?.status || 'pending'
  const selfieStatus = docs.selfieReview?.status || 'pending'
  const diplomas = docs.diplomes || []
  const diplomaStatuses = diplomas.map(d => d?.review?.status || 'pending')
  const allStatuses = [idStatus, selfieStatus, ...diplomaStatuses]

  if (allStatuses.some(s => s === 'rejected')) return 'rejected'
  if (allStatuses.every(s => s === 'approved') && diplomas.length > 0) return 'verified'
  return 'pending'
}

// Compose un message lisible listant chaque pièce rejetée et son motif,
// pour affichage au répétiteur (persisté dans tutors.rejection_reason).
export function buildRejectionReason(documents) {
  const docs = documents || {}
  const reasons = []
  if (docs.idReview?.status === 'rejected') reasons.push(`Pièce d'identité : ${docs.idReview.reason}`)
  if (docs.selfieReview?.status === 'rejected') reasons.push(`Selfie : ${docs.selfieReview.reason}`)
  ;(docs.diplomes || []).forEach((d, i) => {
    if (d?.review?.status === 'rejected') reasons.push(`Diplôme "${d.name || `#${i + 1}`}" : ${d.review.reason}`)
  })
  return reasons.join(' — ')
}

// Un tuteur n'est actif (visible dans les recherches) que s'il est vérifié
// ET sur un abonnement payant actif — le plan gratuit ne débloque jamais la
// visibilité, quel que soit le statut de vérification.
export function computeIsActive(overallStatus, subscription) {
  return overallStatus === 'verified'
    && subscription?.status === 'active'
    && subscription?.plan !== 'gratuit'
}
