import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "super_admin") {
    redirect("/dashboard")
  }

  // Fetch list of companies for administration
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-gray-800/80 pb-6">
          <div>
            <h1 className="text-3xl font-display font-extrabold tracking-tight">
              Saleswin<span className="text-[#00D68F]">AI</span> <span className="text-sm font-semibold uppercase tracking-widest text-[#00D68F] bg-[#00D68F]/10 px-2.5 py-0.5 rounded ml-2 border border-[#00D68F]/20">Admin</span>
            </h1>
            <p className="text-sm text-gray-400 font-body">Super Administrator Portal & Platform Management</p>
          </div>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-gray-900 border border-gray-800 text-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Dashboard
          </a>
        </header>

        <main className="space-y-6">
          <section className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-display font-bold text-white mb-4">Platform Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#080810]/50 border border-gray-800 rounded-xl">
                <span className="text-xs text-gray-500 uppercase font-semibold">Total Businesses</span>
                <span className="block text-2xl font-bold text-white mt-1">{companies?.length || 0}</span>
              </div>
              <div className="p-4 bg-[#080810]/50 border border-gray-800 rounded-xl">
                <span className="text-xs text-gray-500 uppercase font-semibold">Real Estate Sector</span>
                <span className="block text-2xl font-bold text-white mt-1">
                  {companies?.filter((c) => c.industry === "real_estate").length || 0}
                </span>
              </div>
              <div className="p-4 bg-[#080810]/50 border border-gray-800 rounded-xl">
                <span className="text-xs text-gray-500 uppercase font-semibold">Active Subscriptions</span>
                <span className="block text-2xl font-bold text-[#00D68F] mt-1">
                  {companies?.filter((c) => c.plan_status === "active").length || 0}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/80">
              <h2 className="text-xl font-display font-bold text-white">Registered Companies</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-body">
                <thead>
                  <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                    <th className="p-4">Company Name</th>
                    <th className="p-4">Industry</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Registered At</th>
                  </tr>
                </thead>
                <tbody>
                  {companies && companies.length > 0 ? (
                    companies.map((company) => (
                      <tr key={company.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                        <td className="p-4 font-semibold text-white">{company.name}</td>
                        <td className="p-4 uppercase text-xs tracking-wider text-gray-400">{company.industry}</td>
                        <td className="p-4 uppercase text-xs font-semibold text-white">{company.plan}</td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 uppercase">
                            {company.plan_status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-gray-500">
                          {new Date(company.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No companies registered on the platform yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
