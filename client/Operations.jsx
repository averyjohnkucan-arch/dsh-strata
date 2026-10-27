import React from "react";

export function Operations({ jobs, run, history = false }) {
  const active =
    jobs.find((job) => job.status === "running") ||
    jobs.find((job) => job.status === "queued");
  const latest = jobs.at(-1);
  if (!history && !active && latest?.status === "complete")
    return (
      <p className="strata-notice" role="status">
        {latest.kind === "Purge all cache"
          ? "Cache cleared"
          : latest.kind + " complete"}
      </p>
    );
  const visible = history
    ? jobs.slice(-8).reverse()
    : active
      ? [active]
      : latest?.status === "failed"
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
          {["queued", "running"].includes(job.status) && (
            <button type="button" onClick={() => run("cancel", { id: job.id })}>
              Cancel
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
