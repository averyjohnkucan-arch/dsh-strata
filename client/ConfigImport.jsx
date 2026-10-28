import React, { useState } from "react";

export function ConfigImport({ busy, run, imported }) {
  const [config, setConfig] = useState(null);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="strata-panel" aria-label="Import model config">
      <h4>Import model config</h4>
      <p>
        Choose an exported JSON config and the folder containing your model
        files. Subfolders are searched by exact size, then MD5. Files can have
        different names.
      </p>
      <label>
        Model config JSON
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (event) => {
            setError("");
            setConfig(null);
            try {
              const file = event.target.files[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024)
                throw new Error("Model config exceeds 2 MiB");
              setConfig(JSON.parse(await file.text()));
            } catch (error) {
              setError(error.message);
            }
          }}
        />
      </label>
      {config && (
        <p>
          {config.name} · {config.files?.length || 0} files to locate
        </p>
      )}
      <label>
        Search folder
        <input
          value={path}
          placeholder="/path/to/models"
          onChange={(event) => setPath(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy || !config || !path}
        onClick={async () => {
          try {
            const job = await run("import-config", { config, path });
            imported(job.id);
          } catch (error) {
            setError(error.message);
          }
        }}
      >
        Find files and import
      </button>
    </section>
  );
}
