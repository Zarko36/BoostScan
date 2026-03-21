"use client";
import { useState, useEffect } from "react";
import { scanInvoice } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Upload, LogOut, Cpu } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

  // 1. Handle Authentication State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        // Step A: Get AI extraction
        const data = await scanInvoice(base64String, file.type); 
        setResult(data);

        // Step B: Clean Markdown and Parse
        // This regex removes ```json and the closing ``` backticks
        const cleanData = data.replace(/```json|```/g, "").trim();
        const parsedData = JSON.parse(cleanData);

        // Step C: Save to Supabase
        const { error } = await supabase.from('invoices').insert({
          user_id: session.user.id,
          vendor_name: parsedData.vendor,
          category: parsedData.category,
          total_amount: parsedData.total,
          invoice_date: parsedData.date,
          due_date: parsedData.due_date,
          order_number: parsedData.order_number,
          service_address: parsedData.service_address,
          items: parsedData.items 
        });

        if (error) throw error;
      } catch (err) {
        console.error("System Error:", err);
        // You might want to show an alert here if the JSON is malformed
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsDataURL(file);
  };

  // --- LOGIN VIEW ---
  if (!session) {
    return (
      <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-white mb-2 italic uppercase tracking-tighter">Initialize_Session</h1>
          <p className="text-zinc-500 text-xs text-center mb-8 font-mono tracking-widest uppercase">BoostScan AI // Auth_Protocol</p>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={[]}
          />
        </div>
      </main>
    );
  }

  // --- MAIN SCANNER VIEW ---
  return (
    <main className="min-h-screen p-4 md:p-12 bg-[#09090b] text-zinc-100 flex flex-col items-center selection:bg-blue-500/30">
      {/* Header Section */}
      <div className="w-full max-w-3xl flex justify-between items-start mb-12">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 tracking-tighter uppercase italic">
            BoostScan AI
          </h1>
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Status: Connected // User: {session.user.email?.split('@')[0]}</p>
        </div>
        <div className="flex-1 flex justify-end">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors group"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
          </button>
        </div>
      </div>
      
      {/* Upload Zone */}
      <div className="w-full max-w-3xl group relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative p-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-xl flex flex-col items-center">
          <div className="p-4 bg-blue-500/10 rounded-full mb-4">
            <Upload className="w-10 h-10 text-blue-500" />
          </div>
          <p className="mb-8 text-zinc-400 font-mono text-sm tracking-tight text-center uppercase">
            DROP_INVOICE_OR_CLICK_TO_INITIALIZE_SCAN
          </p>
          
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            onChange={handleImageUpload}
            className="block w-full text-sm text-zinc-400
              file:mr-6 file:py-3 file:px-6
              file:rounded-lg file:border-0
              file:text-xs file:font-bold file:uppercase
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-500 file:transition-all cursor-pointer"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mt-12 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="animate-pulse font-mono text-blue-400 text-xs tracking-[0.2em]">EXECUTING_EXTRACTION_AND_SYNC...</p>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="mt-12 w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-8 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800/50 pb-4">
              <h2 className="text-xs font-bold text-green-500 uppercase tracking-[0.3em]">Sync_Complete // Metadata_Safe</h2>
              <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500/50 animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-500/50 animate-pulse delay-75"></span>
                <span className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse delay-150"></span>
              </div>
            </div>
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">
              {result}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}