import { describe, it, expect } from 'vitest'
import { deriveDocumentsStatus, buildRejectionReason, computeIsActive } from '../verification'

const approved = { status: 'approved' }
const rejected = (reason = 'motif') => ({ status: 'rejected', reason })
const pending = { status: 'pending' }

describe('deriveDocumentsStatus', () => {
  it('retourne "pending" pour un dossier vide', () => {
    expect(deriveDocumentsStatus({})).toBe('pending')
  })

  it('retourne "pending" pour null/undefined sans planter', () => {
    expect(deriveDocumentsStatus(null)).toBe('pending')
    expect(deriveDocumentsStatus(undefined)).toBe('pending')
  })

  it('ne vérifie jamais un dossier sans aucun diplôme, même id+selfie approuvés', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [] }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('ne vérifie jamais un dossier sans champ diplomes du tout', () => {
    const docs = { idReview: approved, selfieReview: approved }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('vérifie un dossier complet : id + selfie + 1 diplôme tous approuvés', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [{ review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('verified')
  })

  it('vérifie un dossier avec plusieurs diplômes tous approuvés', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [{ review: approved }, { review: approved }, { review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('verified')
  })

  it('reste "pending" si un seul diplôme parmi plusieurs est encore en attente', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [{ review: approved }, { review: pending }] }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('rejette tout le dossier si un seul diplôme est rejeté, même les autres approuvés', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [{ review: approved }, { review: rejected() }] }
    expect(deriveDocumentsStatus(docs)).toBe('rejected')
  })

  it('rejette tout le dossier si seule la pièce d\'identité est rejetée', () => {
    const docs = { idReview: rejected(), selfieReview: pending, diplomes: [] }
    expect(deriveDocumentsStatus(docs)).toBe('rejected')
  })

  it('rejette tout le dossier si seul le selfie est rejeté', () => {
    const docs = { idReview: approved, selfieReview: rejected(), diplomes: [{ review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('rejected')
  })

  it('le rejet prime toujours sur l\'approbation, quel que soit l\'ordre des documents', () => {
    const docs = { idReview: rejected(), selfieReview: approved, diplomes: [{ review: approved }, { review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('rejected')
  })

  it('traite un statut de revue inconnu ("foo") comme non-approuvé, sans planter', () => {
    const docs = { idReview: { status: 'foo' }, selfieReview: approved, diplomes: [{ review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('est sensible à la casse : "Approved" n\'est pas reconnu comme "approved"', () => {
    const docs = { idReview: { status: 'Approved' }, selfieReview: approved, diplomes: [{ review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('ne plante pas si diplomes n\'est pas un tableau', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: null }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('ne plante pas si un élément du tableau diplomes est null/undefined (donnée corrompue)', () => {
    const docs = { idReview: approved, selfieReview: approved, diplomes: [null, { review: approved }, undefined] }
    expect(() => deriveDocumentsStatus(docs)).not.toThrow()
    // un slot corrompu = "pending" => bloque la vérification totale
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })

  it('traite une review présente sans champ status comme "pending"', () => {
    const docs = { idReview: {}, selfieReview: approved, diplomes: [{ review: approved }] }
    expect(deriveDocumentsStatus(docs)).toBe('pending')
  })
})

describe('buildRejectionReason', () => {
  it('retourne une chaîne vide si rien n\'est rejeté', () => {
    expect(buildRejectionReason({ idReview: approved, selfieReview: approved, diplomes: [{ review: approved }] })).toBe('')
  })

  it('retourne une chaîne vide pour un dossier vide/null', () => {
    expect(buildRejectionReason({})).toBe('')
    expect(buildRejectionReason(null)).toBe('')
  })

  it('inclut le motif de la pièce d\'identité rejetée', () => {
    const reason = buildRejectionReason({ idReview: rejected('photo floue') })
    expect(reason).toContain("Pièce d'identité : photo floue")
  })

  it('inclut le motif du selfie rejeté', () => {
    const reason = buildRejectionReason({ selfieReview: rejected('visage non visible') })
    expect(reason).toBe('Selfie : visage non visible')
  })

  it('inclut le nom du diplôme rejeté avec son motif', () => {
    const reason = buildRejectionReason({ diplomes: [{ name: 'LICENCE MATHS', review: rejected('illisible') }] })
    expect(reason).toBe('Diplôme "LICENCE MATHS" : illisible')
  })

  it('utilise un nom de secours si le diplôme rejeté n\'a pas de nom (donnée improbable)', () => {
    const reason = buildRejectionReason({ diplomes: [{ review: rejected('illisible') }] })
    expect(reason).toBe('Diplôme "#1" : illisible')
  })

  it('combine plusieurs motifs séparés par " — ", dans l\'ordre id / selfie / diplômes', () => {
    const reason = buildRejectionReason({
      idReview: rejected('CNI expirée'),
      selfieReview: rejected('flou'),
      diplomes: [{ name: 'BAC', review: rejected('faux document') }],
    })
    expect(reason).toBe("Pièce d'identité : CNI expirée — Selfie : flou — Diplôme \"BAC\" : faux document")
  })

  it('ignore les diplômes approuvés ou en attente, ne liste que les rejetés', () => {
    const reason = buildRejectionReason({
      diplomes: [
        { name: 'OK', review: approved },
        { name: 'EN ATTENTE', review: pending },
        { name: 'KO', review: rejected('mauvais') },
      ],
    })
    expect(reason).toBe('Diplôme "KO" : mauvais')
  })
})

describe('computeIsActive', () => {
  it('actif : vérifié + abonnement payant actif', () => {
    expect(computeIsActive('verified', { status: 'active', plan: 'premium' })).toBe(true)
    expect(computeIsActive('verified', { status: 'active', plan: 'standard' })).toBe(true)
  })

  it('inactif si le plan est gratuit, même vérifié et "actif"', () => {
    expect(computeIsActive('verified', { status: 'active', plan: 'gratuit' })).toBe(false)
  })

  it('inactif si l\'abonnement n\'est pas actif (expiré)', () => {
    expect(computeIsActive('verified', { status: 'expired', plan: 'premium' })).toBe(false)
  })

  it('inactif si non vérifié, quel que soit l\'abonnement', () => {
    expect(computeIsActive('pending', { status: 'active', plan: 'premium' })).toBe(false)
    expect(computeIsActive('rejected', { status: 'active', plan: 'premium' })).toBe(false)
  })

  it('ne plante pas si subscription est absent/undefined', () => {
    expect(computeIsActive('verified', undefined)).toBe(false)
    expect(computeIsActive('verified', null)).toBe(false)
  })

  it('ne plante pas si overallStatus est absent/inattendu', () => {
    expect(computeIsActive(undefined, { status: 'active', plan: 'premium' })).toBe(false)
    expect(computeIsActive('quelquechose', { status: 'active', plan: 'premium' })).toBe(false)
  })
})
