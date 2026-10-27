import React, { useEffect, useState } from "react";
import { request } from "./api.js";

export function Download({ busy, run, close }) {
  const [catalog, setCatalog] = useState([]),
    [choice, setChoice] = useState(""),
    [error, setError] = useState(""),
    [tune, setTune] = useState(true);
  useEffect(() => {
    let live = true;
    request("catalog")
      .then((values) => {
        if (live) {
          setCatalog(values);
          setChoice("0");
        }
      })
      .catch((error) => {
        if (live) setError(error.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="strata-panel" aria-label="Download a model">
      <h4>Download a model</h4>
      <p>
        Selections come from the installed Strata catalog. Strata downloads,
        verifies, prepares and configures the model.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Model
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          {catalog.map((item, index) => (
            <option value={index} key={item.family + item.model}>
              {item.title} · {item.model}
              {item.downloadGB ? " · " + item.downloadGB + " GB download" : ""}
            </option>
          ))}
        </select>
      </label>
      {catalog[Number(choice)] && <p>{catalog[Number(choice)].about}</p>}
      <label className="strata-check">
        <input
          type="checkbox"
          checked={tune}
          onChange={(e) => setTune(e.target.checked)}
        />
        Run Thorough auto-tuning after installation
      </label>
      <p className="strata-muted">
        Files are stored in the plugin data directory. Downloads can be large;
        tuning starts GPU work.
      </p>
      <div className="strata-actions">
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !catalog.length}
          onClick={async () => {
            await run("download", { selection: catalog[Number(choice)], tune });
            close();
          }}
        >
          Download and install
        </button>
      </div>
    </section>
  );
}
