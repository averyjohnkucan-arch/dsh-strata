import React, { useEffect, useRef, useState } from "react";
import { request } from "./api.js";
import { FilePicker } from "./FilePicker.jsx";
import {
  contextChoices,
  nativeContext,
  kvChoices,
  kvLabel,
  supportsFlashMtp,
} from "../lib/choices.js";

export function ProfileEditor({ profile, busy, save, run, close }) {
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(profile),
    kv: kvLabel(profile.kv),
  }));
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [pickingMtp, setPickingMtp] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [mtpStatus, setMtpStatus] = useState(null);
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
  useEffect(() => {
    let live = true;
    if (supportsFlashMtp(profile.model)) {
      request("mtp-status", { id: profile.id })
        .then((status) => {
          if (live) setMtpStatus(status);
        })
        .catch((error) => {
          if (live) setError(error.message);
        });
    }
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
  const native = nativeContext(draft);
  return (
    <section className="strata-panel" aria-label="Model settings">
      <h4 ref={heading} tabIndex={-1}>
        {draft.name}
      </h4>
      {error && <p role="alert">{error}</p>}
      <div className="strata-grid">
        <label>
          KV precision (K / V)
          {draft.model?.architecture === "qwen35moe" ? (
            <span>
              FP32 / FP32. This Qwen 3.6 engine has no selectable KV formats.
            </span>
          ) : (
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
                  disabled={
                    capabilities?.kv && !capabilities.kv.includes(value)
                  }
                >
                  {value}
                  {capabilities?.kv && !capabilities.kv.includes(value)
                    ? " — unavailable in this engine"
                    : ""}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          Context
          <select
            value={draft.context}
            onChange={(event) => edit("context", Number(event.target.value))}
          >
            {native && (
              <option value={native}>
                Native ({native.toLocaleString()} tokens)
              </option>
            )}
            {!contexts.includes(draft.context) && (
              <option value={draft.context}>
                {draft.context.toLocaleString()} tokens (saved)
              </option>
            )}
            {contexts
              .filter((value) => value !== native)
              .map((value) => (
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
              : "Select an mmproj file for images."}
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
            Text only
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
      <div>
        <strong>MTP</strong>
        {supportsFlashMtp(draft.model) ? (
          <>
            <p>
              {draft.model?.files?.some((file) => (file.tensors?.MTP || 0) > 0)
                ? "MTP tensors were detected in the model. Strata uses a separate MTP runtime for this model."
                : "No built-in MTP detected. Strata uses a separate MTP runtime for this model."}
            </p>
            <p>
              {!mtpStatus
                ? "Checking MTP files…"
                : mtpStatus.kind === "selected"
                  ? "Ready: a separate MTP folder is selected. Save your settings, then load or tune the model."
                  : mtpStatus.kind === "automatic-ready"
                    ? "Ready: the automatically prepared MTP files are already installed. They will be used when you load or tune this model."
                    : mtpStatus.kind === "missing"
                      ? "The selected MTP folder is missing or incomplete. Choose another folder."
                      : "Not installed for this model yet. Strata will download and prepare MTP (about 5 GB) when you load or tune it."}
            </p>
            {mtpStatus?.path && <p className="strata-path">{mtpStatus.path}</p>}
            {mtpStatus?.kind === "download" &&
              mtpStatus.candidates?.map((path) => (
                <div key={path}>
                  <p>Found a prepared MTP folder: {path}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      edit("mtp", path);
                      setMtpStatus({ kind: "selected", path });
                    }}
                  >
                    Use this MTP folder
                  </button>
                </div>
              ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => setPickingMtp(true)}
            >
              {draft.mtp && draft.mtp !== "auto"
                ? "Change MTP folder"
                : "Use existing MTP folder"}
            </button>
          </>
        ) : draft.model?.architecture === "qwen35moe" &&
          draft.model?.files?.some((file) => (file.tensors?.MTP || 0) > 0) ? (
          <p>
            Built-in MTP is enabled. Strata drafts only for greedy requests
            without sampling or penalties.
          </p>
        ) : (
          <p>No supported built-in MTP detected.</p>
        )}
        {draft.model?.architecture === "qwen35moe" && (
          <p>
            This engine reads MTP only when it is embedded in the model GGUF.
            Separate MTP files or folders cannot be attached. Choose a quant
            with built-in MTP.
          </p>
        )}
      </div>
      {pickingMtp && (
        <FilePicker
          folder
          initialPath={
            (
              (draft.mtp !== "auto" && draft.mtp) ||
              draft.model?.files?.[0]?.path ||
              ""
            )
              .split("/")
              .slice(0, -1)
              .join("/") || "/"
          }
          onCancel={() => setPickingMtp(false)}
          onSelect={async (path) => {
            await request("mtp-runtime", { path });
            edit("mtp", path);
            setMtpStatus({ kind: "selected", path });
            setPickingMtp(false);
          }}
        />
      )}
      {!["FP16/FP16", "Q8/Q8", "Q4/Q4", "Q8/Q4"].includes(draft.kv) && (
        <p role="status">
          This engine does not support SSD checkpoints for this KV pair.
          Switching models starts a fresh cache.
        </p>
      )}
      <details>
        <summary>Advanced</summary>
        <p>
          16 GiB SSD checkpoints per model, oldest last-used removed first.
          Strata manages RAM caching.
        </p>
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
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={() => commit()}>
          Save
        </button>
        <button
          type="button"
          className="strata-primary"
          disabled={busy}
          onClick={() => commit(true)}
        >
          Save and auto-tune
        </button>
      </div>
      <small>Auto-tune uses Strata's native Thorough tuner.</small>
    </section>
  );
}
