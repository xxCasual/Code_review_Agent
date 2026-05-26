import { Check, Copy } from "lucide-react";

interface ReportPanelProps {
  report: string;
  canCopy: boolean;
  copyState: "idle" | "copied";
  onCopy: () => void;
}

export function ReportPanel({ report, canCopy, copyState, onCopy }: ReportPanelProps) {
  return (
    <section className="result-panel report-panel" aria-labelledby="report-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Markdown Report</p>
          <h2 id="report-title">评审报告</h2>
        </div>
        <button id="copy-button" className="button-secondary compact" type="button" disabled={!canCopy} onClick={onCopy}>
          {copyState === "copied" ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
          <span>{copyState === "copied" ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre id="report-output" className="report-output">
        {report}
      </pre>
    </section>
  );
}
