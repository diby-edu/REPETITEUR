import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatFCFA, formatDate, formatDateShort, formatTime, timeAgo,
  getInitials, getFullName, getSubscriptionDaysLeft, filterPhoneAndEmail,
  getStatusLabel, getVerificationStatusColor, getBookingStatusColor,
  getDayLabel, getLocationLabel, getRatingColor, truncate,
  getDocumentApprovalProgress,
} from '../helpers'

describe('formatFCFA', () => {
  // Intl.NumberFormat('fr-FR') utilise un espace insécable étroit (U+202F)
  // comme séparateur de milliers, pas un espace normal.
  const NBSP = ' '

  it('formate un montant normal avec séparateur de milliers', () => {
    expect(formatFCFA(25000)).toBe(`25${NBSP}000 FCFA`)
  })
  it('formate zéro', () => {
    expect(formatFCFA(0)).toBe('0 FCFA')
  })
  it('formate un grand montant', () => {
    expect(formatFCFA(1234567)).toBe(`1${NBSP}234${NBSP}567 FCFA`)
  })
  it('formate un montant négatif (improbable mais ne doit pas planter)', () => {
    expect(formatFCFA(-500)).toBe('-500 FCFA')
  })
  it('formate null comme 0', () => {
    expect(formatFCFA(null)).toBe('0 FCFA')
  })
})

describe('formatDate / formatDateShort / formatTime', () => {
  it('retourne une chaîne vide pour une entrée vide/null/undefined', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDateShort(null)).toBe('')
    expect(formatTime(null)).toBe('')
  })

  it('formatDate produit un jour, mois en toutes lettres, année', () => {
    expect(formatDate('2026-03-15')).toBe('15 mars 2026')
  })

  it('formatDateShort produit un format jj/mm/aaaa', () => {
    expect(formatDateShort('2026-03-05')).toBe('05/03/2026')
  })

  it('ne plante pas sur une date invalide (produit "Invalid Date" en sortie)', () => {
    expect(() => formatDate('pas-une-date')).not.toThrow()
    expect(formatDate('pas-une-date')).toMatch(/invalid date/i)
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourne une chaîne vide si aucun timestamp', () => {
    expect(timeAgo(null)).toBe('')
  })

  it('"à l\'instant" pour moins d\'une minute', () => {
    expect(timeAgo(new Date('2026-06-15T11:59:30Z').toISOString())).toBe("à l'instant")
  })

  it('affiche les minutes entre 1 et 59', () => {
    expect(timeAgo(new Date('2026-06-15T11:45:00Z').toISOString())).toBe('il y a 15 min')
  })

  it('bascule en heures à partir de 60 minutes', () => {
    expect(timeAgo(new Date('2026-06-15T11:00:00Z').toISOString())).toBe('il y a 1h')
  })

  it('affiche "hier" pour exactement 1 jour', () => {
    expect(timeAgo(new Date('2026-06-14T12:00:00Z').toISOString())).toBe('hier')
  })

  it('affiche le nombre de jours entre 2 et 6', () => {
    expect(timeAgo(new Date('2026-06-12T12:00:00Z').toISOString())).toBe('il y a 3 jours')
  })

  it('bascule sur la date formatée à partir de 7 jours', () => {
    expect(timeAgo(new Date('2026-06-01T12:00:00Z').toISOString())).toBe('01/06/2026')
  })

  it('ne plante pas sur un timestamp futur (improbable, horloge désynchronisée)', () => {
    expect(() => timeAgo(new Date('2026-06-16T12:00:00Z').toISOString())).not.toThrow()
  })
})

describe('getInitials', () => {
  it('retourne les initiales majuscules', () => {
    expect(getInitials('amadou', 'kone')).toBe('AK')
  })
  it('gère un prénom ou nom manquant', () => {
    expect(getInitials('Amadou', '')).toBe('A')
    expect(getInitials('', 'Koné')).toBe('K')
  })
  it('gère les deux manquants sans planter', () => {
    expect(getInitials(undefined, undefined)).toBe('')
    expect(getInitials(null, null)).toBe('')
  })
  it('gère les accents correctement', () => {
    expect(getInitials('émilie', 'écolier')).toBe('ÉÉ')
  })
})

describe('getFullName', () => {
  it('concatène prénom et nom', () => {
    expect(getFullName({ firstName: 'Awa', lastName: 'Koné' })).toBe('Awa Koné')
  })
  it('retourne une chaîne vide si user est null/undefined', () => {
    expect(getFullName(null)).toBe('')
    expect(getFullName(undefined)).toBe('')
  })
})

describe('getSubscriptionDaysLeft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('retourne 0 si aucune date de fin', () => {
    expect(getSubscriptionDaysLeft(null)).toBe(0)
  })
  it('retourne le nombre de jours restants, arrondi au supérieur', () => {
    expect(getSubscriptionDaysLeft('2026-06-25')).toBe(10)
  })
  it('ne retourne jamais un nombre négatif pour une date passée', () => {
    expect(getSubscriptionDaysLeft('2026-01-01')).toBe(0)
  })
})

describe('filterPhoneAndEmail', () => {
  it('masque un numéro de téléphone de 9 chiffres et plus', () => {
    expect(filterPhoneAndEmail('Appelez-moi au 0712345678 vite')).toContain('[numéro masqué]')
  })
  it('ne masque PAS un nombre court de 4 chiffres (sous le seuil de détection)', () => {
    expect(filterPhoneAndEmail('J\'ai eu 18/20 en maths')).toBe('J\'ai eu 18/20 en maths')
  })
  it('masque une adresse email', () => {
    expect(filterPhoneAndEmail('Contactez awa.kone@example.com')).toBe('Contactez [email masqué]')
  })
  it('masque téléphone et email dans le même message', () => {
    const out = filterPhoneAndEmail('Tel: 0712345678 ou email test@test.ci')
    expect(out).toContain('[numéro masqué]')
    expect(out).toContain('[email masqué]')
  })
  it('laisse un texte sans coordonnées inchangé', () => {
    expect(filterPhoneAndEmail('Bonjour, disponible mardi ?')).toBe('Bonjour, disponible mardi ?')
  })
  it('gère une chaîne vide sans planter', () => {
    expect(filterPhoneAndEmail('')).toBe('')
  })
})

describe('getStatusLabel / getVerificationStatusColor / getBookingStatusColor / getDayLabel / getLocationLabel', () => {
  it('traduit les statuts connus', () => {
    expect(getStatusLabel('pending')).toBe('En attente')
    expect(getStatusLabel('verified')).toBe('Vérifié')
    expect(getStatusLabel('premium')).toBe('Premium')
  })
  it('retourne la valeur brute pour un statut inconnu (fallback)', () => {
    expect(getStatusLabel('statut_inexistant')).toBe('statut_inexistant')
  })
  it('gère undefined sans planter', () => {
    expect(getStatusLabel(undefined)).toBe(undefined)
  })
  it('couleurs de vérification : fallback gray pour statut inconnu', () => {
    expect(getVerificationStatusColor('verified')).toBe('green')
    expect(getVerificationStatusColor('n\'importe quoi')).toBe('gray')
  })
  it('couleurs de réservation : fallback gray pour statut inconnu', () => {
    expect(getBookingStatusColor('confirmed')).toBe('blue')
    expect(getBookingStatusColor('n\'importe quoi')).toBe('gray')
  })
  it('libellé de jour : fallback sur la valeur brute', () => {
    expect(getDayLabel('lundi')).toBe('Lundi')
    expect(getDayLabel('funday')).toBe('funday')
  })
  it('libellé de lieu : fallback sur la valeur brute', () => {
    expect(getLocationLabel('en_ligne')).toBe('En ligne')
    expect(getLocationLabel('sur_la_lune')).toBe('sur_la_lune')
  })
})

describe('getRatingColor', () => {
  it('vert pour >= 4.5', () => {
    expect(getRatingColor(4.5)).toBe('text-green-600')
    expect(getRatingColor(5)).toBe('text-green-600')
  })
  it('primary pour >= 4.0 et < 4.5', () => {
    expect(getRatingColor(4.0)).toBe('text-primary')
    expect(getRatingColor(4.49)).toBe('text-primary')
  })
  it('jaune pour >= 3.0 et < 4.0', () => {
    expect(getRatingColor(3.0)).toBe('text-yellow-600')
  })
  it('rouge en dessous de 3.0, y compris 0 et négatif (improbable)', () => {
    expect(getRatingColor(2.9)).toBe('text-red-500')
    expect(getRatingColor(0)).toBe('text-red-500')
    expect(getRatingColor(-1)).toBe('text-red-500')
  })
})

describe('truncate', () => {
  it('laisse un texte plus court que maxLength inchangé', () => {
    expect(truncate('court', 120)).toBe('court')
  })
  it('tronque un texte trop long et ajoute "..."', () => {
    const long = 'a'.repeat(150)
    const out = truncate(long, 120)
    expect(out.endsWith('...')).toBe(true)
    expect(out.length).toBe(123)
  })
  it('respecte un maxLength personnalisé', () => {
    expect(truncate('bonjour le monde', 7)).toBe('bonjour...')
  })
  it('retire les espaces en fin avant d\'ajouter "..."', () => {
    expect(truncate('bonjour   monde', 7)).toBe('bonjour...')
  })
  it('gère un texte vide/null sans planter', () => {
    expect(truncate('', 10)).toBe('')
    expect(truncate(null, 10)).toBe(null)
  })
  it('texte exactement à la limite reste inchangé (pas de troncature superflue)', () => {
    expect(truncate('12345', 5)).toBe('12345')
  })
})

describe('getDocumentApprovalProgress', () => {
  it('dossier vide/null : aucun item, 0%', () => {
    expect(getDocumentApprovalProgress(null)).toEqual({ items: [], total: 0, approved: 0, rejected: 0, pct: 0 })
    expect(getDocumentApprovalProgress({})).toEqual({ items: [], total: 0, approved: 0, rejected: 0, pct: 0 })
  })

  it('CNI recto seul (sans verso) n\'est PAS compté comme soumis', () => {
    const p = getDocumentApprovalProgress({ cniRecto: true })
    expect(p.total).toBe(0)
  })

  it('CNI recto + verso comptent comme un seul item "id"', () => {
    const p = getDocumentApprovalProgress({ cniRecto: true, cniVerso: true })
    expect(p.total).toBe(1)
    expect(p.items[0].key).toBe('id')
    expect(p.items[0].label).toBe('CNI (recto + verso)')
  })

  it('passeport compte comme un item "id" avec le bon libellé', () => {
    const p = getDocumentApprovalProgress({ idType: 'passport', passport: true })
    expect(p.items[0].label).toBe('Passeport')
  })

  it('diplômes sans fichier (path manquant) sont exclus du calcul', () => {
    const p = getDocumentApprovalProgress({ diplomes: [{ name: 'X' }, { name: 'Y', path: 'a/b.pdf' }] })
    expect(p.total).toBe(1)
  })

  it('un item sans review explicite est compté "pending"', () => {
    const p = getDocumentApprovalProgress({ selfiePath: 'x.jpg' })
    expect(p.items[0].status).toBe('pending')
  })

  it('calcule un pourcentage arrondi correctement (2/3 → 67%)', () => {
    const p = getDocumentApprovalProgress({
      cniRecto: true, cniVerso: true, idReview: { status: 'approved' },
      selfiePath: 's.jpg', selfieReview: { status: 'approved' },
      diplomes: [{ name: 'D', path: 'd.pdf', review: { status: 'pending' } }],
    })
    expect(p.total).toBe(3)
    expect(p.approved).toBe(2)
    expect(p.pct).toBe(67)
  })

  it('compte correctement les documents rejetés séparément des approuvés', () => {
    const p = getDocumentApprovalProgress({
      cniRecto: true, cniVerso: true, idReview: { status: 'rejected', reason: 'x' },
      selfiePath: 's.jpg', selfieReview: { status: 'approved' },
    })
    expect(p.rejected).toBe(1)
    expect(p.approved).toBe(1)
    expect(p.pct).toBe(50)
  })

  it('dossier 100% approuvé donne exactement 100%', () => {
    const p = getDocumentApprovalProgress({
      cniRecto: true, cniVerso: true, idReview: { status: 'approved' },
      selfiePath: 's.jpg', selfieReview: { status: 'approved' },
      diplomes: [{ name: 'D', path: 'd.pdf', review: { status: 'approved' } }],
    })
    expect(p.pct).toBe(100)
  })
})
