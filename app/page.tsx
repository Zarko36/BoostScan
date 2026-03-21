"use client";
import { useState, useEffect } from "react";
import { scanInvoice } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Upload, LogOut, Cpu, FileText, CheckCircle, X, ExternalLink, ReceiptText, Trash2 } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  // New states for the Modal logic
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchHistory();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchHistory();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setHistory(data);
  };

  const handleOpenDetails = async (invoice: any) => {
    setSelectedInvoice(invoice);
    if (invoice.file_path) {
      // Generate a private "Signed URL" that expires in 60 seconds
      const { data } = await supabase.storage
        .from('invoices')
        .createSignedUrl(invoice.file_path, 60);
      if (data) setDownloadUrl(data.signedUrl);
    }
  };

  const handleDelete = async (invoice: any) => {
    const confirmDelete = confirm("Are you sure you want to delete this record and the associated PDF?");
    if (!confirmDelete) return;

    try {
      // 1. Delete from Storage
      if (invoice.file_path) {
        await supabase.storage.from('invoices').remove([invoice.file_path]);
      }
      // 2. Delete from Database
      await supabase.from('invoices').delete().eq('id', invoice.id);
      
      setSelectedInvoice(null);
      fetchHistory();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const data = await scanInvoice(base64String, file.type); 
        setResult(data);
        const cleanData = data.replace(/```json|```/g, "").trim();
        const parsedData = JSON.parse(cleanData);

        const { error: dbError } = await supabase.from('invoices').insert({
          user_id: session.user.id,
          vendor_name: parsedData.vendor,
          category: parsedData.category,
          total_amount: parsedData.total,
          invoice_date: parsedData.date,
          due_date: parsedData.due_date,
          order_number: parsedData.order_number,
          service_address: parsedData.service_address,
          items: parsedData.items,
          file_path: filePath 
        });

        if (dbError) throw dbError;
        fetchHistory();

      } catch (err) {
        console.error("System Failure:", err);
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsDataURL(file);
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-500/10 rounded-xl"><Cpu className="w-8 h-8 text-blue-500" /></div>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase tracking-tighter">Initialize_Session</h1>
          <p className="text-zinc-500 text-xs mb-8 font-mono tracking-widest uppercase">BoostScan AI // Auth_Protocol</p>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} theme="dark" providers={[]} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-12 bg-[#09090b] text-zinc-100 flex flex-col items-center selection:bg-blue-500/30">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-start mb-12">
        <div className="flex-1" />
        <div className="text-center flex-1">
          <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 tracking-tighter uppercase italic">BoostScan AI</h1>
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Vault_Status: Secure // User: {session.user.email?.split('@')[0]}</p>
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={() => supabase.auth.signOut()} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors group">
            <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
          </button>
        </div>
      </div>
      
      {/* Upload Zone */}
      <div className="w-full max-w-3xl group relative mb-12">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative p-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-xl flex flex-col items-center">
          <div className="p-4 bg-blue-500/10 rounded-full mb-4"><Upload className="w-10 h-10 text-blue-500" /></div>
          <p className="mb-8 text-zinc-400 font-mono text-sm tracking-tight text-center uppercase text-[10px] tracking-[0.3em]">Drop_Invoice_To_Archive_And_Scan</p>
          <input type="file" accept="image/*,application/pdf" onChange={handleImageUpload} className="block w-full text-sm text-zinc-400 file:mr-6 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
        </div>
      </div>

      {loading && (
        <div className="mt-4 mb-8 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="animate-pulse font-mono text-blue-400 text-[10px] tracking-[0.2em] uppercase">Syncing_To_Vault_Protocol...</p>
        </div>
      )}

      {/* History Grid */}
      <div className="w-full max-w-4xl mt-12 mb-20">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          Persistent_Storage_Vault
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {history.map((inv) => (
            <div 
              key={inv.id} 
              onClick={() => handleOpenDetails(inv)}
              className="p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl flex flex-col justify-between hover:border-blue-500/50 hover:bg-zinc-900/60 transition-all group shadow-xl cursor-pointer hover:-translate-y-1 duration-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-white font-bold text-lg tracking-tight group-hover:text-blue-400 transition-colors">{inv.vendor_name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1.5 opacity-70">{inv.category} // {inv.invoice_date}</p>
                </div>
                <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                <p className="text-blue-400 font-mono font-black text-2xl tracking-tighter">${inv.total_amount}</p>
                <span className="flex items-center gap-1.5 text-[9px] text-green-500/70 font-mono uppercase tracking-widest font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> PDF_SAFE
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- DETAIL MODAL --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col relative">
            
            {/* Modal Header */}
            <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50 backdrop-blur-xl">
              <div>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{selectedInvoice.vendor_name}</h2>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest">
                    {selectedInvoice.category}
                  </span>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Report_ID: {selectedInvoice.id.split('-')[0]}</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedInvoice(null); setDownloadUrl(null); }}
                className="p-2 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="space-y-1.5">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em]">Transaction_Date</p>
                  <p className="font-mono text-zinc-200 text-sm">{selectedInvoice.invoice_date}</p>
                </div>
                <div className="space-y-1.5 text-right">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em]">Order_Serial</p>
                  <p className="font-mono text-zinc-200 text-sm">#{selectedInvoice.order_number || 'UNKNOWN'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-black/40 border border-zinc-800 rounded-2xl overflow-hidden mb-10 shadow-inner">
                <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Line_Item_Breakdown</p>
                  </div>
                  <p className="text-[10px] font-mono text-blue-400 font-bold">${selectedInvoice.total_amount}</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="sticky top-0 bg-zinc-900 text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="p-4 font-normal uppercase tracking-tighter">Description</th>
                        <th className="p-4 font-normal text-center">QTY</th>
                        <th className="p-4 font-normal text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {selectedInvoice.items?.map((item: any, i: number) => (
                        <tr key={i} className="text-zinc-300 hover:bg-white/5 transition-colors">
                          <td className="p-4 leading-tight">{item.description}</td>
                          <td className="p-4 text-center text-zinc-500">{item.qty}</td>
                          <td className="p-4 text-right text-blue-400 font-bold">${item.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {downloadUrl && (
                  <a 
                    href={downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open_Original_Source_PDF
                  </a>
                )}
                
                <button 
                  onClick={() => handleDelete(selectedInvoice)}
                  className="w-full py-4 bg-transparent border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/50 text-zinc-500 hover:text-red-400 flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Wipe_Record_From_Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}