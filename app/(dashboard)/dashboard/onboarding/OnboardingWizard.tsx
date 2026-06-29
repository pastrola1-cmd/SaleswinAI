"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import confetti from "canvas-confetti"
import { saveCompanyDetails, uploadOnboardingFile, savePastedTexts } from "./actions"

interface OnboardingWizardProps {
  initialCompanyName: string
  initialWebsiteUrl: string
  initialLogoUrl: string
}

export default function OnboardingWizard({
  initialCompanyName,
  initialWebsiteUrl,
  initialLogoUrl,
}: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1 State
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [tagline, setTagline] = useState("")

  // Step 2 State
  const [files, setFiles] = useState<File[]>([])
  const [pastedText, setPastedText] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3 State
  const [scripts, setScripts] = useState("")
  const [faqs, setFaqs] = useState("")

  // Activation & Processing State
  const [isActivating, setIsActivating] = useState(false)
  const [activationStatus, setActivationStatus] = useState("")
  const [processingError, setProcessingError] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      setFiles((prev) => [...prev, ...droppedFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const nextStep = () => setStep((s) => s + 1)
  const prevStep = () => setStep((s) => s - 1)

  const handleActivateBrain = async () => {
    setIsActivating(true)
    setProcessingError(null)

    try {
      // 1. Save Company Details (Step 1)
      setActivationStatus("Saving company profile details...")
      const companyFormData = new FormData()
      companyFormData.append("websiteUrl", websiteUrl)
      companyFormData.append("logoUrl", logoUrl)
      const saveRes = await saveCompanyDetails(companyFormData)
      if (saveRes.error) {
        throw new Error(`Failed to save company details: ${saveRes.error}`)
      }

      // 2. Upload Files (Step 2)
      const documentIds: string[] = []
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setActivationStatus(`Uploading knowledge file ${i + 1} of ${files.length}: ${files[i].name}...`)
          const fileFormData = new FormData()
          fileFormData.append("file", files[i])
          const uploadRes = await uploadOnboardingFile(fileFormData)
          if (uploadRes.error) {
            throw new Error(`Failed to upload ${files[i].name}: ${uploadRes.error}`)
          }
          if (uploadRes.documentId) {
            documentIds.push(uploadRes.documentId)
          }
        }
      }

      // 3. Save Pasted Texts, Website reference, and scripts/FAQs (Step 2 & 3)
      if (pastedText.trim() || scripts.trim() || faqs.trim() || websiteUrl.trim()) {
        setActivationStatus("Structuring scripts, FAQs, and custom inputs...")
        const textRes = await savePastedTexts(scripts, faqs, websiteUrl)
        if (textRes.error) {
          throw new Error(`Failed to save text content: ${textRes.error}`)
        }
        if (textRes.documentIds) {
          documentIds.push(...textRes.documentIds)
        }

        if (pastedText.trim()) {
          const pastedRes = await savePastedTexts(pastedText, "", "")
          if (pastedRes.error) {
            throw new Error(`Failed to save pasted text: ${pastedRes.error}`)
          }
          if (pastedRes.documentIds) {
            documentIds.push(...pastedRes.documentIds)
          }
        }
      }

      // 4. Trigger Gemini Processing API sequentially for each doc
      if (documentIds.length === 0) {
        // Create at least one empty business profile doc so they have a default brain
        setActivationStatus("Creating default AI Brain profiles...")
        const defaultRes = await savePastedTexts(
          "We are a real estate agency offering quality properties in Nigeria.",
          "Q: What is our primary location? A: Lagos and major cities.",
          ""
        )
        if (defaultRes.documentIds) {
          documentIds.push(...defaultRes.documentIds)
        }
      }

      for (let i = 0; i < documentIds.length; i++) {
        setActivationStatus(`AI Brain is digesting content ${i + 1} of ${documentIds.length}...`)
        const processRes = await fetch("/api/process-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: documentIds[i] })
        })

        if (!processRes.ok) {
          const errData = await processRes.json()
          console.warn(`Warning processing document: ${errData.error || "Unknown API error"}`)
          // Proceed anyway to ensure flow isn't completely broken
        }
      }

      // 5. Success Confetti
      setActivationStatus("Your AI Brain is Ready!")
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      })

      // Delayed redirect to let user celebrate
      setTimeout(() => {
        router.push("/dashboard")
        router.refresh()
      }, 2500)

    } catch (err) {
      console.error(err)
      setProcessingError(err instanceof Error ? err.message : "An unexpected error occurred during processing.")
      setIsActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] flex flex-col justify-center items-center px-4 py-12 font-body">
      <div className="w-full max-w-2xl bg-[#12121E] border border-gray-800/80 rounded-2xl shadow-2xl p-8 space-y-6">
        
        {/* Wizard Steps Indicator */}
        <div className="flex justify-between items-center pb-6 border-b border-gray-800/60">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-center space-x-2">
              <span className={`w-8 h-8 rounded-full flex justify-center items-center font-bold text-sm ${
                step === num
                  ? "bg-[#00D68F] text-[#080810]"
                  : step > num
                  ? "bg-[#00D68F]/20 text-[#00D68F] border border-[#00D68F]/30"
                  : "bg-gray-900 text-gray-500 border border-gray-800"
              }`}>
                {num}
              </span>
              <span className={`text-xs font-semibold uppercase tracking-wider hidden sm:inline ${
                step === num ? "text-white" : "text-gray-500"
              }`}>
                {num === 1 ? "Profile" : num === 2 ? "Uploads" : num === 3 ? "Scripts" : "Activate"}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-white">Company Profile</h2>
              <p className="text-sm text-gray-400">Provide basic branding information about your business</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Website URL</label>
                <input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Logo Image URL</label>
                <input
                  type="url"
                  placeholder="https://yourcompany.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tagline / Brand Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Nigerian premium developer building smart homes in Lekki Phase 1."
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-[#00D68F] text-[#080810] font-bold rounded-lg hover:bg-[#00b378] transition-colors text-sm"
              >
                Next Step &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload Knowledge */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-white">Business Knowledge</h2>
              <p className="text-sm text-gray-400">Provide product brochures, property documents, pricing details, or custom text</p>
            </div>

            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                  isDragOver ? "border-[#00D68F] bg-[#00D68F]/5" : "border-gray-800 hover:border-[#00D68F]/50"
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.pptx"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <span className="text-xl text-[#00D68F]">&uarr;</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Drag & drop files or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">Accepts PDF, DOCX, PPTX, JPG/PNG, TXT (Max 50MB)</p>
                </div>
              </div>

              {/* Uploaded File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded Files</span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-[#080810] border border-gray-950 rounded-lg text-xs">
                        <span className="font-semibold text-gray-300 truncate max-w-sm">{file.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-red-400 hover:text-red-500 font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paste Text Directly */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paste Text Directly</label>
                <textarea
                  rows={4}
                  placeholder="Paste details about your developments, payment structure, properties, or project timelines here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-700 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                onClick={prevStep}
                className="px-6 py-3 bg-gray-950 border border-gray-800 text-gray-300 font-bold rounded-lg hover:bg-gray-900 transition-colors text-sm"
              >
                &larr; Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-[#00D68F] text-[#080810] font-bold rounded-lg hover:bg-[#00b378] transition-colors text-sm"
              >
                Continue &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Scripts & FAQs */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-white">Scripts & FAQs (Optional)</h2>
              <p className="text-sm text-gray-400">Share your best closing scripts or common questions so the AI can train agents on them</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paste your best sales script</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Agent: Welcome to Lekki Haven... Buyer: How much is the deposit... Agent: You can start with 20%..."
                  value={scripts}
                  onChange={(e) => setScripts(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-700 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add your most common customer FAQs</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Q: Do we have C of O? A: Yes, all government approvals are ready. Q: Is there a payment plan? A: Yes, 6 to 12 months."
                  value={faqs}
                  onChange={(e) => setFaqs(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-700 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                onClick={prevStep}
                className="px-6 py-3 bg-gray-950 border border-gray-800 text-gray-300 font-bold rounded-lg hover:bg-gray-900 transition-colors text-sm"
              >
                &larr; Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-[#00D68F] text-[#080810] font-bold rounded-lg hover:bg-[#00b378] transition-colors text-sm"
              >
                Continue &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Activate Brain */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-3xl font-display font-extrabold text-white">Activate Your AI Brain</h2>
              <p className="text-sm text-gray-400">Generate your customized SaleswinAI Knowledge Brain</p>
            </div>

            {/* Summary Box */}
            <div className="p-6 bg-[#080810]/50 border border-gray-800 rounded-2xl space-y-4 text-sm">
              <h4 className="font-semibold text-white">Knowledge Source Summary:</h4>
              <div className="space-y-2 text-xs text-gray-400 font-body">
                <div className="flex justify-between">
                  <span>Document Files Uploaded</span>
                  <span className="font-semibold text-white">{files.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pasted Custom Text</span>
                  <span className="font-semibold text-white">{pastedText.trim() ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custom Scripts & FAQs Included</span>
                  <span className="font-semibold text-white">{(scripts.trim() || faqs.trim()) ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between border-t border-gray-900 pt-2 text-sm text-[#00D68F] font-bold">
                  <span>Target Industry</span>
                  <span>Real Estate (Nigeria)</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {processingError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-xs">
                {processingError}
              </div>
            )}

            {/* Loading/Activating State */}
            {isActivating ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
                <div>
                  <p className="text-sm font-semibold text-white">Your AI Brain is learning your business...</p>
                  <p className="text-xs text-gray-500 mt-1 animate-pulse">{activationStatus}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <button
                  onClick={handleActivateBrain}
                  className="w-full py-4 bg-[#00D68F] text-[#080810] font-black rounded-xl hover:bg-[#00b378] transition-all shadow-[0_4px_20px_rgba(0,214,143,0.3)] text-sm uppercase tracking-wider"
                >
                  Activate AI Brain
                </button>
                <button
                  onClick={prevStep}
                  className="w-full py-3 bg-gray-950 border border-gray-800 text-gray-400 font-bold rounded-lg hover:bg-gray-900 transition-colors text-xs"
                >
                  &larr; Back to Edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
