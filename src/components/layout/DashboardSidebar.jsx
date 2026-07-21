'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import Avatar from '../common/Avatar'
import {
  LayoutDashboard, Calendar, Settings, BookOpen, LogOut, Users, ShieldCheck,
} from 'lucide-react'

const NAV = {
  tutor: [
    { label: 'Tableau de bord', href: '/tableau-de-bord/repetiteur', icon: LayoutDashboard },
    { label: 'Séances',         href: '/reservations',               icon: Calendar },
    { label: 'Abonnement',      href: '/abonnement',                 icon: BookOpen },
  ],
  parent: [
    { label: 'Tableau de bord', href: '/tableau-de-bord/parent', icon: LayoutDashboard },
    { label: 'Séances',         href: '/reservations',           icon: Calendar },
    { label: 'Paramètres',      href: '/parametres',             icon: Settings },
  ],
  admin: [
    { label: 'Tableau de bord', href: '/admin',      icon: LayoutDashboard },
    { label: 'Utilisateurs',    href: '/admin',      icon: Users },
    { label: 'Vérifications',   href: '/admin',      icon: ShieldCheck },
  ],
}

const ROLE_LABELS = { tutor: 'Répétiteur', parent: 'Parent', admin: 'Administrateur' }

export default function DashboardSidebar() {
  const { currentUser, logout } = useAuth()
  const { getUserEngagements, getAllUserSessions, getUserConversations, tutors } = useApp()
  const pathname = usePathname()
  const router   = useRouter()

  if (!currentUser) return null

  const role  = currentUser.role
  const items = NAV[role] || []

  // Mini-stats pour le résumé sidebar
  const engagements   = getUserEngagements(currentUser.id, role) || []
  const allSessions   = getAllUserSessions(currentUser.id, role) || []
  const conversations = getUserConversations(currentUser.id) || []
  const currentMonth  = new Date().toISOString().slice(0, 7)
  const activeEng     = engagements.filter(e => e.status === 'active')
  const monthSessions = allSessions.filter(s => s.scheduledDate?.startsWith(currentMonth))
  const upcomingSess  = allSessions.filter(s => new Date(s.scheduledDate + 'T00:00:00') >= new Date(new Date().toDateString()))
  const monthRevenue  = activeEng.reduce((s, e) => s + (e.monthlyRate || 0), 0)
  const monthSpend    = activeEng.reduce((s, e) => s + (e.monthlyRate || 0), 0)
  const verifiedT     = tutors?.filter(t => t.verificationStatus === 'verified') || []
  const pendingT      = tutors?.filter(t => t.verificationStatus === 'pending') || []

  const RESUME_ROWS = {
    tutor: [
      { label: 'Séances ce mois', value: monthSessions.length },
      { label: 'Revenus mois',    value: monthRevenue > 0 ? `${monthRevenue.toLocaleString('fr-FR')} F` : '0 F' },
      { label: 'Contrats actifs', value: activeEng.length },
      { label: 'Note moyenne',    value: currentUser.rating > 0 ? `${currentUser.rating?.toFixed(1)} ★` : '—' },
    ],
    parent: [
      { label: 'Séances planifiées',    value: upcomingSess.length },
      { label: 'Contrats actifs',       value: activeEng.length },
      { label: 'Répétiteurs contactés', value: conversations.length },
      { label: 'Dépenses mois',         value: monthSpend > 0 ? `${monthSpend.toLocaleString('fr-FR')} F` : '0 F' },
    ],
    admin: [
      { label: 'Répétiteurs vérifiés', value: verifiedT.length },
      { label: 'En attente',           value: pendingT.length },
      { label: 'Abonnements actifs',   value: tutors?.filter(t => t.subscription?.status === 'active').length || 0 },
      { label: 'Total répétiteurs',    value: tutors?.length || 0 },
    ],
  }
  const resumeRows = RESUME_ROWS[role] || []

  const isActive = (href) => pathname === href
  const handleLogout = () => { logout(); router.push('/') }

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full overflow-y-auto z-10"
      style={{ background: 'linear-gradient(180deg, #1B4332 0%, #2D6A4F 100%)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-display font-bold text-base">M</span>
          </div>
          <span className="font-display font-bold text-[15px] text-white">
            Mon<span className="text-accent-400">Répétiteur</span>
          </span>
        </Link>
      </div>

      {/* User profile */}
      <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar user={currentUser} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="text-xs text-white/55 mt-0.5 truncate">{currentUser.city || 'Côte d\'Ivoire'}</p>
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 bg-white/15 text-white/85">
              {ROLE_LABELS[role]}
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={href + label}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isActive(href)
                ? 'bg-white/22 text-white shadow-sm'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={17} className="flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* RÉSUMÉ mini-stats */}
      {resumeRows.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Résumé</p>
          {resumeRows.map(row => (
            <div key={row.label} className="flex justify-between items-center py-1">
              <span className="text-[11px] text-white/55">{row.label}</span>
              <span className="text-[11px] font-bold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Logout */}
      <div className="flex-shrink-0 px-3 pt-3 pb-5 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/55 hover:text-white hover:bg-white/10 transition-all"
        >
          <LogOut size={17} className="flex-shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
