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
    <main className="min-h-screen p-8 bg-zinc-950 text-zinc-100 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-blue-500 uppercase tracking-tighter">BoostScan AI</h1>
      
      <div className="w-full max-w-2xl p-12 border-2 border-dashed border-zinc-800 rounded-none bg-zinc-900/50 flex flex-col items-center">
        <Upload className="w-12 h-12 mb-4 text-blue-500" />
        <p className="mb-6 text-zinc-400 font-mono text-sm">READY_FOR_INPUT: SELECT_INVOICE_IMAGE</p>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload}
          className="block w-full text-sm text-zinc-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-none file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-600 file:text-white
            hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      {loading && <p className="mt-8 animate-pulse font-mono text-blue-400">ANALYZING_DATA...</p>}

      {result && (
        <div className="mt-8 w-full max-w-2xl p-6 bg-zinc-900 border border-zinc-800 rounded-none shadow-[4px_4px_0px_0px_rgba(59,130,246,0.5)]">
          <h2 className="text-xl font-bold mb-4 text-blue-400 border-b border-zinc-800 pb-2 uppercase text-sm tracking-widest">Extraction Result</h2>
          <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {result}
          </div>
        </div>
      )}
    </main>
  );}