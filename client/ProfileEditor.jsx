import React, { useEffect, useState } from "react";
import { request } from "./api.js";
import { FilePicker } from "./FilePicker.jsx";
import { contextChoices, kvChoices, kvLabel } from "../lib/choices.js";

export function ProfileEditor({ profile, busy, save, run, close }) {
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(profile),
    kv: kvLabel(profile.kv),
  }));
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const edit = (key, value) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    let live = true;
    request("capabilities", { id: profile.id })
      .then((value) => {
        if (live) setCapabilities(value);
      })
      .catch((error) => {
        if (live) setError(error.message);
      });
    return () => {
      live = false;
    };
  }, [profile.id]);
  async function commit(tuning = false) {
    setError("");
    try {
      await save({
        ...draft,
        extraArgs: [],
        environment: {},
        applyPreset: true,
      });
      if (tuning) await run("tune", { id: draft.id });
    } catch (error) {
      setError(error.message);
    }
  }
  const contexts = contextChoices(draft);
  return (
    <section className="strata-panel" aria-label="Model settings">
      <h4>{draft.name}</h4>
      {error && <p role="alert">{error}</p>}
      <div className="strata-grid">
        <label>
          KV precision (K / V)
          <select
            value={draft.kv}
            onChange={(event) => edit("kv", event.target.value)}
          >
            {!kvChoices.includes(draft.kv) && (
              <option value={draft.kv}>{draft.kv} (saved)</option>
            )}
            {kvChoices.map((value) => (
              <option
                key={value}
                value={value}
                disabled={capabilities?.kv && !capabilities.kv.includes(value)}
              >
                {value}
                {capabilities?.kv && !capabilities.kv.includes(value)
                  ? " — unavailable in this engine"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Context
          <select
            value={draft.context}
            onChange={(event) => edit("context", Number(event.target.value))}
          >
            {!contexts.includes(draft.context) && (
              <option value={draft.context}>
                {draft.context.toLocaleString()} tokens (saved)
              </option>
            )}
            {contexts.map((value) => (
              <option key={value} value={value}>
                {value.toLocaleString()} tokens
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <strong>Vision projector</strong>
        {draft.projector ? (
          <p title={draft.projector}>{draft.projector.split("/").pop()}</p>
        ) : (
          <p>
            {draft.projectorChoice === "none"
              ? "Text only."
              : "No matching mmproj found. Select a projector for images, or continue without vision."}
          </p>
        )}
        <div className="strata-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPicking(true)}
          >
            {draft.projector ? "Change projector" : "Select mmproj file"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setDraft((previous) => ({
                ...previous,
                projector: "",
                projectorChoice: "none",
              }))
            }
          >
            Continue without vision
          </button>
        </div>
      </div>
      {picking && (
        <FilePicker
          projector
          initialPath={
            (draft.projector || draft.model?.files?.[0]?.path || "")
              .split("/")
              .slice(0, -1)
              .join("/") || undefined
          }
          onCancel={() => setPicking(false)}
          onSelect={async (path) => {
            await request("projector", { path });
            setDraft((previous) => ({
              ...previous,
              projector: path,
              projectorChoice: "selected",
            }));
            setPicking(false);
          }}
        />
      )}
      <p>
        Strata's Thorough tuner measures settings for your chosen KV precision
        and context.
      </p>
      <details>
        <summary>Runtime compatibility</summary>
        <p>
          Use the installed Strata runtime, or supply a compatible fork for this
          model.
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
                value={draft.runtime?.[key] || ""}
                placeholder="Use installed runtime"
                onChange={(event) =>
                  edit("runtime", {
                    ...draft.runtime,
                    [key]: event.target.value,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="strata-check">
          <input
            type="checkbox"
            checked={draft.runtime?.tqp || false}
            onChange={(event) =>
              edit("runtime", { ...draft.runtime, tqp: event.target.checked })
            }
          />
          This fork supports Gyro L (TQP5/6/7)
        </label>
      </details>
      <div className="strata-actions">
        <button type="button" onClick={close}>
          Close
        </button>
        <button type="button" disabled={busy} onClick={() => commit()}>
          Save
        </button>
        <button type="button" disabled={busy} onClick={() => commit(true)}>
          Save and auto-tune
        </button>
      </div>
    </section>
  );
}
