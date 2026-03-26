"use client";

import { useState, useCallback } from "react";
import { scanInvoice } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { InvoiceExtraction } from "../../types/invoice";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Trash2,
  Cpu,
} from "lucide-react";

// --- HELPER UTILITIES ---
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const generateFilePath = (userId: string, fileName: string) => {
  const timestamp = Date.now();
  return `${userId}/${timestamp}-${fileName}`;
};

interface UploadTask {
  name: string;
  status: "pending" | "scanning" | "success" | "failed";
  error?: string;
}

export default function ScanPage() {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateTaskStatus = useCallback(
    (name: string, status: UploadTask["status"], error?: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.name === name ? { ...t, status, error } : t)),
      );
    },
    [],
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * CORE LOGIC: processSingleFile
   * Includes Exponential Backoff for 503 stability and Supabase integration.
   */

  const processSingleFile = async (file: File, userId: string) => {
    updateTaskStatus(file.name, "scanning");

    try {
      const base64String = await fileToBase64(file);
      const filePath = generateFilePath(userId, file.name);

      let parsedData: InvoiceExtraction | undefined;
      let retryAttempt = 0;
      const maxRetries = 4;

      // 1. AI EXTRACTION LOOP
      while (retryAttempt <= maxRetries) {
        try {
          const rawResponse = await scanInvoice(base64String, file.type);
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          const cleanJson = jsonMatch ? jsonMatch[0] : rawResponse;
          
          const rawData = JSON.parse(cleanJson);

          parsedData = {
            ...rawData,
            total_amount: Number(rawData.total_amount ?? rawData.total ?? 0),
            tax_amount: Number(rawData.tax_amount ?? rawData.tax ?? 0),
            vendor: rawData.vendor || "UNKNOWN_VENDOR",
            category: rawData.category || "Uncategorized",
            items: rawData.items ?? [],
          } as InvoiceExtraction;

          if (parsedData.vendor && parsedData.vendor !== "NOT_RECORDED") break;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
          
          const isRetryable = 
            errorMessage.includes("503") || 
            errorMessage.includes("429") || 
            errorMessage.includes("SyntaxError") ||
            errorMessage.includes("position");

          if (isRetryable && retryAttempt < maxRetries) {
            const waitTime = Math.pow(2, retryAttempt + 1) * 1000;
            console.warn(`[Retry ${retryAttempt + 1}] ${file.name}: ${errorMessage.slice(0, 50)}`);
            await delay(waitTime);
            retryAttempt++;
            continue;
          }
          throw err; 
        }
        retryAttempt++;
      }

      if (!parsedData) throw new Error("EXTRACTION_FAILED");

      // 2. STORAGE UPLOAD
      const { error: storageError } = await supabase.storage
        .from("invoices")
        .upload(filePath, file);

      if (storageError) throw storageError;

      // 3. DATABASE INSERT
      // Mapping the interface to your EXACT Supabase column names
      const insertData = {
        user_id: userId,
        file_path: filePath,
        // Mapping code variable 'vendor' to DB column 'vendor_name'
        vendor_name: parsedData.vendor, 
        invoice_number: parsedData.invoice_number || parsedData.order_number,
        total_amount: parsedData.total_amount,
        tax_amount: parsedData.tax_amount,
        category: parsedData.category,
        // Mapping code variable 'date' to DB column 'invoice_date'
        invoice_date: parsedData.date, 
        items: parsedData.items, // Already a JSONB array
        raw_json: parsedData     // The full object
      };

const { error: dbError } = await supabase.from("invoices").insert([insertData]);

      if (dbError) {
        console.error("SUPABASE_INSERT_ERROR:", dbError);
        // Fallback: Try inserting without the problematic columns if they are missing
        if (dbError.message.includes("column")) {
           console.warn("Attempting emergency insert without date/raw_json...");
           const { invoice_date, raw_json, ...fallbackData } = insertData;
           const { error: retryDbError } = await supabase.from("invoices").insert([fallbackData]);
           if (retryDbError) throw retryDbError;
        } else {
          throw dbError;
        }
      }

      updateTaskStatus(file.name, "success");
    } catch (err: unknown) {
      console.error("DETAILED_FINAL_ERROR:", err);
      const errorString = err instanceof Error ? err.message : "PROCESS_FAILED";
      updateTaskStatus(file.name, "failed", errorString.slice(0, 30));
    }
  };
  

  const processFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setTasks((prev) => [
      ...prev, 
      ...files.map((f): UploadTask => ({ name: f.name, status: "pending" }))
    ]);
    setIsProcessing(true);

    // Paid Tier: We can push to 4 or 5 workers safely
    const CONCURRENCY_LIMIT = 3; 
    const queue = [...files];

    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(async (_, workerIndex) => {
      // Stagger the initial start of each worker
      await delay(workerIndex * 800);
      
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;
        await processSingleFile(file, session.user.id);
        // Small rest period to let the connection close gracefully
        await delay(300); 
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12 text-center md:text-left">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Batch_Ingest_Module
        </h2>
        <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${isProcessing ? 'bg-blue-500 shadow-blue-500/50' : 'bg-yellow-500 shadow-yellow-500/50'}`}></div>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase">
            System_Status: {isProcessing ? "Processing..." : "Ready"} {"//"}{" "}
            Node_Active
          </p>
        </div>
      </header>

      <div className="relative group mb-12">
        <div className="absolute -inset-1 bg-blue-600/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-500"></div>

        <label
          className="relative p-16 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-[2.5rem] flex flex-col items-center text-center cursor-pointer 
          hover:border-blue-500/50 hover:bg-zinc-900/80 transition-all duration-300 backdrop-blur-sm 
          hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)] group-active:scale-[0.98]"
        >
          <div className="p-5 bg-zinc-950 rounded-2xl border border-zinc-800 mb-6 shadow-inner group-hover:border-blue-500/30 transition-colors">
            <Upload
              className={`w-10 h-10 transition-transform duration-500 group-hover:scale-110 ${
                isProcessing
                  ? "text-zinc-700 animate-pulse"
                  : "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              }`}
            />
          </div>

          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">
            {isProcessing ? "Ingesting_Data_Stream..." : "Drop_Records_Into_Module"}
          </h3>

          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400">
            Supported_Formats: PNG, JPG // Click_To_Browse
          </p>

          <input
            type="file"
            multiple
            disabled={isProcessing}
            onChange={processFiles}
            className="hidden"
          />
        </label>
      </div>

      {tasks.length > 0 && (
        <div className="space-y-4 bg-zinc-900/20 p-8 rounded-3xl border border-zinc-800/50 shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6 border-b border-zinc-800/50 pb-4">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-zinc-600" />
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Live_Process_Queue [{tasks.length}]
              </h3>
            </div>

            {!isProcessing && (
              <button
                onClick={() => setTasks([])}
                className="flex items-center gap-2 text-[9px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-all group px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-red-900/50"
              >
                <Trash2 className="w-3 h-3 group-hover:animate-pulse" />
                Clear_Buffer
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 transition-colors group hover:border-zinc-600"
              >
                <div className="flex items-center gap-4 truncate">
                  <div
                    className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${task.status === "success" ? "text-green-500/50 border-green-500/20" : "text-zinc-600"}`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                  </div>
                  <span
                    className={`text-xs font-mono font-bold truncate max-w-[200px] md:max-w-md ${task.status === "failed" ? "text-red-400/50" : "text-zinc-300"}`}
                  >
                    {task.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {task.status === "scanning" && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                      <span className="text-[9px] text-blue-400 uppercase font-black animate-pulse tracking-tighter">
                        AI_SCAN_ACTIVE
                      </span>
                    </div>
                  )}
                  {task.status === "success" && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-[9px] text-green-400 uppercase font-black tracking-tighter">
                        Verified
                      </span>
                    </div>
                  )}
                  {task.status === "failed" && (
                    <div className="flex items-center gap-2 text-red-500 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                      <span className="text-[9px] uppercase font-black tracking-tighter">
                        {task.error}
                      </span>
                      <AlertCircle className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}