import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-chalk-100/5 bg-pitch-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-center gap-4 text-xs font-body text-chalk-500">
        <div className="flex items-center gap-2 mr-1">
          <img src="/favicon/favicon-96x96.png" alt="IOSHUBv2" className="w-5 h-5 object-contain opacity-70" />
          <span className="font-display font-black uppercase text-sm tracking-wide text-chalk-100">
            IOS<span className="text-[#F4119E]">HUB</span>v2
          </span>
        </div>
        <span className="text-chalk-700">·</span>
        <Link href="/about" className="hover:text-[#F4119E] transition-colors">About</Link>
        <span className="text-chalk-700">·</span>
        <Link href="/privacy" className="hover:text-[#F4119E] transition-colors">Privacy Policy</Link>
        <span className="text-chalk-700">·</span>
        <Link href="/terms" className="hover:text-[#F4119E] transition-colors">Terms of Service</Link>
        <span className="text-chalk-700">·</span>
        <a
          href="https://iosoccer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#F4119E] transition-colors"
        >
          IOSoccer ↗
        </a>
      </div>
    </footer>
  );
}
