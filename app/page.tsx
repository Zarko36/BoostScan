"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Zap, TrendingUp, Cpu } from "lucide-react";

export default function Dashboard() {
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserName(session.user.email.split("@")[0]);
      }
    };
    getUser();
  }, []);

  return (
    <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Welcome_Back, {userName}
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase">
            System_Status: Optimal // Node_Active
          </p>
        </div>
      </header>

      {/* Placeholder Stats for the Burn Rate Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          {
            label: "Active_Vault_Records",
            val: "Online",
            icon: Activity,
            color: "text-blue-500",
          },
          {
            label: "Monthly_Burn_Rate",
            val: "Syncing...",
            icon: TrendingUp,
            color: "text-green-500",
          },
          {
            label: "Scanner_Module",
            val: "Ready",
            icon: Zap,
            color: "text-yellow-500",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors"
          >
            <stat.icon className={`w-5 h-5 ${stat.color} mb-4`} />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {stat.label}
            </p>
            <p className="text-xl font-bold text-white mt-1">{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="p-12 border border-dashed border-zinc-800 rounded-3xl text-center bg-zinc-900/20">
        <Cpu className="w-8 h-8 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-600 font-mono text-xs uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
          Dashboard analytics are currently offline. Use the sidebar to access
          the Scanner or view your Persistent Vault.
        </p>
      </div>
    </div>
  );
}
