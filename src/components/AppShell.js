"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import FAB from "@/components/FAB";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(!!user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const showNav = authed && !PUBLIC_ROUTES.includes(pathname);

  return (
    <div className={showNav ? "pb-24" : ""}>
      {children}
      {showNav && (
        <>
          <FAB />
          <BottomNav />
        </>
      )}
    </div>
  );
}
