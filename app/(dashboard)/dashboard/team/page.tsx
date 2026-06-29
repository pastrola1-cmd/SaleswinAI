import Link from "next/link"

export default function TeamShellPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto font-body">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display font-extrabold text-white">
          Team Overview
        </h1>
      </div>
      <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-[#00D68F]/10 border border-[#00D68F]/20 rounded-full flex items-center justify-center mx-auto text-2xl">
          👥
        </div>
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20 rounded uppercase tracking-wider">
            Feature Sandbox
          </span>
          <h2 className="font-display font-bold text-white text-lg">Team Overview Sandbox Mode</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Manage your salespeople, assign team target milestones, and monitor average objection handling metrics.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 font-bold rounded-lg text-xs transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
