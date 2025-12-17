"use client";

import { useEffect, useState } from "react";
// Pastikan ini mengarah ke klien SISI BROWSER (client.ts)
import { createClient } from "@/lib/supabase/client"; 
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js"; // Import tipe User

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // 🌟 Ambil user di sisi client 🌟
  useEffect(() => {
    const supabase = createClient(); 
    
    // Periksa status user saat komponen dimuat
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user);
    });
    
    // Dengarkan perubahan status auth (login/logout) secara real-time
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe(); // Bersihkan listener
    };
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Gunakan router.refresh() untuk update data di Server Components (best practice)
    router.refresh(); 
    router.push("/auth/login");
  };

  return user ? (
    <div className="flex items-center gap-4">
      {/* user.email harus aman karena kita cek user? */}
      <span className="text-sm text-slate-400 hidden md:block">Hey, {user.email}</span> 
      <Button onClick={logout} variant="outline" className="justify-start">
        Logout
      </Button>
    </div>
  ) : (
    <div className="flex flex gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
