import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function scanInvoice(base64Image: string, fileType: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = "Extract the Vendor, Date, and Total from this document. List the items clearly.";

  const fileData = {
    inlineData: {
      data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
      // This dynamically sets the type (image/png, application/pdf, etc.)
      mimeType: fileType, 
    },
  };

  try {
    const result = await model.generateContent([prompt, fileData]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Scan failed. Google is likely warming up your quota. Try again in 1 minute.";
  }
}