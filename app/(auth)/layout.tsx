import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#080810] text-[#F2F2F7]">
      <div className="w-full max-w-md mb-8 text-center">
        <Link href="/" className="inline-block text-4xl font-display font-extrabold tracking-tight hover:opacity-90 transition-opacity">
          Saleswin<span className="text-[#00D68F]">AI</span>
        </Link>
        <p className="mt-2 text-sm text-gray-400 font-body">
          Nigerian Sales Conversion Training Platform
        </p>
      </div>
      <div className="w-full max-w-md bg-[#12121E] border border-gray-800/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-md p-8">
        {children}
      </div>
    </div>
  );
}
