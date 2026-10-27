import React, { useCallback, useEffect, useState } from "react";
import { request } from "./api.js";
import { Inventory } from "./Inventory.jsx";
import { FilePicker } from "./FilePicker.jsx";
import { ProfileEditor } from "./ProfileEditor.jsx";
import { Download } from "./Download.jsx";
import css from "./styles.css";

function RuntimeSettings({ settings, busy, run }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [JSON.stringify(settings)]);
  return (
    <details>
      <summary>Strata runtime</summary>
      <p>
        Install the official runtime, or select existing compatible runtime
        paths.
      </p>
      <div className="strata-grid">
        {[
          ["controlDir", "Control directory"],
          ["python", "Python executable"],
          ["executable", "Engine executable"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={draft[key]}
              onChange={(e) =>
                setDraft((p) => ({ ...p, [key]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <div className="strata-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => run("settings", { settings: draft })}
        >
          Save runtime paths
        </button>
        <button type="button" disabled={busy} onClick={() => run("install")}>
          Install / update official Strata
        </button>
      </div>
    </details>
  );
}

function StrataCard() {
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [view, setView] = useState(""),
    [selected, setSelected] = useState([]),
    [tuneIds, setTuneIds] = useState([]),
    [help, setHelp] = useState(""),
    [pending, setPending] = useState(false),
    [importJob, setImportJob] = useState("");
  const refresh = useCallback(async () => {
    setState(await request("state"));
  }, []);
  useEffect(() => {
    let live = true;
    const update = () =>
      request("state")
        .then((value) => {
          if (live) setState(value);
        })
        .catch((error) => {
          if (live) setError(error.message);
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
      if (job.result.ids?.length) setView(job.result.ids[0]);
    }
  }, [state, importJob]);
  async function run(action, payload = {}) {
    setPending(true);
    setError("");
    try {
      const value = await request(action, payload);
      if (action === "help") setHelp(value);
      await refresh();
      return value;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setPending(false);
    }
  }
  // Event handlers consume their errors here; the alert remains visible on the card.
  const act = (action, payload) => run(action, payload).catch(() => {});
  const busy =
    pending ||
    state?.jobs.some((job) => ["queued", "running"].includes(job.status));
  const profile = state?.profiles.find((profile) => profile.id === view);
  return (
    <section className="strata-card" aria-label="Strata">
      <style>{css}</style>
      <header>
        <div>
          <h3>
            Strata <small>0.4.0</small>
          </h3>
          <p>Local models</p>
        </div>
        <div className="strata-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => setView("download")}
          >
            Download a model
          </button>
          <button
            type="button"
            disabled={busy || !state}
            onClick={() => setView("scan")}
          >
            Import files
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="strata-error">
          {error}
        </p>
      )}
      {!state ? (
        <p>Connecting to Strata…</p>
      ) : (
        <>
          <RuntimeSettings settings={state.settings} busy={busy} run={act} />
          {view === "scan" && (
            <FilePicker
              initialPath={state.inventory?.root}
              onCancel={() => setView("")}
              onSelect={async (selection) => {
                const job = await run("import", selection);
                setImportJob(job.id);
                setSelected([]);
                setView("");
              }}
            />
          )}
          {view === "download" && (
            <Download busy={busy} run={act} close={() => setView("")} />
          )}
          {profile && (
            <ProfileEditor
              key={profile.id}
              profile={profile}
              inventory={state.inventory}
              busy={busy}
              save={async (p) => {
                await run("save", { profile: p });
                setView("");
              }}
              run={act}
              close={() => setView("")}
            />
          )}
          <section aria-label="Saved Strata models">
            <h4>Saved models</h4>
            {!state.profiles.length && (
              <p className="strata-muted">
                Choose Import files to add your models.
              </p>
            )}
            {state.profiles.map((profile) => (
              <div className="strata-saved" key={profile.id}>
                <label className="strata-check">
                  <input
                    type="checkbox"
                    aria-label={"Queue tuning for " + profile.name}
                    checked={tuneIds.includes(profile.id)}
                    onChange={(e) =>
                      setTuneIds(
                        e.target.checked
                          ? [...tuneIds, profile.id]
                          : tuneIds.filter((id) => id !== profile.id),
                      )
                    }
                  />
                  <strong>{profile.name}</strong>
                </label>
                <small>
                  {profile.status} · {profile.context.toLocaleString()} context
                  · {profile.config ? "prepared" : "not prepared"}
                </small>
                <div className="strata-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setView(profile.id)}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(profile.status === "running" ? "stop" : "start", {
                        id: profile.id,
                      })
                    }
                  >
                    {profile.status === "running" ? "Unload" : "Load"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("remove", { id: profile.id })}
                  >
                    Remove profile
                  </button>
                </div>
              </div>
            ))}
            {!!state.profiles.length && (
              <button
                type="button"
                disabled={busy || !tuneIds.length}
                onClick={() => act("tune", { ids: tuneIds })}
              >
                Auto-tune selected models ({tuneIds.length})
              </button>
            )}
          </section>
          <details
            open={
              state.inventory?.models.some(
                (model) => model.status !== "complete",
              ) || undefined
            }
          >
            <summary>Files and shards</summary>
            <Inventory
              inventory={state.inventory}
              selected={selected}
              setSelected={setSelected}
              disabled={busy}
              add={async () => {
                const ids = await run("add", { ids: selected });
                setSelected([]);
                if (ids.length) setView(ids[0]);
              }}
            />
          </details>
          <section aria-label="Strata operations">
            {state.jobs.slice(-6).map((job) => (
              <div className="strata-job" key={job.id}>
                <strong>{job.kind}</strong>
                <span>
                  {job.status}: {job.progress}
                </span>
                {["queued", "running"].includes(job.status) && (
                  <button
                    type="button"
                    onClick={() => act("cancel", { id: job.id })}
                  >
                    Cancel
                  </button>
                )}
                {job.log && (
                  <details>
                    <summary>Operation log</summary>
                    <pre>{job.log}</pre>
                  </details>
                )}
              </div>
            ))}
          </section>
          {help && (
            <details open>
              <summary>Installed engine options</summary>
              <pre>{help}</pre>
              <button type="button" onClick={() => setHelp("")}>
                Close options
              </button>
            </details>
          )}
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
