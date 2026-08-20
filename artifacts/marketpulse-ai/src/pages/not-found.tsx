import { Card, CardContent } from '@/components/ui/card';
import { Activity, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="terminal-grid flex min-h-[100dvh] w-full items-center justify-center bg-[#0d1118] px-5 text-[#d8e0eb]">
      <Card className="w-full max-w-md border-[#25303d] bg-[#111720]">
        <CardContent className="p-7">
          <div className="mb-8 flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#f2c25e]"><Activity className="h-4 w-4" /> MarketPulse AI</span>
            <span className="font-mono text-[10px] text-[#657386]">ERR / 404</span>
          </div>
          <div className="mb-5 flex items-start gap-3">
            <AlertCircle className="mt-1 h-6 w-6 text-[#ef9491]" />
            <div>
              <h1 className="text-2xl font-bold tracking-[-.04em] text-[#edf2f7]">
                Route not found
              </h1>
              <p className="mt-2 text-sm text-[#7d8a9b]">
                This instrument panel does not exist.
              </p>
            </div>
          </div>
          <Link href="/" data-testid="link-return-overview" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#4b3d21] bg-[#332a19] px-4 py-2 text-sm font-semibold text-[#f2c25e] hover:bg-[#46381f]"><ArrowLeft className="h-4 w-4" /> Return to overview</Link>
        </CardContent>
      </Card>
    </div>
  );
}
