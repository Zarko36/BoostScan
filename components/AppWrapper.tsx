"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
// Correctly importing the Session type from the Supabase library
import { Session } from "@supabase/supabase-js";
import { LayoutDashboard, Upload, Database, LogOut, Cpu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  // Fix: Specify Session | null instead of any
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
        <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase tracking-tighter">Initialize_Session</h1>
          <p className="text-zinc-500 text-xs mb-8 font-mono tracking-widest uppercase">BoostScan AI // Auth_Protocol</p>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} theme="dark" providers={[]} />
        </div>
      </main>
    );
  }

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Scanner", href: "/scan", icon: Upload },
    { name: "Vault", href: "/vault", icon: Database },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col p-6 fixed h-full z-40">
        <div className="mb-10">
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 tracking-tighter uppercase italic">BoostScan AI</h1>
          <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Vault_Status: Secure</p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-xs tracking-widest uppercase transition-all ${
                  isActive 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <button 
          onClick={() => supabase.auth.signOut()} 
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-400 font-mono text-xs tracking-widest uppercase transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign_Out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 md:p-12 min-h-screen">
        {children}
      </main>
    </div>
  );
}