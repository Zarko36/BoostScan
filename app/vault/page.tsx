"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  FileText, CheckCircle, X, ExternalLink, 
  ReceiptText, Trash2, Database, MapPin, 
  Hash, Calendar, Tag, CreditCard, ChevronRight,
  Loader2
} from "lucide-react";

// 1. Define specific interfaces for your data structures
interface RecordItem {
  description: string;
  qty: number | string;
  price: number;
}

interface Invoice {
  id: string;
  vendor_name: string;
  category: string;
  invoice_date: string;
  order_number?: string;
  service_address?: string;
  total_amount: number;
  file_path?: string;
  items?: RecordItem[];
}

export default function VaultPage() {
  // 2. State hooks
  const [history, setHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // 3. Define fetchHistory using useCallback so it can be called safely from anywhere
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setHistory(data as Invoice[]);
    setLoading(false);
  }, []);

  // 4. Run the effect on mount
  // 4. Run the effect on mount
    useEffect(() => {
        // Defining an IIFE inside the effect satisfies strict linters 
        // because it treats the fetch as a self-contained side-effect.
        (async () => {
        await fetchHistory();
        })();
    }, [fetchHistory]);

  const handleOpenDetails = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    if (invoice.file_path) {
      const { data } = await supabase.storage
        .from('invoices')
        .createSignedUrl(invoice.file_path, 60);
      if (data) setDownloadUrl(data.signedUrl);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm("Confirm Record Deletion?")) return;
    if (invoice.file_path) await supabase.storage.from('invoices').remove([invoice.file_path]);
    await supabase.from('invoices').delete().eq('id', invoice.id);
    setSelectedInvoice(null);
    fetchHistory();
  };

  const categories = [
    "All", "Mortgage or rent", "Food", "Transportation", "Utilities", 
    "Subscriptions", "Personal expenses", "Savings and investments", 
    "Debt or student loan payments", "Health care", "Miscellaneous expenses"
  ];

  const filteredHistory = history.filter((inv) => {
    if (selectedCategory === "All") return true;
    return inv.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim();
  });

  return (
    <div className="max-w-[1600px] mx-auto py-10 px-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-10">
        <Database className="w-5 h-5 text-blue-500" />
        <div>
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em]">Persistent_Storage_Vault</h3>
          <p className="text-[9px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">
            {loading ? "Initializing_Index..." : `Active_Records: ${history.length}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* --- LEFT SIDE-RAIL --- */}
        <aside className="w-full lg:w-64 shrink-0">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-4 mb-4">
            Database_Sectors [{loading ? "..." : filteredHistory.length}]
          </p>
          <nav className="flex flex-col gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  selectedCategory === cat 
                  ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-900/10" 
                  : "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400"
                }`}
              >
                <span className="truncate pr-2">{cat}</span>
                {selectedCategory === cat && <ChevronRight className="w-3 h-3" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 outline-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-48 border border-zinc-800/50 bg-zinc-900/20 rounded-3xl backdrop-blur-sm shadow-2xl">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
                Synchronizing_Vault_Data...
              </p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-700">
              {filteredHistory.map((inv) => (
                <div 
                  key={inv.id} 
                  onClick={() => handleOpenDetails(inv)}
                  className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl hover:border-blue-500/30 transition-all cursor-pointer group shadow-xl backdrop-blur-sm"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-white font-bold group-hover:text-blue-400 transition-colors truncate max-w-[180px]">{inv.vendor_name}</h4>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                        {inv.category} {"//"} {inv.invoice_date}
                      </p>
                    </div>
                    <FileText className="w-5 h-5 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                    <p className="text-blue-400 font-mono font-black text-xl">${inv.total_amount}</p>
                    <CheckCircle className="w-4 h-4 text-green-500/20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-800 rounded-3xl opacity-50">
              <Database className="w-8 h-8 mb-4 text-zinc-700" />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">Sector_Empty_No_Matching_Records</p>
            </div>
          )}
        </main>
      </div>

      {/* --- DETAIL MODAL --- */}
      {selectedInvoice && (
        <div 
          onClick={() => { setSelectedInvoice(null); setDownloadUrl(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative cursor-default"
          >
            <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-950/50 backdrop-blur-xl">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{selectedInvoice.vendor_name}</h2>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {selectedInvoice.category}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded text-[9px] font-mono uppercase tracking-widest">
                    SYS_ID: {selectedInvoice.id.split('-')[0]}
                  </span>
                </div>
              </div>
              <button onClick={() => { setSelectedInvoice(null); setDownloadUrl(null); }} className="p-2 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em]"><Calendar className="w-3 h-3" /> Transaction_Date</div>
                  <p className="font-mono text-zinc-200 text-sm pl-5">{selectedInvoice.invoice_date || 'N/A'}</p>
                </div>
                <div className="space-y-2 text-right">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] justify-end">Order_Serial <Hash className="w-3 h-3" /></div>
                  <p className="font-mono text-zinc-200 text-sm pr-5">#{selectedInvoice.order_number || 'NOT_RECORDED'}</p>
                </div>
              </div>

              {selectedInvoice.service_address && (
                <div className="p-5 bg-zinc-800/30 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-[9px] text-blue-500 uppercase font-black tracking-[0.2em]"><MapPin className="w-4 h-4" /> Service_Location_Data</div>
                  <p className="text-zinc-300 font-mono text-xs leading-relaxed pl-6 italic uppercase">{selectedInvoice.service_address}</p>
                </div>
              )}

              <div className="bg-black/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner">
                <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Line_Item_Breakdown</p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-sm"><CreditCard className="w-4 h-4" /> ${selectedInvoice.total_amount}</div>
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
                      {selectedInvoice.items?.map((item, i) => (
                        <tr key={i} className="text-zinc-300 hover:bg-white/5 transition-colors">
                          <td className="p-4 leading-tight">{item.description}</td>
                          <td className="p-4 text-center text-zinc-500">{item.qty}</td>
                          <td className={`p-4 text-right font-bold ${item.price < 0 ? 'text-green-400' : 'text-blue-400'}`}>
                            {item.price < 0 ? `- $${Math.abs(item.price)}` : `$${item.price}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                {downloadUrl && (
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]">
                    <ExternalLink className="w-4 h-4" /> Open_Original_Source_PDF
                  </a>
                )}
                <button onClick={() => handleDelete(selectedInvoice)} className="w-full py-4 bg-transparent border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/50 text-zinc-500 hover:text-red-400 flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                  <Trash2 className="w-4 h-4" /> Wipe_Record_From_Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}