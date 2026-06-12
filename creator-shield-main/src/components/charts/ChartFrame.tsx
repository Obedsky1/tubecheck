import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

export function ChartFrame({ height = 240, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as any}
      </ResponsiveContainer>
    </div>
  );
}
