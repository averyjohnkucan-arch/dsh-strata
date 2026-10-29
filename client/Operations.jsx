import React from "react";
import { downloadConfig } from "./portable.js";

function rate(value, status) {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " tok/s"
    : ["queued", "running"].includes(status)
      ? "Measuring…"
      : "—";
}

export function Operations({ jobs, run, history = false }) {
  const active =
    jobs.find((job) => job.status === "running") ||
    jobs.find((job) => job.status === "queued");
  const latest = jobs.at(-1);
  if (!history && !active && latest?.status === "complete")
    return (
      <p className="strata-notice" role="status">
        {latest.kind === "Export config" ? (
          <button type="button" onClick={() => downloadConfig(latest.result)}>
            Download config JSON
          </button>
        ) : (
          <>
            {latest.kind === "Purge all cache"
              ? "Cache cleared"
              : latest.kind + " complete"}
          </>
        )}
      </p>
    );
  const visible = history
    ? jobs.slice(-8).reverse()
    : active
      ? [active]
      : ["failed", "cancelled"].includes(latest?.status)
        ? [latest]
        : [];
  return (
    <section aria-label={history ? "Activity history" : "Current operation"}>
      {history && !visible.length && (
        <p className="strata-empty">No recent activity.</p>
      )}
      {visible.map((job) => (
        <div className="strata-job" key={job.id}>
          <div className="strata-list-heading">
            <strong>{job.kind}</strong>
            <small>{job.status}</small>
          </div>
          <p role={job.status === "failed" ? "alert" : "status"}>
            {job.progress}
          </p>
          {job.metrics && (
            <div className="strata-tuning-speeds">
              <small>
                {job.metrics.tuner === "deepseek41"
                  ? "DeepSeek native tuner · latest measurement"
                  : "Latest completed measurement"}
              </small>
              <dl aria-label="Tuning token rates">
                {job.metrics.tuner !== "deepseek41" && (
                  <div>
                    <dt>Prefill</dt>
                    <dd>{rate(job.metrics.prefillTokS, job.status)}</dd>
                  </div>
                )}
                <div>
                  <dt>Decode</dt>
                  <dd>{rate(job.metrics.decodeTokS, job.status)}</dd>
                </div>
              </dl>
            </div>
          )}
          {job.kind === "Export config" && job.status === "complete" && (
            <button type="button" onClick={() => downloadConfig(job.result)}>
              Download config JSON
            </button>
          )}
          {["queued", "running"].includes(job.status) && (
            <button type="button" onClick={() => run("cancel", { id: job.id })}>
              Cancel
            </button>
          )}
          {job.kind === "Install Strata" &&
            ["failed", "cancelled"].includes(job.status) && (
              <button type="button" onClick={() => run("install")}>
                Retry installation
              </button>
            )}
          {history && job.log && (
            <details>
              <summary>View log</summary>
              <pre>{job.log}</pre>
            </details>
          )}
        </div>
      ))}
    </section>
  );
}
