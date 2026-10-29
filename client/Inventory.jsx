import React, { useState } from "react";
import { size } from "./api.js";

const explanations = {
  Model: "Main model layers and projections",
  Experts: "Routed mixture-of-experts weights",
  Embeddings: "Token input embeddings",
  Engram: "Per-layer / n-gram embedding memory",
  MTP: "Multi-token prediction weights",
  Draft: "Speculative draft weights",
  DFlash: "DFlash speculative draft model",
  DSpark: "DeepSeek speculative draft head",
  Vision: "Image encoder / vision projector",
  "Control vector": "Activation steering data; not a standalone model",
};

export function Files({ model }) {
  return (
    <details className="strata-files">
      <summary>
        {model.files.length} file{model.files.length === 1 ? "" : "s"} ·{" "}
        {size(model.bytes)}
      </summary>
      {model.warnings?.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
      <div className="strata-scroll">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Shard</th>
              <th>Role / contents</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {model.files.map((file) => (
              <tr key={file.path}>
                <td>
                  <strong>{file.name}</strong>
                  <small>{file.path}</small>
                </td>
                <td>
                  {file.index} / {file.count}
                </td>
                <td>
                  <strong>{file.role}</strong>
                  {Object.keys(file.tensors).length ? (
                    Object.entries(file.tensors).map(([role, count]) => (
                      <div key={role} title={explanations[role]}>
                        {role}: {count} tensor{count === 1 ? "" : "s"}
                      </div>
                    ))
                  ) : (
                    <span>{file.role} · metadata only</span>
                  )}
                  <small>{file.roleEvidence}</small>
                </td>
                <td>{size(file.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ModelsTable({ models, selected, setSelected, incomplete = false }) {
  return (
    <div className="strata-scroll">
      <table>
        <thead>
          <tr>
            {!incomplete && <th>Select</th>}
            <th>Model</th>
            <th>Architecture</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <React.Fragment key={model.id}>
              <tr>
                {!incomplete && (
                  <td className="strata-select">
                    <input
                      type="checkbox"
                      aria-label={"Select " + model.name}
                      checked={selected.includes(model.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, model.id]
                            : selected.filter((id) => id !== model.id),
                        )
                      }
                    />
                  </td>
                )}
                <td>
                  <strong>{model.name}</strong>
                </td>
                <td>
                  {model.architecture ||
                    "Unknown; metadata shard may be missing"}
                  {model.setupIssue && <small>{model.setupIssue}</small>}
                </td>
                <td>
                  {model.missing.length
                    ? "Missing shards: " + model.missing.join(", ")
                    : model.duplicates.length
                      ? "Review conflicting shards: " +
                        model.duplicates.join(", ")
                      : "All " + model.expected + " shards present"}
                </td>
              </tr>
              <tr>
                <td colSpan={incomplete ? 3 : 4}>
                  <Files model={model} />
                </td>
              </tr>
            </React.Fragment>
          ))}
          {!models.length && (
            <tr>
              <td colSpan={4}>None</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Inventory({ inventory, selected, setSelected, add, disabled }) {
  const [query, setQuery] = useState("");
  if (!inventory)
    return (
      <p className="strata-muted">
        Choose a folder to discover your local models and their components.
      </p>
    );
  const matches = (model) =>
    (model.name + " " + model.files.map((file) => file.path).join(" "))
      .toLowerCase()
      .includes(query.toLowerCase());
  const complete = inventory.models.filter(
    (model) => model.status === "complete" && matches(model),
  );
  const incomplete = inventory.models.filter(
    (model) => model.status !== "complete" && matches(model),
  );
  return (
    <section aria-label="Folder scan results">
      <label>
        Find models and components
        <input
          aria-label="Filter models and components"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Model name or folder"
        />
      </label>
      <p>{inventory.filesScanned} GGUF files scanned</p>
      {inventory.root && (
        <details>
          <summary>Scan location</summary>
          <code>{inventory.root}</code>
        </details>
      )}
      <h4>
        Complete models <span>{complete.length}</span>
      </h4>
      <ModelsTable
        models={complete}
        selected={selected}
        setSelected={setSelected}
      />
      <div className="strata-actions">
        <button
          type="button"
          disabled={disabled || !selected.length}
          onClick={add}
        >
          Add selected models ({selected.length})
        </button>
        <small>
          Complete means the shard set is present. Strata checks engine
          compatibility during preparation.
        </small>
      </div>
      <h4>
        Models missing shards or needing review <span>{incomplete.length}</span>
      </h4>
      <ModelsTable models={incomplete} incomplete />
      <details open={!inventory.models.length && !!inventory.components.length}>
        <summary>Components ({inventory.components.length})</summary>
        <div className="strata-scroll">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Role</th>
                <th>Purpose</th>
                <th>Files</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.components.filter(matches).map((component) => (
                <tr key={component.id}>
                  <td>{component.name}</td>
                  <td>{component.role}</td>
                  <td>
                    {explanations[component.role] ||
                      "Additional model component"}
                  </td>
                  <td>
                    <Files model={component} />
                  </td>
                  <td>
                    {component.status === "complete"
                      ? "All shards present"
                      : "Missing: " + component.missing.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="strata-muted">
          Component detection does not establish compatibility. DFlash is
          inventoried; this stock Strata importer does not attach it.
        </p>
      </details>
      {inventory.errors.length > 0 && (
        <details>
          <summary>
            Files or folders that could not be inspected (
            {inventory.errors.length})
          </summary>
          {inventory.errors.map((error, index) => (
            <p key={index}>
              <code>{error.path}</code>: {error.error}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
