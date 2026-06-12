import { Youtube, ShieldCheck, Lock, Activity } from "lucide-react";

export function TrustIndicators() {
  return (
    <section className="border-y bg-card/40 py-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8 uppercase tracking-widest">
          Trusted by Top YouTube Creators & MCNs
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-70">
          <div className="flex flex-col items-center justify-center gap-2 grayscale transition-all hover:grayscale-0 hover:opacity-100">
            <Youtube className="h-8 w-8 text-[#FF0000]" />
            <span className="text-sm font-medium">YouTube API Compliant</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 grayscale transition-all hover:grayscale-0 hover:opacity-100">
            <ShieldCheck className="h-8 w-8 text-blue-500" />
            <span className="text-sm font-medium">Official Partner Program Rules</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 grayscale transition-all hover:grayscale-0 hover:opacity-100">
            <Lock className="h-8 w-8 text-emerald-500" />
            <span className="text-sm font-medium">Enterprise SOC2 Data Security</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 grayscale transition-all hover:grayscale-0 hover:opacity-100">
            <Activity className="h-8 w-8 text-purple-500" />
            <span className="text-sm font-medium">100k+ Videos Audited</span>
          </div>
        </div>
      </div>
    </section>
  );
}
