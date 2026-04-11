import Link from "next/link";
import ParticlesBackground from "@/components/ParticlesBackground";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-pitch-950 flex items-center justify-center">
      <ParticlesBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-chalk-100 text-[8rem] md:text-[14rem]">
          4<span className="text-[#F4119E]">0</span>4
        </h1>
        <p className="mt-4 font-body text-lg md:text-xl text-chalk-300">
          Oh my days mate, you aight? Nuffin to see hya...
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-md border border-[#F4119E]/40 bg-pitch-900/50 px-5 py-2.5 font-mono text-sm uppercase tracking-[0.22em] text-[#F4119E] hover:border-[#F4119E] hover:bg-[#F4119E]/10 transition-colors"
        >
          Back Home {"->"}
        </Link>
      </div>
    </div>
  );
}
