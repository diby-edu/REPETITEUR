'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import Avatar from './Avatar'
import {
  Search, Menu, X, Bell, LogOut, Settings,
  LayoutDashboard, BookOpen, MessageCircle, ChevronDown, Heart
} from 'lucide-react'

export default function Navbar() {
  const { currentUser, logout, isAuthenticated } = useAuth()
  const { getUnreadNotifCount } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const unreadCount = isAuthenticated ? getUnreadNotifCount(currentUser.id) : 0

  const handleLogout = () => {
    logout()
    router.push('/')
    setUserMenuOpen(false)
    setMenuOpen(false)
  }

  const getDashboardLink = () => {
    if (!currentUser) return '/'
    if (currentUser.role === 'admin') return '/admin'
    if (currentUser.role === 'tutor') return '/tableau-de-bord/repetiteur'
    return '/tableau-de-bord/parent'
  }

  const navLinks = [
    // "Trouver un répétiteur" uniquement pour les visiteurs et les parents
    ...(!isAuthenticated || currentUser?.role === 'parent' ? [
      { label: 'Trouver un répétiteur', href: '/recherche', icon: <Search size={16} /> },
    ] : []),
    ...(isAuthenticated && currentUser?.role !== 'admin' ? [
      { label: 'Messages', href: '/messagerie', icon: <MessageCircle size={16} /> },
      { label: 'Réservations', href: '/reservations', icon: <BookOpen size={16} /> },
      ...(currentUser?.role === 'parent' ? [
        { label: 'Favoris', href: '/favoris', icon: <Heart size={16} /> },
      ] : []),
    ] : []),
  ]

  const isActive = (href) => pathname === href

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo — redirige vers le dashboard si connecté */}
          <Link href={isAuthenticated ? getDashboardLink() : '/'} className="flex items-center gap-2 flex-shrink-0" onClick={() => setMenuOpen(false)}>
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-display font-bold text-lg">M</span>
            </div>
            <span className="font-display font-bold text-xl text-gray-900 hidden sm:block">
              Mon<span className="text-primary">Répétiteur</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-primary-50 text-primary'
                    : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Notification bell */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Avatar user={currentUser} size="sm" />
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {currentUser.firstName}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{
                        currentUser.role === 'admin' ? 'Administrateur' :
                        currentUser.role === 'tutor' ? 'Répétiteur' : 'Parent'
                      }</p>
                    </div>
                    <ChevronDown size={16} className="text-gray-400 hidden md:block" />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-gray-50">
                          <p className="text-sm font-semibold text-gray-900">{currentUser.firstName} {currentUser.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                        </div>
                        <Link
                          href={getDashboardLink()}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <LayoutDashboard size={16} className="text-gray-400" />
                          Tableau de bord
                        </Link>
                        {currentUser.role === 'tutor' && (
                          <Link
                            href="/abonnement"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <BookOpen size={16} className="text-gray-400" />
                            Abonnement
                          </Link>
                        )}
                        {currentUser.role === 'parent' && (
                          <Link
                            href="/favoris"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Heart size={16} className="text-gray-400" />
                            Mes favoris
                          </Link>
                        )}
                        <Link
                          href="/parametres"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Settings size={16} className="text-gray-400" />
                          Paramètres
                        </Link>
                        <div className="border-t border-gray-50">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut size={16} />
                            Déconnexion
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/connexion" className="text-sm font-medium text-gray-600 hover:text-primary px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Connexion
                </Link>
                <Link href="/inscription" className="btn-primary text-sm py-2 px-5">
                  S'inscrire
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive(link.href) ? 'bg-primary-50 text-primary' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}

          {isAuthenticated ? (
            <>
              <Link href={getDashboardLink()} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                <LayoutDashboard size={16} />Tableau de bord
              </Link>
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Bell size={16} />Notifications {unreadCount > 0 && <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>}
              </Link>
              <Link href="/parametres" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Settings size={16} />Paramètres
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50">
                <LogOut size={16} />Déconnexion
              </button>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/connexion" onClick={() => setMenuOpen(false)} className="btn-outline text-center text-sm py-2.5">
                Connexion
              </Link>
              <Link href="/inscription" onClick={() => setMenuOpen(false)} className="btn-primary text-center text-sm py-2.5">
                S'inscrire
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
