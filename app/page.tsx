import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] flex flex-col font-body">
      {/* Navbar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex justify-between items-center border-b border-gray-800/40">
        <Link href="/" className="text-2xl font-display font-extrabold tracking-tight">
          Saleswin<span className="text-[#00D68F]">AI</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold">
          <Link href="/login" className="text-gray-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-[#00D68F] text-[#080810] rounded-lg hover:bg-[#00b378] transition-colors"
          >
            Register Company
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-20 flex flex-col justify-center items-center text-center space-y-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#00D68F] bg-[#00D68F]/10 px-4 py-1.5 rounded-full border border-[#00D68F]/20">
          Now Launching in Nigeria
        </span>
        <h1 className="text-5xl md:text-6xl font-display font-black text-white leading-tight tracking-tight max-w-3xl">
          Turn Real Estate Objections into <span className="text-[#00D68F]">Signed Deals</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl font-body">
          Nigerian real estate markets are fast-paced. SaleswinAI uses customized, local AI personas to train your agents to handle tough negotiations and close Lagos, Abuja, and Port Harcourt property deals.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-4">
          <Link
            href="/register"
            className="px-8 py-4 bg-[#00D68F] text-[#080810] font-bold rounded-xl hover:bg-[#00b378] transition-all text-center"
          >
            Create Company Workspace
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-white font-bold rounded-xl transition-all text-center"
          >
            Sign In as Agent
          </Link>
        </div>

        {/* Feature Grid */}
        <section className="grid sm:grid-cols-3 gap-6 w-full pt-16">
          <div className="p-6 bg-[#12121E] border border-gray-800/80 rounded-2xl text-left space-y-2">
            <div className="text-xl font-bold text-[#00D68F]">01</div>
            <h3 className="font-display font-bold text-white text-base">Nigerian Personas</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-body">
              Train against high-net-worth buyers, Diaspora investors, or first-time buyers with localized objections.
            </p>
          </div>
          <div className="p-6 bg-[#12121E] border border-gray-800/80 rounded-2xl text-left space-y-2">
            <div className="text-xl font-bold text-[#00D68F]">02</div>
            <h3 className="font-display font-bold text-white text-base">Interactive Simulators</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-body">
              Real-time voice and text objections to simulate site inspection queries and off-plan deposit closes.
            </p>
          </div>
          <div className="p-6 bg-[#12121E] border border-gray-800/80 rounded-2xl text-left space-y-2">
            <div className="text-xl font-bold text-[#00D68F]">03</div>
            <h3 className="font-display font-bold text-white text-base">Performance Analytics</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-body">
              Track closing velocity, objection resolution rates, and score conversations directly inside the owner dashboard.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800/40 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} SaleswinAI. All rights reserved. Built for modern African sales forces.
      </footer>
    </div>
  );
}
