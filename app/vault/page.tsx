"use client";
/**
 * InsightStream: Persistent_Storage_Vault
 * Updated with Mathematical Integrity Checks
 */
import { scanInvoice } from "@/lib/gemini";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  CheckCircle,
  X,
  ExternalLink,
  ReceiptText,
  Trash2,
  Database,
  MapPin,
  Hash,
  Calendar,
  Tag,
  CreditCard,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Info,
  Clock,
  AlertTriangle, // Added for the accuracy badge
} from "lucide-react";

// --- TYPES & INTERFACES ---
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
  due_date?: string;
  order_number?: string;
  invoice_number?: string;
  service_address?: string;
  seller_address?: string;
  seller_email?: string;
  seller_phone?: string;
  payment_terms?: string;
  payment_methods?: string;
  total_amount: number;
  subtotal_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
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

  // --- INTEGRITY CHECK HELPER ---
  const isDataAccurate = (invoice: Invoice) => {
    if (!invoice.items || invoice.items.length === 0) return true;

    // 1. Calculate the sum of all line items
    const calculatedLineItemsSum = invoice.items.reduce((sum, item) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      const qty = typeof item.qty === 'string' ? parseFloat(item.qty) : (Number(item.qty) || 1);
      return sum + (price * qty);
    }, 0);

    // 2. Normalize all financial values to Numbers to avoid string-catenation or NaN issues
    const subtotal = Number(invoice.subtotal_amount || 0);
    const tax = Number(invoice.tax_amount || 0);
    const shipping = Number(invoice.shipping_amount || 0);
    const discount = Number(invoice.discount_amount || 0);
    const total = Number(invoice.total_amount || 0);

    // 3. Perform Two-Point Validation
    // Point A: Do line items match the reported subtotal?
    const lineItemsMatchSubtotal = Math.abs(calculatedLineItemsSum - subtotal) < 0.01;
    
    // Point B: Does (Subtotal + Tax + Shipping - Discount) match the Final Total?
    const mathAddsUpToTotal = Math.abs((subtotal + tax + shipping - discount) - total) < 0.01;

    // Return true ONLY if both checks pass
    return lineItemsMatchSubtotal && mathAddsUpToTotal;
  };

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

      const updatePayload = {
        vendor_name: parsedData.vendor_name,
        category: parsedData.category,
        total_amount: parsedData.total_amount,
        invoice_date: parsedData.invoice_date,
        due_date: parsedData.due_date,
        order_number: parsedData.order_number,
        invoice_number: parsedData.invoice_number,
        seller_address: parsedData.seller_address,
        seller_email: parsedData.seller_email,
        seller_phone: parsedData.seller_phone,
        payment_terms: parsedData.payment_terms,
        subtotal_amount: parsedData.subtotal_amount,
        tax_amount: parsedData.tax_amount,
        shipping_amount: parsedData.shipping_amount,
        discount_amount: parsedData.discount_amount,
        items: parsedData.items
      };

      const { error: updateError } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      await fetchHistory();
      setSelectedInvoice({ ...invoice, ...updatePayload });
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
    <div className="max-w-[1600px] mx-auto py-10 px-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-700">
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
              {filteredHistory.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleOpenDetails(inv)}
                  className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all cursor-pointer group shadow-xl backdrop-blur-sm"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      {/* --- ACCURACY BADGE ADDED HERE --- */}
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-bold group-hover:text-blue-400 truncate max-w-[180px]">{inv.vendor_name}</h4>
                        {!isDataAccurate(inv) && (
                          <div title="AI_MATH_MISMATCH" className="animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                        {inv.category} {"//"} {inv.invoice_date}
                      </p>
                    </div>
                    <FileText className="w-5 h-5 text-zinc-700 group-hover:text-blue-500" />
                  </div>
                  <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                    <p className="text-blue-400 font-mono font-black text-xl">${Number(inv.total_amount).toFixed(2)}</p>
                    {isDataAccurate(inv) ? (
                       <CheckCircle className="w-4 h-4 text-green-500/20 group-hover:text-green-500/50" />
                    ) : (
                       <Info className="w-4 h-4 text-amber-500/40 group-hover:text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
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
            className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col relative cursor-default"
          >
            {/* Header */}
            <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{selectedInvoice.vendor_name}</h2>
                  {!isDataAccurate(selectedInvoice) && (
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

            {/* Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              {/* Top Details Grid */}
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
                    <button onClick={() => handleManualRescan(selectedInvoice)} disabled={isRescanning} className="p-1 hover:text-blue-400 text-zinc-600 transition-colors">
                      <Loader2 className={`w-3 h-3 ${isRescanning ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Vendor & Location Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="text-[9px] text-blue-500 uppercase font-black tracking-widest border-b border-zinc-800/50 pb-2 flex justify-between items-center">
                    <span>Seller_Intel</span>
                    <Info className="w-3 h-3 opacity-50" />
                  </div>
                  <div className="space-y-2 text-xs font-mono uppercase">
                    {selectedInvoice.seller_address && <p className="text-zinc-400 flex items-start gap-2"><MapPin className="w-3 h-3 mt-0.5" /> {selectedInvoice.seller_address}</p>}
                    {selectedInvoice.seller_email && <p className="text-zinc-400 flex items-center gap-2"><Mail className="w-3 h-3" /> {selectedInvoice.seller_email}</p>}
                    {selectedInvoice.seller_phone && <p className="text-zinc-400 flex items-center gap-2"><Phone className="w-3 h-3" /> {selectedInvoice.seller_phone}</p>}
                  </div>
                </div>

                <div className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="text-[9px] text-blue-500 uppercase font-black tracking-widest border-b border-zinc-800/50 pb-2 flex justify-between items-center">
                    <span>Logistics_&_Terms</span>
                    <Clock className="w-3 h-3 opacity-50" />
                  </div>
                  <div className="space-y-2 text-xs font-mono uppercase">
                    <p className="text-zinc-400 flex items-start gap-2"><MapPin className="w-3 h-3 mt-0.5" /> {selectedInvoice.service_address || "NOT_SPECIFIED"}</p>
                    <p className="text-zinc-400 flex items-center gap-2"><CreditCard className="w-3 h-3" /> {selectedInvoice.payment_terms || "N/A"}</p>
                    {selectedInvoice.order_number && <p className="text-blue-400/80 flex items-center gap-2"><Hash className="w-3 h-3" /> ORD: {selectedInvoice.order_number}</p>}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden">
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
                          <td className={`p-4 text-right font-bold ${item.price < 0 ? "text-green-400" : "text-blue-400"}`}>
                            ${Math.abs(Number(item.price)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* --- MODAL FOOTER ACCURACY UPDATES --- */}
                <div className="p-6 bg-zinc-900/40 space-y-2 border-t border-zinc-800">
                  <div className={`flex justify-between text-[10px] uppercase font-mono ${!isDataAccurate(selectedInvoice) ? 'text-amber-500 font-bold' : 'text-zinc-500'}`}>
                    <span>Subtotal {!isDataAccurate(selectedInvoice) && "(MATCH_ERR)"}</span>
                    <span>${Number(selectedInvoice.subtotal_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase font-mono text-zinc-500">
                    <span>Tax</span>
                    <span>${Number(selectedInvoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase font-mono text-zinc-500">
                    <span>Shipping</span>
                    <span>${Number(selectedInvoice.shipping_amount || 0).toFixed(2)}</span>
                  </div>
                  {Number(selectedInvoice.discount_amount) > 0 && (
                    <div className="flex justify-between text-[10px] uppercase font-mono text-emerald-500">
                      <span>Discount</span>
                      <span>-${Number(selectedInvoice.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-4 border-t border-zinc-800 mt-2">
                    <span className="text-white font-black italic uppercase text-xs tracking-tighter">Final_Settlement</span>
                    <span className="text-blue-500 font-black text-xl drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                      ${Number(selectedInvoice.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
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

      {/* Toast */}
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