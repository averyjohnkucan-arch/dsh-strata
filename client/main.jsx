import React, { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { Inventory } from "./Inventory.jsx";
import { FilePicker } from "./FilePicker.jsx";
import { ProfileEditor } from "./ProfileEditor.jsx";
import { Download } from "./Download.jsx";
import { ModelList } from "./ModelList.jsx";
import { Operations } from "./Operations.jsx";
import css from "./styles.css";

function StrataCard() {
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [connectionError, setConnectionError] = useState(""),
    [view, setView] = useState("models"),
    [selected, setSelected] = useState([]),
    [pending, setPending] = useState(false),
    [importJob, setImportJob] = useState("");
  const content = useRef(null);
  const refresh = useCallback(async () => setState(await request("state")), []);
  useEffect(() => {
    let live = true;
    const update = () =>
      request("state")
        .then((value) => {
          if (live) {
            setState(value);
            setConnectionError("");
          }
        })
        .catch((error) => {
          if (live) setConnectionError(error.message);
        });
    update();
    const timer = setInterval(update, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const job = state?.jobs.find((job) => job.id === importJob);
    if (job?.status === "complete") {
      setImportJob("");
      setView(job.result.ids?.[0] || "files");
    }
  }, [state, importJob]);
  useEffect(() => {
    if (view !== "models") {
      // A view replaces the list; keep its start visible inside DSH's scrolling settings panel.
      content.current?.focus({ preventScroll: true });
      content.current?.scrollIntoView({ block: "nearest" });
    }
  }, [view]);
  async function run(action, payload = {}) {
    setPending(true);
    setError("");
    try {
      const value = await request(action, payload);
      await refresh();
      return value;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setPending(false);
    }
  }
  const act = (action, payload) => run(action, payload).catch(() => {});
  const busy =
    pending ||
    state?.jobs.some((job) => ["queued", "running"].includes(job.status));
  const profile = state?.profiles.find((profile) => profile.id === view);
  const primary = ["models", "files", "activity"].includes(view);
  const missing =
    state?.inventory?.models.filter((model) => model.status !== "complete")
      .length || 0;
  return (
    <section className="strata-card" aria-label="Strata">
      <style>{css}</style>
      <header className="strata-header">
        <div>
          <h3>
            Strata <span className="strata-version">0.5.6</span>
          </h3>
          <small>
            {state?.settings.bundledVersion
              ? "Included runtime"
              : "Local model provider"}
          </small>
        </div>
        <button
          type="button"
          className="strata-text-button"
          disabled={busy || !state}
          onClick={() => act("purge-cache")}
        >
          Purge all cache
        </button>
      </header>
      {(error || connectionError) && (
        <p role="alert">{error || connectionError}</p>
      )}
      {!state ? (
        <p>Connecting to Strata…</p>
      ) : (
        <>
          {primary ? (
            <>
              <div className="strata-toolbar">
                <nav aria-label="Strata views">
                  {[
                    ["models", "Models"],
                    ["files", "Files"],
                    ["activity", "Activity"],
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      aria-current={view === id ? "page" : undefined}
                      onClick={() => setView(id)}
                    >
                      {name}
                      {id === "files" && missing > 0 && (
                        <span
                          className="strata-count"
                          title={missing + " incomplete models"}
                        >
                          {missing}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="strata-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setView("download")}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="strata-primary"
                    disabled={busy}
                    onClick={() => setView("scan")}
                  >
                    Import files
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="strata-back strata-text-button"
              onClick={() => setView("models")}
            >
              ← Back to models
            </button>
          )}
          <div ref={content} tabIndex={-1} className="strata-content">
            {view === "models" && (
              <ModelList
                profiles={state.profiles}
                busy={busy}
                open={setView}
                run={act}
              />
            )}
            {view === "files" && (
              <Inventory
                inventory={state.inventory}
                selected={selected}
                setSelected={setSelected}
                disabled={busy}
                add={async () => {
                  await run("add", { ids: selected });
                  setSelected([]);
                  setView("models");
                }}
              />
            )}
            {view === "activity" && (
              <>
                <Operations jobs={state.jobs} run={act} history />
                {state.cache?.notice && (
                  <p className="strata-notice" role="status">
                    {state.cache.notice}
                  </p>
                )}
              </>
            )}
            {view === "scan" && (
              <FilePicker
                initialPath={state.inventory?.root}
                onCancel={() => setView("models")}
                onSelect={async (selection) => {
                  const job = await run("import", selection);
                  setImportJob(job.id);
                  setSelected([]);
                  setView("models");
                }}
              />
            )}
            {view === "download" && (
              <Download busy={busy} run={act} close={() => setView("models")} />
            )}
            {profile && (
              <ProfileEditor
                key={profile.id}
                profile={profile}
                busy={busy}
                save={async (p) => {
                  await run("save", { profile: p });
                  setView("models");
                }}
                run={act}
                close={() => setView("models")}
              />
            )}
          </div>
          {view !== "activity" && <Operations jobs={state.jobs} run={act} />}
          <footer className="strata-footer">
            <span>16 GiB cache / model</span>
            <span title="Least recently used checkpoints are removed first; files survive restarts">
              Survives restarts
            </span>
          </footer>
        </>
      )}
    </section>
  );
}
export const inject = ["slots"];
export function apply(ctx) {
  ctx.slots.inject("settings.models.footer", () =>
    ctx.slots.register(
      { name: "settings.models.footer", id: "dsh-strata", order: 10 },
      StrataCard,
    ),
  );
}
