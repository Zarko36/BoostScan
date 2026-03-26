"use client";
/**
 * InsightStream: Persistent_Storage_Vault
 * Optimized with Dynamic Math Integrity Validation & Visual Discrepancy Alerts
 */
import { scanInvoice } from "@/lib/gemini";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText, CheckCircle, X, ExternalLink, ReceiptText, Trash2,
  Database, MapPin, Hash, Calendar, Tag, CreditCard,
  ChevronRight, Loader2, Mail, Phone, Info, Clock, AlertTriangle,
} from "lucide-react";

// --- TYPES & INTERFACES ---
interface RecordItem {
  description: string;
  qty: number | string;
  price: number | string;
}

interface Invoice {
  id: string;
  vendor_name: string;
  category: string;
  invoice_date: string;
  due_date?: string;
  order_number?: string;
  invoice_number?: string;
  service_address?: string;
  seller_address?: string;
  seller_email?: string;
  seller_phone?: string;
  payment_terms?: string;
  payment_methods?: string;
  total_amount: number | string;
  subtotal_amount?: number | string;
  tax_amount?: number | string;
  shipping_amount?: number | string;
  discount_amount?: number | string;
  file_path?: string;
  items?: RecordItem[];
}

export default function VaultPage() {
  const [history, setHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isRescanning, setIsRescanning] = useState(false);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  };

  /**
   * CORE LOGIC: MATHEMATICAL INTEGRITY CHECK
   */
  const checkIntegrity = useCallback((invoice: Invoice) => {
    const toNum = (val: any) => {
      if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, "")) || 0;
      return parseFloat(val) || 0;
    };

    const items = invoice.items || [];
    const calculatedLineItemsSum = items.reduce((sum, item) => {
      return sum + (toNum(item.price) * toNum(item.qty || 1));
    }, 0);

    const subtotal = toNum(invoice.subtotal_amount);
    const tax = toNum(invoice.tax_amount);
    const shipping = toNum(invoice.shipping_amount);
    const discount = toNum(invoice.discount_amount);
    const total = toNum(invoice.total_amount);

    const lineItemsMatchSubtotal = items.length === 0 || Math.abs(calculatedLineItemsSum - subtotal) < 0.001;
    const mathAddsUpToTotal = Math.abs((subtotal + tax + shipping - discount) - total) < 0.001;

    return {
      isPerfect: lineItemsMatchSubtotal && mathAddsUpToTotal,
      sumMismatch: !lineItemsMatchSubtotal,
      totalMismatch: !mathAddsUpToTotal
    };
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Vault_Fetch_Error:", error);
    if (data) setHistory(data as Invoice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleOpenDetails = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    if (invoice.file_path) {
      const { data } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.file_path, 60);
      if (data) setDownloadUrl(data.signedUrl);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm("Confirm Record Deletion?")) return;
    setLoading(true);
    if (invoice.file_path) await supabase.storage.from("invoices").remove([invoice.file_path]);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    setSelectedInvoice(null);
    await fetchHistory();
  };

  const handleManualRescan = async (invoice: Invoice) => {
    if (!invoice.file_path || isRescanning) return;
    setIsRescanning(true);

    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("invoices")
        .download(invoice.file_path);

      if (downloadError) throw downloadError;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileBlob);
      });
      const base64String = await base64Promise;

      const rawResponse = await scanInvoice(base64String, fileBlob.type);
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);

      const { error: updateError } = await supabase
        .from("invoices")
        .update(parsedData)
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      await fetchHistory();
      setSelectedInvoice({ ...invoice, ...parsedData });
      showNotification("RE_SCAN_COMPLETE: Data_Synchronized", "success");
    } catch (err) {
      console.error("Rescan_Failed:", err);
      showNotification("RE_SCAN_FAILED: AI_Extraction_Error", "error");
    } finally {
      setIsRescanning(false);
    }
  };

  const categories = [
    "All", "Mortgage or rent", "Food", "Transportation", "Utilities",
    "Subscriptions", "Personal expenses", "Savings and investments",
    "Debt or student loan payments", "Health care", "Miscellaneous expenses",
  ];

  const filteredHistory = history.filter((inv) => {
    if (selectedCategory === "All") return true;
    return inv.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim();
  });

  return (
    <div className="max-w-[1600px] mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Persistent_Storage_Vault
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase">
            Active_Records: {loading ? "..." : history.length} {"//"} Storage_Secure
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-10 space-y-2">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-4">
              Sector_Filters [{filteredHistory.length}]
            </p>
            <nav className="flex flex-col gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border outline-none focus:outline-none ${
                    selectedCategory === cat
                      ? "bg-zinc-900 border-blue-500/50 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      : "bg-zinc-900/30 border-transparent text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300 hover:border-blue-500/40"
                  }`}
                >
                  <span className="truncate pr-2">{cat}</span>
                  {selectedCategory === cat ? <ChevronRight className="w-3 h-3 text-blue-500" /> : <div className="w-1 h-1 bg-zinc-800 rounded-full group-hover:bg-blue-500" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] py-48 border border-zinc-800/50 bg-zinc-900/20 rounded-3xl backdrop-blur-sm">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 animate-pulse">Synchronizing_Vault_Data...</p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredHistory.map((inv) => {
                const integrity = checkIntegrity(inv);
                
                // Discrepancy Calculation for UI transparency
                const toNum = (val: any) => typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, "")) || 0 : parseFloat(val as string) || 0;
                const expectedTotal = toNum(inv.subtotal_amount) + toNum(inv.tax_amount) + toNum(inv.shipping_amount) - toNum(inv.discount_amount);
                const difference = expectedTotal - toNum(inv.total_amount);

                return (
                  <div
                    key={inv.id}
                    onClick={() => handleOpenDetails(inv)}
                    className={`p-6 bg-zinc-900/50 border rounded-2xl transition-all cursor-pointer group shadow-xl backdrop-blur-sm ${
                      !integrity.isPerfect 
                      ? "border-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]" 
                      : "border-zinc-800 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold truncate max-w-[180px] ${!integrity.isPerfect ? "text-amber-400" : "text-white group-hover:text-blue-400"}`}>{inv.vendor_name}</h4>
                          {!integrity.isPerfect && (
                            <div title="MATH_RECONCILIATION_NEEDED" className="animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                          {inv.category} {"//"} {inv.invoice_date}
                        </p>
                      </div>
                      <FileText className={`w-5 h-5 ${!integrity.isPerfect ? "text-amber-900/50" : "text-zinc-700 group-hover:text-blue-500"}`} />
                    </div>
                    
                    <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                      <div className="flex flex-col">
                        {!integrity.isPerfect && (
                          <span className="text-[8px] font-mono text-amber-500/60 uppercase tracking-tighter mb-1">
                            Math_Expected: ${expectedTotal.toFixed(2)}
                          </span>
                        )}
                        <p className={`font-mono font-black text-xl ${!integrity.isPerfect ? 'text-amber-500' : 'text-blue-400'}`}>
                          ${parseFloat(inv.total_amount as string).toFixed(2)}
                        </p>
                      </div>
                      
                      {integrity.isPerfect ? (
                         <CheckCircle className="w-4 h-4 text-green-500/20 group-hover:text-green-500/50" />
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[7px] bg-amber-500/10 text-amber-500 px-1 rounded border border-amber-500/20 font-black italic">
                            DIFF: ${difference > 0 ? "+" : ""}{difference.toFixed(2)}
                          </span>
                          <Info className="w-4 h-4 text-amber-500/40 group-hover:text-amber-500" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10">
              <Database className="w-8 h-8 mb-4 text-zinc-700" />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">Sector_Empty_No_Matching_Records</p>
            </div>
          )}
        </main>
      </div>

      {selectedInvoice && (
        <div
          onClick={() => { setSelectedInvoice(null); setDownloadUrl(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-zinc-950 border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col relative cursor-default transition-colors duration-500 ${
               !checkIntegrity(selectedInvoice).isPerfect ? "border-amber-500/30" : "border-zinc-800"
            }`}
          >
            {/* Modal Header */}
            <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{selectedInvoice.vendor_name}</h2>
                  {!checkIntegrity(selectedInvoice).isPerfect && (
                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse tracking-tighter uppercase">Integrity_Alert</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {selectedInvoice.category}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded text-[9px] font-mono uppercase tracking-widest">
                    SYS_ID: {selectedInvoice.id.split("-")[0]}
                  </span>
                </div>
              </div>
              <button onClick={() => { setSelectedInvoice(null); setDownloadUrl(null); }} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    <Calendar className="w-3 h-3" /> Date_Issued
                  </div>
                  <p className="font-mono text-zinc-200 text-sm pl-5">{selectedInvoice.invoice_date || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    <Clock className="w-3 h-3" /> Due_Date
                  </div>
                  <p className="font-mono text-zinc-200 text-sm pl-5">{selectedInvoice.due_date || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    <Hash className="w-3 h-3" /> Invoice_Ref
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <p className="font-mono text-zinc-200 text-sm">#{selectedInvoice.invoice_number || "NONE"}</p>
                    <button 
                      onClick={() => handleManualRescan(selectedInvoice)} 
                      disabled={isRescanning} 
                      className={`p-1 hover:text-blue-400 transition-colors ${!checkIntegrity(selectedInvoice).isPerfect ? 'text-amber-500' : 'text-zinc-600'}`}
                      title="Request AI Re-Scan"
                    >
                      <Loader2 className={`w-3 h-3 ${isRescanning ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={`bg-black border rounded-2xl overflow-hidden transition-colors ${!checkIntegrity(selectedInvoice).isPerfect ? 'border-amber-500/20' : 'border-zinc-800'}`}>
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Line_Item_Breakdown</p>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="sticky top-0 bg-zinc-900 text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="p-4 font-normal uppercase">Description</th>
                        <th className="p-4 font-normal text-center">QTY</th>
                        <th className="p-4 font-normal text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {selectedInvoice.items?.map((item, i) => (
                        <tr key={i} className="text-zinc-300 hover:bg-white/5 transition-colors">
                          <td className="p-4 leading-tight">{item.description}</td>
                          <td className="p-4 text-center text-zinc-500">{item.qty}</td>
                          <td className={`p-4 text-right font-bold ${parseFloat(item.price as string) < 0 ? "text-green-400" : "text-blue-400"}`}>
                            ${Math.abs(parseFloat(item.price as string)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-zinc-900/40 space-y-2 border-t border-zinc-800">
                  <div className="flex justify-between text-[10px] uppercase font-mono text-zinc-500">
                    <span>Subtotal (+)</span>
                    <span>${parseFloat(selectedInvoice.subtotal_amount as string || "0").toFixed(2)}</span>
                  </div>
                  
                  {parseFloat(selectedInvoice.tax_amount as string || "0") > 0 && (
                    <div className="flex justify-between text-[10px] uppercase font-mono text-zinc-500">
                      <span>Tax (+)</span>
                      <span>${parseFloat(selectedInvoice.tax_amount as string || "0").toFixed(2)}</span>
                    </div>
                  )}

                  {parseFloat(selectedInvoice.shipping_amount as string || "0") > 0 && (
                    <div className="flex justify-between text-[10px] uppercase font-mono text-zinc-500">
                      <span>Shipping (+)</span>
                      <span>${parseFloat(selectedInvoice.shipping_amount as string || "0").toFixed(2)}</span>
                    </div>
                  )}

                  {parseFloat(selectedInvoice.discount_amount as string || "0") > 0 && (
                    <div className="flex justify-between text-[10px] uppercase font-mono text-emerald-500 font-bold italic">
                      <span>Discount (-)</span>
                      <span>-${parseFloat(selectedInvoice.discount_amount as string).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t border-zinc-800 mt-2 items-end">
                    <span className={`font-black italic uppercase text-xs tracking-tighter ${!checkIntegrity(selectedInvoice).isPerfect ? 'text-amber-500 animate-pulse' : 'text-white'}`}>
                      Final_Settlement
                    </span>
                    <div className="text-right">
                       <span className={`font-black text-2xl transition-all duration-500 ${!checkIntegrity(selectedInvoice).isPerfect 
                        ? 'text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                        : 'text-blue-500'}`}>
                        ${parseFloat(selectedInvoice.total_amount as string).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {!checkIntegrity(selectedInvoice).isPerfect && (
                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-amber-200/70 font-mono uppercase">
                        <span className="text-amber-500 font-bold">Calculation_Alert:</span> The sum of components (Subtotal + Tax + Shipping - Discount) does not reconcile with the Total. Manual verification required.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                {downloadUrl && (
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-[0.98]">
                    <ExternalLink className="w-4 h-4" /> Open_Original_Source_PDF
                  </a>
                )}
                <button onClick={() => handleDelete(selectedInvoice)} className="w-full py-4 bg-transparent border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/50 text-zinc-500 hover:text-red-400 flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                  <Trash2 className="w-4 h-4" /> Wipe_Record_From_Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-10 right-10 z-[200] animate-in slide-in-from-right-10">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-red-500/10 border-red-500/50 text-red-400"}`}>
            {toast.type === "success" ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <div className="flex flex-col uppercase tracking-widest font-mono">
              <p className="text-[10px] font-black">System_Notification</p>
              <p className="text-xs opacity-80">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}