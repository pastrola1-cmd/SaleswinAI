"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteDocument } from "./actions"
import Link from "next/link"

interface DocumentItem {
  id: string
  file_name: string
  file_type: string
  status: string
  word_count: number
  created_at: string
}

interface KnowledgeDashboardClientProps {
  documents: DocumentItem[]
  stats: {
    products: number
    pricing: number
    objections: number
    competitors: number
    personas: number
    policies: number
    usps: number
    faq: number
    scripts: number
  }
}

export default function KnowledgeDashboardClient({
  documents,
  stats,
}: KnowledgeDashboardClientProps) {
  const router = useRouter()
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRetry = async (docId: string) => {
    setRetryingId(docId)
    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      })
      if (!res.ok) {
        throw new Error("Retry failed")
      }
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to re-process document. Please try again.")
    } finally {
      setRetryingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await deleteDocument(deletingId)
      if (res.error) {
        throw new Error(res.error)
      }
      setDeletingId(null)
      router.refresh()
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const companyBrainSummary = `Your AI Brain knows: ${stats.products} products, ${stats.pricing} pricing options, ${stats.objections} objections, ${stats.competitors} competitor comparisons, ${stats.personas} personas, ${stats.policies} policies, ${stats.usps} USPs, ${stats.faq} FAQs, and ${stats.scripts} scripts.`

  return (
    <div className="space-y-8 font-body">
      
      {/* AI Brain Summary Banner */}
      <section className="bg-gradient-to-r from-[#12121E] to-[#16162a] border border-[#00D68F]/20 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00D68F] animate-pulse"></span>
          <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">AI Brain Status</h2>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed font-medium">
          {companyBrainSummary}
        </p>
      </section>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Document List */}
        <section className="md:col-span-2 bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-gray-800/80 flex justify-between items-center">
            <h3 className="font-display font-bold text-white text-lg">Business Materials</h3>
            <Link
              href="/dashboard/onboarding"
              className="px-4 py-2 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-lg text-xs transition-colors"
            >
              + Add More Documents
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                  <th className="p-4">Resource</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Word Count</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                      <td className="p-4 font-semibold text-white truncate max-w-[200px]" title={doc.file_name}>
                        {doc.file_name}
                      </td>
                      <td className="p-4 uppercase font-semibold text-gray-400">{doc.file_type}</td>
                      <td className="p-4 text-gray-300">{doc.word_count || 0} words</td>
                      <td className="p-4">
                        {doc.status === "ready" && (
                          <span className="inline-flex items-center space-x-1 text-green-400 font-semibold bg-green-500/10 px-2.5 py-0.5 rounded border border-green-500/20 uppercase tracking-wider text-[10px]">
                            <span>✓</span> <span>Ready</span>
                          </span>
                        )}
                        {doc.status === "processing" && (
                          <span className="inline-flex items-center space-x-2 text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider text-[10px]">
                            <span className="w-2 h-2 border-2 border-t-transparent border-amber-400 rounded-full animate-spin"></span>
                            <span>Processing</span>
                          </span>
                        )}
                        {doc.status === "failed" && (
                          <span className="inline-flex items-center space-x-1 text-red-400 font-semibold bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20 uppercase tracking-wider text-[10px]">
                            <span>✕</span> <span>Failed</span>
                          </span>
                        )}
                        {doc.status === "pending" && (
                          <span className="inline-flex items-center space-x-1 text-gray-400 font-semibold bg-gray-500/10 px-2.5 py-0.5 rounded border border-gray-500/20 uppercase tracking-wider text-[10px]">
                            <span>○</span> <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {doc.status === "failed" && (
                          <button
                            disabled={retryingId === doc.id}
                            onClick={() => handleRetry(doc.id)}
                            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-[#080810] font-bold rounded transition-colors text-[10px]"
                          >
                            {retryingId === doc.id ? "Retrying..." : "Retry"}
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(doc.id)}
                          className="px-2 py-1 bg-red-950/40 hover:bg-red-950 border border-red-500/20 hover:border-red-500 text-red-200 font-bold rounded transition-colors text-[10px]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No business materials uploaded yet. Click &quot;Add More Documents&quot; to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Brain Category Breakdowns */}
        <section className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="font-display font-bold text-white text-lg border-b border-gray-800 pb-3">Brain Directory</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Products</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.products} facts</span>
            </div>
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Pricing Options</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.pricing} facts</span>
            </div>
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Objections</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.objections} facts</span>
            </div>
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Competitors</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.competitors} facts</span>
            </div>
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Personas</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.personas} facts</span>
            </div>
            <div className="p-3 bg-[#080810]/50 border border-gray-800 rounded-xl">
              <span className="text-gray-500 uppercase tracking-wider font-semibold block">Policies</span>
              <span className="text-lg font-bold text-white block mt-1">{stats.policies} facts</span>
            </div>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-[#080810]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121E] border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
            <h4 className="font-display font-bold text-white text-lg">Delete Document?</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              This will permanently remove the document from your business knowledge repository and clean up all associated facts from your AI Knowledge Brain.
            </p>
            <div className="flex justify-end space-x-2 pt-2 text-xs">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-gray-900 border border-gray-800 text-gray-300 font-bold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-red-950 hover:bg-red-900 text-red-200 border border-red-500/20 font-bold rounded-lg transition-colors"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
