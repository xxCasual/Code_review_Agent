import { AlertTriangle, CheckCircle2, Clock3, Hash, ListChecks, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { UiStatus } from "../types";
import { statusLabel } from "../utils";

interface StatusStripProps {
  status: UiStatus;
  reviewId: string | null;
  findingCount: number;
  blockingCount: number;
}

export function StatusStrip({ status, reviewId, findingCount, blockingCount }: StatusStripProps) {
  const StatusIcon = status === "failed" ? AlertTriangle : status === "succeeded" || status === "demo" ? CheckCircle2 : Clock3;

  return (
    <section className="status-band" aria-live="polite">
      <StatusItem icon={<StatusIcon aria-hidden="true" size={18} />} label="当前状态" value={statusLabel(status)} />
      <StatusItem icon={<Hash aria-hidden="true" size={18} />} label="Review ID" value={reviewId ?? "-"} />
      <StatusItem icon={<ListChecks aria-hidden="true" size={18} />} label="发现数量" value={String(findingCount)} />
      <StatusItem icon={<ShieldAlert aria-hidden="true" size={18} />} label="阻塞问题" value={String(blockingCount)} />
    </section>
  );
}

function StatusItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="status-item">
      <span className="status-icon">{icon}</span>
      <span className="status-label">{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}
