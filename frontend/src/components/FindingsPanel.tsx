import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { useMemo } from "react";
import type { Finding } from "../types";
import { confidenceLabel, findingKey, sortFindings } from "../utils";
import { EmptyState } from "./EmptyState";

interface FindingsPanelProps {
  findings: Finding[];
  prTarget: string | null;
  isLoading: boolean;
}

export function FindingsPanel({ findings, prTarget, isLoading }: FindingsPanelProps) {
  const sortedFindings = useMemo(() => sortFindings(findings), [findings]);

  return (
    <section className="result-panel findings-panel" aria-labelledby="findings-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Structured Findings</p>
          <h2 id="findings-title">问题列表</h2>
        </div>
        <span id="pr-target" className="target-label" title={prTarget ?? "未选择 PR"}>
          {prTarget ?? "未选择 PR"}
        </span>
      </div>

      {sortedFindings.length === 0 ? (
        <EmptyState>
          {isLoading ? "评审正在进行，结果生成后会自动刷新。" : "提交一个 PR 或打开静态示例报告后，这里会展示按风险整理的 findings。"}
        </EmptyState>
      ) : (
        <div id="findings-list" className="findings-list">
          {sortedFindings.map((finding) => (
            <FindingCard key={findingKey(finding)} finding={finding} />
          ))}
        </div>
      )}
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className={`finding-card finding-card-${finding.severity}`}>
      <div className="finding-card__top">
        <div className="finding-title-block">
          <h3>{finding.title}</h3>
          <p className="finding-location">
            <MapPin aria-hidden="true" size={14} />
            <span>
              {finding.file_path}:{finding.start_line}-{finding.end_line}
            </span>
          </p>
        </div>
        <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
      </div>

      <div className="finding-meta">
        <span>{finding.category}</span>
        <span>{finding.is_blocking ? "blocking" : "non-blocking"}</span>
        <span>{confidenceLabel(finding.confidence)}</span>
      </div>

      <div className="finding-body">
        <FindingDetail label="证据" value={finding.evidence} />
        <FindingDetail label="解释" value={finding.explanation} />
        <FindingDetail label="建议" value={finding.suggestion} />
      </div>

      <div className="finding-footnote">
        {finding.is_blocking ? (
          <>
            <AlertTriangle aria-hidden="true" size={15} />
            <span>建议先处理此阻塞问题</span>
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden="true" size={15} />
            <span>可作为后续改进项跟进</span>
          </>
        )}
      </div>
    </article>
  );
}

function FindingDetail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}: </strong>
      <span>{value || "-"}</span>
    </p>
  );
}
