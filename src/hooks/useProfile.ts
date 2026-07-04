import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

// Single source of truth for the current user's role + payout fields.
// Always read role from public.profiles (RLS: profiles_select_own) — never from
// auth user_metadata, which can drift from the persisted role.
export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (!error) setProfile(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const role = profile?.role ?? null;

  return {
    profile,
    role,
    isShop: role === "shop",
    isAdmin: role === "admin",
    loading: authLoading || loading,
    refresh,
  };
}
