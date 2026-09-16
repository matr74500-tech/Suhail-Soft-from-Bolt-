import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`*, branch:branches(*)`)
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const profileId = data.id;

    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('role:roles(id, code, name_ar, name_en, description, is_system)')
      .eq('user_profile_id', profileId);

    const roles: UserProfile['roles'] = [];
    const roleIds: string[] = [];
    (userRolesData || []).forEach((ur: { role: { id: string; code: string; name_ar: string; name_en: string | null; description: string | null; is_system: boolean } | { id: string; code: string; name_ar: string; name_en: string | null; description: string | null; is_system: boolean }[] }) => {
      const role = Array.isArray(ur.role) ? ur.role[0] : ur.role;
      if (!role) return;
      roles.push({
        id: role.id,
        code: role.code,
        name_ar: role.name_ar,
        name_en: role.name_en,
        description: role.description,
        is_system: role.is_system,
      });
      roleIds.push(role.id);
    });

    const permissions = new Set<string>();
    if (roleIds.length > 0) {
      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('permission:permissions(code)')
        .in('role_id', roleIds);

      (rpData || []).forEach((rp: { permission: { code: string } | { code: string }[] }) => {
        const perm = Array.isArray(rp.permission) ? rp.permission[0] : rp.permission;
        if (perm?.code) permissions.add(perm.code);
      });
    }

    return {
      ...data,
      roles,
      permissions: Array.from(permissions),
    } as UserProfile;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          const p = await loadProfile(session.user.id);
          setProfile(p);
          setLoading(false);
        })();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          const p = await loadProfile(session.user.id);
          setProfile(p);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) {
      const p = await loadProfile(session.user.id);
      setProfile(p);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      const p = await loadProfile(data.user.id);
      setProfile(p);
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, username: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      const { error: profileError } = await supabase.from('user_profiles').insert({
        auth_user_id: data.user.id,
        username,
        full_name_ar: fullName,
        email,
      });
      if (profileError) {
        return { error: profileError.message };
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (profileData) {
        const { data: adminRole } = await supabase
          .from('roles')
          .select('id')
          .eq('code', 'admin')
          .maybeSingle();

        if (adminRole) {
          await supabase.from('user_roles').insert({
            user_profile_id: profileData.id,
            role_id: adminRole.id,
          });
        }
      }

      if (data.user) {
        const p = await loadProfile(data.user.id);
        setProfile(p);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const hasPermission = (code: string) => {
    if (!profile?.permissions) return false;
    return profile.permissions.includes(code);
  };

  const isAdmin = () => {
    return profile?.roles?.some(r => r.code === 'admin') ?? false;
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
