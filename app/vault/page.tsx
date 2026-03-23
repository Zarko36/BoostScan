"use client";
import { scanInvoice } from "@/lib/gemini"; // Adjust the path if your file is named differently
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
} from "lucide-react";

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
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
}

export default function VaultPage() {
  const [history, setHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const showNotification = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ ...toast, show: false }), 4000); // Auto-hide after 4s
  };

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Vault_Fetch_Error:", error);
    }

    if (data) setHistory(data as Invoice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      await fetchHistory();
      if (isMounted) setLoading(false);
    };
    loadData();
    return () => {
      isMounted = false;
    };
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
    if (invoice.file_path)
      await supabase.storage.from("invoices").remove([invoice.file_path]);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    setSelectedInvoice(null);
    await fetchHistory();
  };

  // Insert after handleDelete (around line 94)
  const [isRescanning, setIsRescanning] = useState(false);

  const handleManualRescan = async (invoice: Invoice) => {
    if (!invoice.file_path || isRescanning) return;
    setIsRescanning(true);

    try {
      // 1. Download the file from storage
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("invoices")
        .download(invoice.file_path);

      if (downloadError) throw downloadError;

      // 2. Convert to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileBlob);
      });
      const base64String = await base64Promise;

      // 3. Re-run scan
      const rawResponse = await scanInvoice(base64String, fileBlob.type);
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);

      // 4. Update Database
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ order_number: parsedData.order_number })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      // Refresh UI state
      await fetchHistory();
      setSelectedInvoice({ ...invoice, order_number: parsedData.order_number });

      // SUCCESS NOTIFICATION
      showNotification("RE_SCAN_COMPLETE: Record_Synchronized", "success");
    } catch (err) {
      console.error("Rescan_Failed:", err);
      // FAILURE NOTIFICATION
      showNotification("RE_SCAN_FAILED: AI_Extraction_Error", "error");
    } finally {
      setIsRescanning(false);
    }
  };

  const categories = [
    "All",
    "Mortgage or rent",
    "Food",
    "Transportation",
    "Utilities",
    "Subscriptions",
    "Personal expenses",
    "Savings and investments",
    "Debt or student loan payments",
    "Health care",
    "Miscellaneous expenses",
  ];

  const filteredHistory = history.filter((inv) => {
    if (selectedCategory === "All") return true;
    return (
      inv.category?.toLowerCase().trim() ===
      selectedCategory.toLowerCase().trim()
    );
  });

  return (
    <div className="max-w-[1600px] mx-auto py-10 px-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER */}
      <header className="mb-12">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Persistent_Storage_Vault
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase">
            Active_Records: {loading ? "..." : history.length} {"//"}{" "}
            Storage_Secure
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* SIDEBAR - Category Hover Glow */}
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
                      : "bg-zinc-900/30 border-transparent text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300 hover:border-blue-500/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  }`}
                >
                  <span className="truncate pr-2">{cat}</span>
                  {selectedCategory === cat ? (
                    <ChevronRight className="w-3 h-3 text-blue-500" />
                  ) : (
                    <div className="w-1 h-1 bg-zinc-800 rounded-full group-hover:bg-blue-500 transition-colors" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* MAIN CONTENT - Card Hover Glow */}
        <main className="flex-1 outline-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] py-48 border border-zinc-800/50 bg-zinc-900/20 rounded-3xl backdrop-blur-sm shadow-2xl">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
                Synchronizing_Vault_Data...
              </p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 outline-none">
              {filteredHistory.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleOpenDetails(inv)}
                  className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 cursor-pointer group shadow-xl backdrop-blur-sm focus:outline-none"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-white font-bold group-hover:text-blue-400 transition-colors truncate max-w-[180px]">
                        {inv.vendor_name}
                      </h4>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                        {inv.category} {"//"} {inv.invoice_date}
                      </p>
                    </div>
                    <FileText className="w-5 h-5 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex justify-between items-end border-t border-zinc-800/50 pt-4">
                    <p className="text-blue-400 font-mono font-black text-xl group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-all">
                      ${Number(inv.total_amount).toFixed(2)}
                    </p>
                    <CheckCircle className="w-4 h-4 text-green-500/20 group-hover:text-green-500/50 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10">
              <Database className="w-8 h-8 mb-4 text-zinc-700" />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                Sector_Empty_No_Matching_Records
              </p>
            </div>
          )}
        </main>
      </div>

      {/* MODAL */}
      {selectedInvoice && (
        <div
          onClick={() => {
            setSelectedInvoice(null);
            setDownloadUrl(null);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative cursor-default focus:outline-none"
          >
            <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">
                  {selectedInvoice.vendor_name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {selectedInvoice.category}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded text-[9px] font-mono uppercase tracking-widest">
                    SYS_ID: {selectedInvoice.id.split("-")[0]}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setDownloadUrl(null);
                }}
                className="p-2 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em]">
                    <Calendar className="w-3 h-3" /> Transaction_Date
                  </div>
                  <p className="font-mono text-zinc-200 text-sm pl-5">
                    {selectedInvoice.invoice_date || "N/A"}
                  </p>
                </div>
                <div className="space-y-2 text-right">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] justify-end">
                    Order_Serial <Hash className="w-3 h-3" />
                  </div>

                  {/* THIS IS THE UPDATED FLEX CONTAINER */}
                  <div className="flex items-center justify-end gap-3 group/serial pl-5">
                    <p className="font-mono text-zinc-200 text-sm">
                      #{selectedInvoice.order_number || "NOT_RECORDED"}
                    </p>

                    <button
                      onClick={() => handleManualRescan(selectedInvoice)}
                      disabled={isRescanning}
                      className={`p-1.5 rounded-md border transition-all ${
                        isRescanning
                          ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-blue-500/50 hover:text-blue-400"
                      }`}
                      title="Force Re-scan"
                    >
                      <Loader2
                        className={`w-3 h-3 ${isRescanning ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {selectedInvoice.service_address && (
                <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-[9px] text-blue-500 uppercase font-black tracking-[0.2em]">
                    <MapPin className="w-4 h-4" /> Service_Location_Data
                  </div>
                  <p className="text-zinc-300 font-mono text-xs leading-relaxed pl-6 italic uppercase">
                    {selectedInvoice.service_address}
                  </p>
                </div>
              )}

              <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                      Line_Item_Breakdown
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-sm">
                    <CreditCard className="w-4 h-4" /> $ $
                    {Number(selectedInvoice.total_amount).toFixed(2)}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-zinc-900 text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="p-4 font-normal uppercase tracking-tighter">
                          Description
                        </th>
                        <th className="p-4 font-normal text-center">QTY</th>
                        <th className="p-4 font-normal text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {selectedInvoice.items?.map((item, i) => (
                        <tr
                          key={i}
                          className="text-zinc-300 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 leading-tight">
                            {item.description}
                          </td>
                          <td className="p-4 text-center text-zinc-500">
                            {item.qty}
                          </td>
                          <td
                            className={`p-4 text-right font-bold ${item.price < 0 ? "text-green-400" : "text-blue-400"}`}
                          >
                            {item.price < 0
                              ? `- $${Math.abs(Number(item.price)).toFixed(2)}`
                              : `$${Number(item.price).toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-zinc-800 bg-zinc-950/50">
                      <tr>
                        <td className="p-3 pl-4 text-zinc-500 uppercase tracking-widest text-[9px]">
                          Tax_Amount
                        </td>
                        <td></td>
                        <td className="p-3 pr-4 text-right text-zinc-400">
                          ${Number(selectedInvoice.tax_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 pl-4 text-zinc-500 uppercase tracking-widest text-[9px]">
                          Shipping_Logistics
                        </td>
                        <td></td>
                        <td className="p-3 pr-4 text-right text-zinc-400">
                          $
                          {Number(selectedInvoice.shipping_amount || 0).toFixed(
                            2,
                          )}
                        </td>
                      </tr>
                      {Number(selectedInvoice.discount_amount) > 0 && (
                        <tr className="bg-green-500/5">
                          <td className="p-3 pl-4 text-green-900 font-black uppercase tracking-widest text-[9px]">
                            Applied_Discount
                          </td>
                          <td></td>
                          <td className="p-3 pr-4 text-right text-green-500">
                            -$
                            {Number(selectedInvoice.discount_amount).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-zinc-800 bg-zinc-900/30">
                        <td className="p-4 pl-4 text-white font-black italic uppercase tracking-tighter text-[11px]">
                          Final_Settlement
                        </td>
                        <td></td>
                        <td className="p-4 pr-4 text-right text-blue-500 font-black text-lg drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                          ${Number(selectedInvoice.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                  >
                    <ExternalLink className="w-4 h-4" />{" "}
                    Open_Original_Source_PDF
                  </a>
                )}
                <button
                  onClick={() => handleDelete(selectedInvoice)}
                  className="w-full py-4 bg-transparent border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)] text-zinc-500 hover:text-red-400 flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Wipe_Record_From_Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TOAST NOTIFICATION SYSTEM */}
      {toast.show && (
        <div className="fixed bottom-10 right-10 z-[200] animate-in slide-in-from-right-10 duration-500">
          <div
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                : "bg-red-500/10 border-red-500/50 text-red-400"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            ) : (
              <X className="w-5 h-5 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            )}
            <div className="flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                System_Notification
              </p>
              <p className="font-mono text-xs opacity-80 uppercase tracking-tighter">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
