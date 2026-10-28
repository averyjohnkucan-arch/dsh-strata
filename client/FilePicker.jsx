import React, { useEffect, useState } from "react";
import { request } from "./api.js";

/** Host paths are selected directly; model weights are never uploaded through the browser. */
export function FilePicker({
  initialPath,
  projector = false,
  folder = false,
  onSelect,
  onCancel,
}) {
  const [path, setPath] = useState(initialPath || "/");
  const [listing, setListing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    request("browse", {
      path: initialPath || undefined,
      includeMtpFiles: folder,
    })
      .then((value) => {
        if (live) {
          setListing(value);
          setPath(value.path);
        }
      })
      .catch((error) => {
        if (live) setError(error.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [initialPath, folder]);
  async function browse(target) {
    setLoading(true);
    setError("");
    setSelected([]);
    try {
      const value = await request("browse", {
        path: target,
        includeMtpFiles: folder,
      });
      setListing(value);
      setPath(value.path);
    } catch (error) {
      setListing(null);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }
  async function choose(value) {
    setError("");
    try {
      await onSelect(value);
    } catch (error) {
      setError(error.message);
    }
  }
  const child = (name) => listing.path.replace(/\/$/, "") + "/" + name;
  return (
    <section
      className="strata-panel"
      aria-label={
        folder
          ? "Select MTP runtime"
          : projector
            ? "Select vision projector"
            : "Import model files"
      }
    >
      <h4>
        {folder
          ? "Select MTP runtime folder"
          : projector
            ? "Select vision projector (mmproj)"
            : "Import model files"}
      </h4>
      <p>
        {folder
          ? "Enter the full path, select Open folder, then select Use this folder. Choose the folder that directly contains the MTP files."
          : projector
            ? "Choose the model's mmproj GGUF file."
            : "Choose any model shard. Its other shards and nearby vision files are found automatically. You can also import a whole folder, including subfolders."}
      </p>
      <div className="strata-actions">
        <input
          aria-label="Folder path"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              browse(path);
            }
          }}
        />
        <button type="button" disabled={loading} onClick={() => browse(path)}>
          Open folder
        </button>
      </div>
      {loading && <p role="status">Loading files…</p>}
      {error && <p role="alert">{error}</p>}
      {folder && listing && path !== listing.path && (
        <p>Press Open folder to open the path you entered.</p>
      )}
      {listing && !loading && (
        <div className="strata-folders">
          <button type="button" onClick={() => browse(listing.parent)}>
            ↑ Parent folder
          </button>
          {listing.directories.map((name) => (
            <button
              type="button"
              key={name}
              onClick={() => browse(child(name))}
            >
              {name}/
            </button>
          ))}
          {folder && listing.files.map((name) => <p key={name}>{name}</p>)}
          {folder &&
            listing.files.some((name) =>
              name.toLowerCase().endsWith(".gguf"),
            ) && (
              <p>
                GGUF draft files are shown for reference. This picker selects a
                prepared runtime folder, not a GGUF file.
              </p>
            )}
          {!folder &&
            listing.files.map((name) => (
              <label className="strata-check" key={name}>
                <input
                  type={projector ? "radio" : "checkbox"}
                  name="strata-file"
                  checked={selected.includes(child(name))}
                  onChange={(event) =>
                    setSelected(
                      projector
                        ? [child(name)]
                        : event.target.checked
                          ? [...selected, child(name)]
                          : selected.filter((value) => value !== child(name)),
                    )
                  }
                />
                {name}
              </label>
            ))}
          {!folder && !listing.files.length && (
            <p>
              No GGUF files in this folder. Open a subfolder
              {projector
                ? "."
                : " or import this folder to search all subfolders."}
            </p>
          )}
        </div>
      )}
      <div className="strata-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {folder ? (
          <button
            type="button"
            disabled={loading || !listing || path !== listing.path}
            onClick={() => choose(listing.path)}
          >
            Use this folder
          </button>
        ) : (
          !projector && (
            <button
              type="button"
              disabled={loading || !listing}
              onClick={() => choose({ path: listing.path })}
            >
              Import this folder
            </button>
          )
        )}
        {!folder && (
          <button
            type="button"
            disabled={loading || !selected.length}
            onClick={() =>
              choose(
                projector
                  ? selected[0]
                  : { path: listing.path, files: selected },
              )
            }
          >
            {projector
              ? "Use projector"
              : `Import selected files (${selected.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
