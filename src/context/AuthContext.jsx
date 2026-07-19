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
      // Données parent
      subjectsNeeded: profile.subjects_needed || [],
      childLevel: profile.child_level || null,
      openToContact: profile.open_to_contact !== false,
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

  // Création de compte — uniquement email + mdp + rôle
  // Le profil est complété après vérification OTP (session active)
  const register = async ({ email, password, role, ...parentData }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          // Parents : on peut passer les données directement car pas de fichiers
          ...(role === 'parent' && {
            first_name: parentData.firstName || '',
            last_name: parentData.lastName || '',
            phone: parentData.phone || null,
            city: parentData.city || null,
            quartier: parentData.quartier || null,
            avatar_color: parentData.avatarColor || '#E87722',
            subjects_needed: parentData.subjectsNeeded || [],
            child_level: parentData.childLevel || null,
            open_to_contact: parentData.openToContact !== false,
          }),
        },
      },
    })
    if (error) return { success: false, error: error.message }
    if (!data.session) return { success: true, emailConfirmation: true }
    const profile = await fetchProfile(data.user.id)
    setCurrentUser(profile)
    return { success: true, user: profile }
  }

  // Vérification OTP après signUp — retourne une session active
  // setCurrentUser est géré par onAuthStateChange pour éviter le double setState (React #310)
  const verifyOtp = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    if (error) return { success: false, error: error.message }
    if (!data.session) return { success: false, error: 'Vérification échouée, réessayez.' }
    return { success: true, user: data.user }
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
      verifyOtp,
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
