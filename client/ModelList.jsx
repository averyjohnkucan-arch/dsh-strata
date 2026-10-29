import React, { useState } from "react";
import { nativeContext } from "../lib/choices.js";

import { modelLabel as label } from "./model-label.js";

export function ModelList({ profiles, busy, open, run }) {
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState([]),
    [query, setQuery] = useState("");
  const ids = selected.filter((id) => profiles.some((p) => p.id === id));
  const families = profiles.map((profile) => label(profile).family);
  const sharedFamily =
    families.length &&
    families[0] &&
    families.every((family) => family === families[0])
      ? families[0]
      : "";
  return (
    <section aria-label="Saved Strata models">
      <div className="strata-list-heading">
        <h4>
          {sharedFamily || "Models"} <span>{profiles.length}</span>
        </h4>
        {!!profiles.length && (
          <button
            type="button"
            className="strata-text-button"
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? "Done" : "Select"}
          </button>
        )}
      </div>
      {profiles.length > 4 && (
        <input
          aria-label="Find a saved model"
          placeholder="Find a model"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {!profiles.length && (
        <p className="strata-empty">Import files to add your models.</p>
      )}
      <div className="strata-model-list">
        {profiles
          .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
          .map((profile) => {
            const title = label(profile),
              loaded = profile.status === "running",
              native = profile.context === nativeContext(profile);
            return (
              <div className="strata-model-row" key={profile.id}>
                {selecting && (
                  <input
                    type="checkbox"
                    aria-label={"Select " + profile.name}
                    checked={ids.includes(profile.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...ids, profile.id]
                          : ids.filter((id) => id !== profile.id),
                      )
                    }
                  />
                )}
                <div className="strata-model-title" title={profile.name}>
                  <strong>{title.name}</strong>
                  <small>
                    {title.family && !sharedFamily && (
                      <span>{title.family} · </span>
                    )}
                    {native ? "Native · " : ""}
                    {(profile.context / 1024).toLocaleString()}K context
                  </small>
                </div>
                {loaded && (
                  <span className="strata-status is-loaded">Loaded</span>
                )}
                <div className="strata-row-actions">
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={"Settings for " + profile.name}
                    onClick={() => open(profile.id)}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className={loaded ? "" : "strata-primary"}
                    disabled={busy}
                    aria-label={(loaded ? "Unload " : "Load ") + profile.name}
                    onClick={() =>
                      run(loaded ? "stop" : "start", { id: profile.id })
                    }
                  >
                    {loaded ? "Unload" : "Load"}
                  </button>
                  <details className="strata-menu">
                    <summary aria-label={"More actions for " + profile.name}>
                      ⋯
                    </summary>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.currentTarget.closest("details").open = false;
                          run("export-config", { id: profile.id });
                        }}
                      >
                        Export config JSON
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.currentTarget.closest("details").open = false;
                          run("tune", { id: profile.id });
                        }}
                      >
                        Auto-tune
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run("remove", { id: profile.id })}
                      >
                        Remove model
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
      </div>
      {selecting && (
        <div className="strata-selection">
          <span>{ids.length} selected</span>
          <button
            type="button"
            className="strata-primary"
            disabled={busy || !ids.length}
            onClick={() => run("tune", { ids })}
          >
            Auto-tune selected
          </button>
        </div>
      )}
    </section>
  );
}
