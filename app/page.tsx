"use client";
import { useState } from "react";
import { scanInvoice } from "@/lib/gemini";
import { Upload } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Inside handleImageUpload in page.tsx:
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      // Pass both the data AND the file type (e.g., 'application/pdf')
      const data = await scanInvoice(base64String, file.type); 
      setResult(data);
      setLoading(false);
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <main className="min-h-screen p-4 md:p-12 bg-[#09090b] text-zinc-100 flex flex-col items-center selection:bg-blue-500/30">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 tracking-tighter uppercase italic">
          BoostScan AI
        </h1>
        <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">System Status: Optimal // Port: 3000</p>
      </div>
      
      {/* Upload Zone */}
      <div className="w-full max-w-3xl group relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative p-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-xl flex flex-col items-center">
          <div className="p-4 bg-blue-500/10 rounded-full mb-4">
            <Upload className="w-10 h-10 text-blue-500" />
          </div>
          <p className="mb-8 text-zinc-400 font-mono text-sm tracking-tight text-center">
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
          <p className="animate-pulse font-mono text-blue-400 text-xs tracking-[0.2em]">EXECUTING_EXTRACTION_PROTOCOL...</p>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="mt-12 w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-8 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800/50 pb-4">
              <h2 className="text-xs font-bold text-blue-500 uppercase tracking-[0.3em]">Extracted_Metadata</h2>
              <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500/50"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-500/50"></span>
                <span className="w-2 h-2 rounded-full bg-green-500/50"></span>
              </div>
            </div>
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">
              {result}
            </div>
          </div>
        </div>
      )}
    </main>
  )};