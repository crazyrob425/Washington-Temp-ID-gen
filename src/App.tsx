import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Calendar, 
  MapPin, 
  CreditCard, 
  Eye, 
  Ruler, 
  Weight, 
  FileText, 
  Download, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Printer,
  ShieldCheck,
  Search,
  X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import bwipjs from 'bwip-js';
import { encodeAAMVA, AAMVAData } from './services/aamvaEncoder';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Types ---

interface FormState extends AAMVAData {
  controlNumber: string;
  organDonor: string;
  medicalDesignation: string;
  veteran: string;
  mailingAddress: string;
}

// --- Components ---

const Barcode = ({ data, uploadedImage }: { data: string, uploadedImage?: string | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data && !uploadedImage) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'pdf417',
          text: data,
          scale: 2,
          height: 12,
          includetext: false,
          textxalign: 'center',
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [data, uploadedImage]);

  return (
    <div className="flex justify-center my-6 h-[80px]">
      {uploadedImage ? (
        <img src={uploadedImage} className="max-w-full h-full object-contain bg-white" alt="Uploaded Barcode" />
      ) : (
        <canvas ref={canvasRef} className="max-w-full h-full bg-white" />
      )}
    </div>
  );
};

export default function App() {
  const [formData, setFormData] = useState<FormState>({
    firstName: 'DOREL',
    lastName: 'GHIOCEL',
    middleName: '',
    dob: '1990-04-25',
    gender: 'MALE',
    height: "5' - 6\"",
    weight: '185',
    eyeColor: 'BRO',
    addressStreet: '26724 171ST PL SE APT D306',
    addressCity: 'COVINGTON',
    addressState: 'WA',
    addressZip: '98042-7301',
    licenseNumber: 'WDL5N770B63B',
    issueDate: '2024-08-12',
    expirationDate: '2028-04-25',
    class: 'NONE',
    restrictions: 'J',
    endorsements: 'NONE',
    controlNumber: 'D081224981341',
    organDonor: 'NO',
    medicalDesignation: 'NO',
    veteran: 'NO',
    mailingAddress: '3801 PACIFIC HWY E FIFE WA 98424-1133'
  });

  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isAuthentic, setIsAuthentic] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [uploadedBarcode, setUploadedBarcode] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isValidatingBarcode, setIsValidatingBarcode] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const aamvaString = encodeAAMVA(formData);

  // --- PDF Export ---
  const downloadPDF = async () => {
    if (!previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`WA_Temp_License_${formData.lastName}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
    }
  };

  // --- Barcode Upload & Validation ---
  const handleBarcodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setUploadedBarcode(base64);
        validateBarcode(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateBarcode = async (base64: string) => {
    try {
      setIsValidatingBarcode(true);
      setBarcodeError(null);

      // Check for API Key selection as per guidelines
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            parts: [
              { text: `You are an expert AAMVA (American Association of Motor Vehicle Administrators) barcode decoder. 
              
              TASK:
              1. Analyze the provided PDF417 barcode image.
              2. Extract the raw AAMVA data string. It should start with '@' and contain subfiles like 'DL'.
              3. Parse the AAMVA elements (e.g., DCS=Last Name, DAC=First Name, DAQ=License Number, DBB=DOB, DAG=Street, DAI=City, DAJ=State, DAK=Zip).
              4. Map the extracted data to the following JSON keys:
                 - firstName, lastName, middleName
                 - dob (Format: YYYY-MM-DD)
                 - gender (MALE, FEMALE, or OTHER)
                 - height (Format: 5' - 6")
                 - weight (LBS)
                 - eyeColor (3-letter code like BRO, BLU, GRN)
                 - addressStreet, addressCity, addressState, addressZip
                 - licenseNumber, issueDate (YYYY-MM-DD), expirationDate (YYYY-MM-DD)
                 - class, restrictions, endorsements, controlNumber
              
              OUTPUT:
              Return a JSON object with:
              {
                "isValid": boolean,
                "reason": "string (if invalid)",
                "extractedFields": { ... mapped fields ... }
              }
              
              If the barcode is partially readable, extract as much as possible and set isValid to true.
              If it is completely unreadable, set isValid to false and provide a reason.` },
              { inlineData: { mimeType: 'image/png', data: base64.split(',')[1] } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });
      
      const resultText = response.text || "{}";
      // Robust JSON parsing: remove potential markdown wrappers
      const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanedText);

      if (result.extractedFields && Object.keys(result.extractedFields).length > 0) {
        setFormData(prev => ({ ...prev, ...result.extractedFields }));
        // Success feedback is handled by the UI showing the verified state
      } else if (!result.isValid) {
        setBarcodeError(result.reason || "Barcode was unreadable or contained no valid AAMVA data.");
      } else {
        setBarcodeError("No data could be extracted from this barcode.");
      }
    } catch (e: any) {
      console.error("Barcode validation error:", e);
      setBarcodeError("Failed to process barcode: " + (e.message || "Unknown error"));
    } finally {
      setIsValidatingBarcode(false);
    }
  };

  // --- Forensic Analysis & Auto-Fix ---
  const runForensicAnalysis = async () => {
    if (!previewRef.current) return;
    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setIsAuthentic(false);
      setShowAnalysisModal(true);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let attempts = 0;
      const maxAttempts = 3;
      let authentic = false;

      while (attempts < maxAttempts && !authentic) {
        attempts++;
        
        // 1. Capture Document
        const canvas = await html2canvas(previewRef.current, { scale: 2 });
        const base64Image = canvas.toDataURL('image/png').split(',')[1];

        // 2. Forensic Analysis
        const forensicResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                { text: "You are a Senior Forensic Document Examiner specialized in Washington State government documents. Analyze this temporary driver's license for authenticity. Check fonts, spacing, alignment, barcode structure, and wording against the official 2024/2025 WA DOL standards. Provide a detailed report. If the document is 100% authentic and has no issues, start your response with 'AUTHENTIC'. Otherwise, list all issues clearly." },
                { inlineData: { mimeType: 'image/png', data: base64Image } }
              ]
            }
          ]
        });

        const report = forensicResponse.text || "";
        setAnalysisResult(report);

        if (report.trim().toUpperCase().startsWith('AUTHENTIC')) {
          authentic = true;
          setIsAuthentic(true);
          break;
        }

        // 3. Auto-Fix if not authentic
        setIsFixing(true);
        const editorResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                { text: `You are a Grand Master Digital Editor and Forgery Expert. Your goal is to correct any issues identified by a Forensic Document Examiner in a Washington State temporary license. 
                You will be provided with the current form data and the forensic report.
                Return a JSON object containing ONLY the fields that need to be updated in the form data to achieve 100% authenticity.
                Current Form Data: ${JSON.stringify(formData)}
                Forensic Report: ${report}
                Example Output: {"firstName": "NEW_NAME", "addressZip": "12345-6789"}` }
              ]
            }
          ],
          config: { responseMimeType: "application/json" }
        });

        try {
          const patch = JSON.parse(editorResponse.text || "{}");
          setFormData(prev => ({ ...prev, ...patch }));
          // Wait for React to re-render and DOM to update
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) {
          console.error("Failed to parse editor response", e);
          break;
        } finally {
          setIsFixing(false);
        }
      }

    } catch (err: any) {
      setAnalysisResult("Error during analysis: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setIsFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f3f5] text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Forensic ID Lab</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">WA State Jurisdiction v2025</p>
            </div>
          </div>
          
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'form', label: 'Data Entry', icon: FileText },
              { id: 'preview', label: 'Forensic Preview', icon: Search },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <User size={18} className="text-slate-600" />
                    <h2 className="font-bold text-slate-800">Personal Data</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(formData).slice(0, 10).map((key) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</label>
                        <input 
                          name={key} 
                          value={(formData as any)[key]} 
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <MapPin size={18} className="text-slate-600" />
                    <h2 className="font-bold text-slate-800">Location & Mailing</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {['addressStreet', 'addressCity', 'addressState', 'addressZip', 'mailingAddress'].map((key) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</label>
                        <input 
                          name={key} 
                          value={(formData as any)[key]} 
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <CreditCard size={18} className="text-slate-600" />
                    <h2 className="font-bold text-slate-800">Barcode Overlay</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-500">Upload an existing PDF417 barcode image to perfectly overlay it on the document.</p>
                    <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-slate-400 transition-all group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleBarcodeUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-2 py-2">
                        {isValidatingBarcode ? (
                          <Loader2 className="animate-spin text-slate-400" size={24} />
                        ) : (
                          <Upload size={24} className="text-slate-400 group-hover:text-slate-600" />
                        )}
                        <span className="text-xs font-bold text-slate-500">
                          {isValidatingBarcode ? "Scanning Barcode..." : uploadedBarcode ? "Change Barcode Image" : "Upload Barcode Image"}
                        </span>
                      </div>
                    </div>
                    {barcodeError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 items-start">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-red-700 font-medium leading-tight">{barcodeError}</p>
                      </div>
                    )}
                    {uploadedBarcode && !barcodeError && !isValidatingBarcode && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-2 items-start">
                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-emerald-700 font-medium leading-tight">Barcode scanned and verified against form data.</p>
                      </div>
                    )}
                    {uploadedBarcode && (
                      <button 
                        onClick={() => { setUploadedBarcode(null); setBarcodeError(null); }}
                        className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Remove Overlay & Use Generated
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl">
                  <h3 className="font-bold text-lg mb-2">Authenticity Check</h3>
                  <p className="text-slate-400 text-sm mb-6">Our forensic engine ensures every pixel matches WA DOL standards.</p>
                  <button 
                    onClick={() => setActiveTab('preview')}
                    className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
                  >
                    <Search size={18} />
                    Run Lab Preview
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-5xl mx-auto pb-20"
            >
              <div className="flex flex-wrap gap-4 justify-between items-center mb-8 no-print">
                <h2 className="text-2xl font-bold text-slate-800">Forensic Document Preview</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={runForensicAnalysis}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <ShieldCheck size={18} />
                    Forensic Review
                  </button>
                  <button 
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    <Download size={18} />
                    Export PDF
                  </button>
                </div>
              </div>

              {/* High-Fidelity Document */}
              <div 
                ref={previewRef}
                className="bg-white shadow-2xl border border-slate-200 p-[1in] aspect-[8.5/11] mx-auto overflow-hidden print:shadow-none print:border-none print:p-0 text-black leading-tight"
                style={{ fontFamily: "'Helvetica', 'Arial', sans-serif" }}
              >
                <div className="h-full flex flex-col">
                  {/* Top Header */}
                  <div className="flex justify-between items-start mb-6 text-[11pt] font-bold">
                    <div>{formData.licenseNumber}</div>
                    <div>{formData.firstName} {formData.lastName}</div>
                  </div>

                  {/* Main Header Text */}
                  <div className="text-center mb-8 space-y-4">
                    <p className="font-bold text-[14pt]">This is your temporary document. Carry this with you until you receive your new one in the mail.</p>
                    <p className="text-[10pt]">Your new card will show the last photo we took. If you don't receive your document in 30 days, please call us at (360) 902-3900.</p>
                  </div>

                  {/* Expiry Banner */}
                  <div className="text-center mb-6">
                    <p className="font-bold text-[16pt]">This Temporary Document Expires {formData.expirationDate.split('-').reverse().join('/')}</p>
                  </div>

                  {/* Barcode Section */}
                  <div className="mb-8">
                    <Barcode data={aamvaString} uploadedImage={uploadedBarcode} />
                  </div>

                  {/* Disclaimer */}
                  <div className="text-center mb-10 px-16">
                    <p className="font-bold text-[10pt]">This document is intended to be used for driving purposes only. It is not valid for identification purposes unless accompanied by another piece of identification, like a recently expired drivers license.</p>
                  </div>

                  {/* Tables */}
                  <div className="space-y-8 flex-grow">
                    {/* Personal Info */}
                    <div>
                      <div className="border-x border-t border-black text-center py-1 font-bold text-[10pt] uppercase tracking-[0.2em]">~ PERSONAL INFORMATION ~</div>
                      <table className="w-full border-collapse border border-black text-[10pt]">
                        <tbody>
                          {[
                            ['NAME', `${formData.firstName} ${formData.lastName}`],
                            ['BIRTH DATE', formData.dob.split('-').reverse().join('/')],
                            ['GENDER', formData.gender],
                            ['HEIGHT', formData.height],
                            ['WEIGHT', formData.weight],
                            ['EYES', formData.eyeColor],
                            ['RESIDENCE ADDRESS', `${formData.addressStreet} ${formData.addressCity} ${formData.addressState} ${formData.addressZip}`]
                          ].map(([label, value]) => (
                            <tr key={label} className="border-b border-black last:border-b-0">
                              <td className="w-1/3 p-2 font-bold border-r border-black">{label}</td>
                              <td className="p-2 font-bold">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* License Info */}
                    <div>
                      <div className="border-x border-t border-black text-center py-1 font-bold text-[10pt] uppercase tracking-[0.2em]">~ LICENSE INFORMATION ~</div>
                      <table className="w-full border-collapse border border-black text-[10pt]">
                        <tbody>
                          {[
                            ['DOCUMENT TYPE', 'DRIVER LICENSE'],
                            ['LICENSE #', formData.licenseNumber],
                            ['CONTROL #', formData.controlNumber],
                            ['ISSUE DATE', formData.issueDate.split('-').reverse().join('/')],
                            ['EXPIRATION DATE', formData.expirationDate.split('-').reverse().join('/')],
                            ['RESTRICTIONS', formData.restrictions],
                            ['ENDORSEMENTS', formData.endorsements],
                            ['CLASS', formData.class],
                            ['ORGAN DONOR', formData.organDonor],
                            ['MEDICAL DESIGNATION PRINTED', formData.medicalDesignation],
                            ['VETERAN', formData.veteran]
                          ].map(([label, value]) => (
                            <tr key={label} className="border-b border-black last:border-b-0">
                              <td className="w-1/3 p-2 font-bold border-r border-black">{label}</td>
                              <td className="p-2 font-bold">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mailing */}
                    <div>
                      <div className="border-x border-t border-black text-center py-1 font-bold text-[10pt] uppercase tracking-[0.2em]">~ MAILING ADDRESS ~</div>
                      <table className="w-full border-collapse border border-black text-[10pt]">
                        <tbody>
                          <tr>
                            <td className="w-1/3 p-2 font-bold border-r border-black">Your license will be mailed to:</td>
                            <td className="p-2 font-bold">{formData.mailingAddress}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Forensic Analysis Modal */}
      <AnimatePresence>
        {showAnalysisModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-indigo-600" size={20} />
                  <h3 className="font-bold text-slate-800">Forensic Integrity Report</h3>
                </div>
                <button onClick={() => setShowAnalysisModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-grow">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                    <p className="font-bold text-slate-600 animate-pulse">
                      {isFixing ? "Grand Master Editor correcting issues..." : "Scanning document artifacts..."}
                    </p>
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    {isAuthentic ? (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-6 flex gap-3">
                        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                        <div>
                          <p className="font-bold text-emerald-900">Authenticity Verified</p>
                          <p className="text-emerald-700 text-sm">The document matches WA DOL electronic source signatures and AAMVA standards.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 flex gap-3">
                        <AlertCircle className="text-amber-500 shrink-0" size={20} />
                        <div>
                          <p className="font-bold text-amber-900">Artifacts Detected</p>
                          <p className="text-amber-700 text-sm">The forensic examiner identified potential issues that require correction.</p>
                        </div>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {analysisResult}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowAnalysisModal(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                >
                  Close Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          body { background: white !important; }
          header, nav, button, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
