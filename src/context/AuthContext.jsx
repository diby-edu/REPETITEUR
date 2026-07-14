import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Charge le profil complet depuis la DB
  const fetchProfile = async (userId) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, tutors(*)')
      .eq('id', userId)
      .single()

    if (!profile) return null

    // Aplatir les données tutor si présentes
    const tutor = profile.tutors
    return {
      id: profile.id,
      role: profile.role,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      quartier: profile.quartier,
      avatarColor: profile.avatar_color,
      joinDate: profile.join_date,
      // Données tutor
      ...(tutor && {
        bio: tutor.bio,
        subjects: tutor.subjects || [],
        levels: tutor.levels || [],
        monthlyRate: tutor.monthly_rate,
        modalities: tutor.modalities || [],
        availability: tutor.availability || {},
        verificationStatus: tutor.verification_status,
        rejectionReason: tutor.rejection_reason,
        documents: tutor.documents || {},
        subscription: {
          plan: tutor.subscription_plan,
          startDate: tutor.subscription_start,
          endDate: tutor.subscription_end,
          status: tutor.subscription_status,
        },
        rating: tutor.rating,
        reviewCount: tutor.review_count,
        sessionCount: tutor.session_count,
        profileViews: tutor.profile_views,
        monthlyRequests: tutor.monthly_requests,
        isActive: tutor.is_active,
        suspended: tutor.suspended,
      }),
    }
  }

  // Initialisation : récupérer la session existante
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setCurrentUser(profile)
      }
      setLoading(false)
    })

    // Écouter les changements d'auth (login/logout/refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id)
        setCurrentUser(profile)
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message || 'Email ou mot de passe incorrect.' }
    const profile = await fetchProfile(data.user.id)
    if (!profile) return { success: false, error: 'Profil introuvable. Contactez l\'administrateur.' }
    setCurrentUser(profile)
    return { success: true, user: profile }
  }

  const register = async ({ email, password, role, firstName, lastName, phone, city, quartier, avatarColor, ...tutorData }) => {
    // Passer TOUTES les données en metadata — le trigger handle_new_user v2 les traite
    // (nécessaire pour le flux avec confirmation email : pas de session active après signUp)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          city: city || null,
          quartier: quartier || null,
          avatar_color: avatarColor || '#E87722',
          ...(role === 'tutor' && {
            bio: tutorData.bio || '',
            subjects: tutorData.subjects || [],
            levels: tutorData.levels || [],
            monthly_rate: tutorData.monthlyRate || 0,
            modalities: tutorData.modalities || [],
            availability: tutorData.availability || {},
            documents: tutorData.documents || {},
          }),
        },
      },
    })
    if (error) return { success: false, error: error.message }

    // Pas de session = confirmation email requise
    if (!data.session) {
      return { success: true, emailConfirmation: true }
    }

    // Session active = confirmation email désactivée — charger le profil
    const profile = await fetchProfile(data.user.id)
    setCurrentUser(profile)
    return { success: true, user: profile }
  }

  const refreshCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const profile = await fetchProfile(session.user.id)
    setCurrentUser(profile)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
  }

  const updateCurrentUser = async (updates) => {
    if (!currentUser) return

    // Mettre à jour profiles
    const profileUpdates = {}
    if (updates.firstName !== undefined) profileUpdates.first_name = updates.firstName
    if (updates.lastName !== undefined) profileUpdates.last_name = updates.lastName
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone
    if (updates.city !== undefined) profileUpdates.city = updates.city
    if (updates.quartier !== undefined) profileUpdates.quartier = updates.quartier

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('profiles').update(profileUpdates).eq('id', currentUser.id)
    }

    // Mettre à jour tutors si répétiteur
    if (currentUser.role === 'tutor') {
      const tutorUpdates = {}
      if (updates.bio !== undefined) tutorUpdates.bio = updates.bio
      if (updates.monthlyRate !== undefined) tutorUpdates.monthly_rate = updates.monthlyRate
      if (Object.keys(tutorUpdates).length > 0) {
        await supabase.from('tutors').update(tutorUpdates).eq('id', currentUser.id)
      }
    }

    // Mettre à jour le state local
    setCurrentUser(prev => prev ? { ...prev, ...updates } : prev)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      login,
      register,
      logout,
      updateCurrentUser,
      refreshCurrentUser,
      fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
