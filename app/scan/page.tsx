"use client";
import { useState, useCallback } from "react";
import { scanInvoice } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Trash2,
} from "lucide-react";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// --- HELPER DEFINED OUTSIDE COMPONENT ---
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

  // Helper to update state safely
  const updateTaskStatus = useCallback(
    (name: string, status: UploadTask["status"], error?: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.name === name ? { ...t, status, error } : t)),
      );
    },
    [],
  );

  // NEW: Dedicated function for a single file to allow parallel execution
  const processSingleFile = async (file: File, userId: string) => {
    updateTaskStatus(file.name, "scanning");

    try {
      // Reduced delay to 500ms for better UX
      await delay(500);

      const base64String = await fileToBase64(file);
      const filePath = generateFilePath(userId, file.name);

      // PARALLEL STEP: Upload and Scan at the same time
      const [uploadRes, rawResponse] = await Promise.all([
        supabase.storage.from("invoices").upload(filePath, file),
        scanInvoice(base64String, file.type),
      ]);

      if (uploadRes.error) throw new Error("UPLOAD_FAILED");

      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : rawResponse;
      const parsedData = JSON.parse(cleanJson);

      await supabase.from("invoices").insert({
        user_id: userId,
        vendor_name: parsedData.vendor,
        category: parsedData.category,
        total_amount: parsedData.total,
        invoice_date: parsedData.date,
        items: parsedData.items,
        order_number: parsedData.order_number,
        service_address: parsedData.service_address,
        file_path: filePath,
      });

      updateTaskStatus(file.name, "success");
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      const errorType =
        err instanceof SyntaxError ? "JSON_PARSE_ERROR" : "EXTRACTION_ERROR";
      updateTaskStatus(file.name, "failed", errorType);
    }
  };

  const processFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const newTasks: UploadTask[] = files.map((f) => ({
      name: f.name,
      status: "pending",
    }));

    setTasks((prev) => [...prev, ...newTasks]);
    setIsProcessing(true);

    // TRIGGER ALL PROCESSES AT ONCE
    await Promise.all(
      files.map((file) => processSingleFile(file, session.user.id)),
    );

    setIsProcessing(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Batch_Ingest_Module
        </h2>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] mt-2">
          Queue_System_Active
        </p>
      </div>

      <div className="relative group mb-12">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-10 group-hover:opacity-25 transition duration-1000"></div>
        <label className="relative p-12 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center text-center cursor-pointer hover:border-zinc-700 transition-all">
          <Upload
            className={`w-10 h-10 mb-4 ${isProcessing ? "text-zinc-600" : "text-blue-500"}`}
          />
          <span className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
            {isProcessing
              ? "Processing Batch..."
              : "Drop Files or Click to Browse"}
          </span>
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
        <div className="space-y-3 bg-black/40 p-6 rounded-2xl border border-zinc-800 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Live_Process_Queue
            </h3>

            {!isProcessing && (
              <button
                onClick={() => setTasks([])}
                className="flex items-center gap-2 text-[9px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-all group"
              >
                <Trash2 className="w-3 h-3 group-hover:animate-pulse" />[
                Clear_History ]
              </button>
            )}
          </div>

          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50"
              >
                <div className="flex items-center gap-4 truncate">
                  <FileText
                    className={`w-4 h-4 shrink-0 ${task.status === "success" ? "text-green-500/50" : "text-zinc-600"}`}
                  />
                  <span
                    className={`text-xs font-mono truncate max-w-[200px] md:max-w-md ${task.status === "failed" ? "text-zinc-500" : "text-zinc-300"}`}
                  >
                    {task.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {task.status === "pending" && (
                    <span className="text-[9px] text-zinc-600 uppercase font-bold">
                      Waiting...
                    </span>
                  )}
                  {task.status === "scanning" && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                      <span className="text-[9px] text-blue-400 uppercase font-bold animate-pulse">
                        Scanning_AI
                      </span>
                    </div>
                  )}
                  {task.status === "success" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {task.status === "failed" && (
                    <div className="flex items-center gap-2 text-red-500">
                      <span className="text-[9px] uppercase font-bold">
                        {task.error}
                      </span>
                      <AlertCircle className="w-4 h-4" />
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
