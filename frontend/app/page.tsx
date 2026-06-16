import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <span className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </span>
        <div className="flex items-center gap-5">
          <Link href="/schemas" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">Schemas</Link>
          <Link href="/history" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">History</Link>
          <Link href="/results?demo=aws" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">View Demo</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-24 text-center max-w-4xl mx-auto w-full">
        <h1 className="text-5xl md:text-6xl font-bold text-[#111827] leading-tight mb-6">
          Does Unsiloed&apos;s confidence
          <br />
          score actually predict accuracy
          <br />
          <span className="text-[#FA82B9]">on your documents?</span>
        </h1>

        <blockquote className="max-w-2xl mx-auto bg-gray-50 border border-gray-200 border-l-4 border-l-amber-500 rounded-r-lg px-6 py-5 mb-10 text-left">
          <p className="text-gray-600 text-base leading-relaxed italic">
            &ldquo;Even at 95% or 97%, accuracy isn&apos;t my problem. My problem is knowing which
            95% doesn&apos;t need review. If I can&apos;t tell that, my team reviews 100% anyway.&rdquo;
          </p>
          <footer className="text-gray-400 text-sm mt-3">
            — Mortgage CEO, from Aman Mishra&apos;s blog (April 2026)
          </footer>
        </blockquote>

        <p className="text-gray-500 text-lg mb-10 max-w-xl leading-relaxed">
          Upload your documents. Provide ground truth. Get a calibration curve showing exactly
          what confidence threshold gives you 95%+ accuracy — and what straight-through
          processing rate that enables.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href="/calibrate"
            className="bg-[#191919] text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-black transition-colors text-base"
          >
            Run Your Calibration →
          </Link>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Link
              href="/results?demo=aws"
              className="text-gray-500 border border-gray-300 px-5 py-3.5 rounded-lg hover:border-gray-400 hover:text-[#111827] transition-colors text-sm"
            >
              Demo · AWS Textract
            </Link>
            <Link
              href="/results?demo=google"
              className="text-gray-500 border border-gray-300 px-5 py-3.5 rounded-lg hover:border-gray-400 hover:text-[#111827] transition-colors text-sm"
            >
              Demo · Google DocAI
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-gray-100 px-8 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-gray-400 text-xs uppercase tracking-widest mb-10 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Upload PDFs", desc: "Drag in your documents — invoices, filings, contracts" },
            { step: "2", title: "Enter Ground Truth", desc: "Type in the correct field values you already know" },
            { step: "3", title: "Run Extraction", desc: "Tool calls Unsiloed's /v2/extract with your API key" },
            { step: "4", title: "Get Calibration", desc: "See the curve, the threshold, and your STP rate" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-[#FA82B9] text-sm font-bold flex items-center justify-center mx-auto mb-3">
                {step}
              </div>
              <h3 className="text-[#111827] text-sm font-semibold mb-1">{title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
