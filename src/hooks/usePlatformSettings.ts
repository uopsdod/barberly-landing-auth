import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PlatformSettings = Tables<"platform_settings">;

// platform_settings is a single-row, world-readable config table (currency + slot
// length). money columns are integers in `currency`; a bookable slot is
// `slot_minutes` long. Falls back to sane defaults if the row can't be read.
export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("platform_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setSettings(data ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    settings,
    currency: (settings?.currency ?? "twd").toUpperCase(),
    minorUnits: settings?.currency_minor_units ?? 0,
    slotMinutes: settings?.slot_minutes ?? 30,
    loading,
  };
}
