// Generated from client/ by npm run build. Edit the source modules.
window.__ModuleLoader__.load({id:'dsh-strata',factory(require){
const module={exports:{}};const exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/main.jsx
var main_exports = {};
__export(main_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(main_exports);
var import_react5 = __toESM(require("react"), 1);

// lib/http.js
var actionPath = "/api/dsh-strata";

// client/api.js
async function request(action, payload = {}) {
  const readingFiles = ["browse", "projector", "capabilities"].includes(action);
  let response;
  try {
    response = await fetch(actionPath, {
      credentials: "same-origin",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, payload }),
      signal: readingFiles ? AbortSignal.timeout(3e4) : void 0
    });
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new Error(
        "DSH took too long to read that folder or file. Try another folder or check the model drive."
      );
    throw error;
  }
  if (response.status === 401 || response.status === 403)
    throw new Error(
      "DSH needs its owner session. Reopen DSH using its launch link, then reload this page."
    );
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(data.error || response.statusText);
  return data.result;
}
var size = (bytes) => bytes >= 1073741824 ? (bytes / 1073741824).toFixed(2) + " GiB" : (bytes / 1048576).toFixed(1) + " MiB";

// client/Inventory.jsx
var import_react = __toESM(require("react"), 1);
var explanations = {
  Model: "Main model layers and projections",
  Experts: "Routed mixture-of-experts weights",
  Embeddings: "Token input embeddings",
  Engram: "Per-layer / n-gram embedding memory",
  MTP: "Multi-token prediction weights",
  Draft: "Speculative draft weights",
  DFlash: "DFlash speculative draft model",
  Vision: "Image encoder / vision projector"
};
function Files({ model }) {
  return /* @__PURE__ */ import_react.default.createElement("details", { className: "strata-files" }, /* @__PURE__ */ import_react.default.createElement("summary", null, model.files.length, " file", model.files.length === 1 ? "" : "s", " \xB7", " ", size(model.bytes)), model.warnings?.map((warning) => /* @__PURE__ */ import_react.default.createElement("p", { key: warning }, warning)), /* @__PURE__ */ import_react.default.createElement("div", { className: "strata-scroll" }, /* @__PURE__ */ import_react.default.createElement("table", null, /* @__PURE__ */ import_react.default.createElement("thead", null, /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("th", null, "File"), /* @__PURE__ */ import_react.default.createElement("th", null, "Shard"), /* @__PURE__ */ import_react.default.createElement("th", null, "Role / contents"), /* @__PURE__ */ import_react.default.createElement("th", null, "Size"))), /* @__PURE__ */ import_react.default.createElement("tbody", null, model.files.map((file) => /* @__PURE__ */ import_react.default.createElement("tr", { key: file.path }, /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement("strong", null, file.name), /* @__PURE__ */ import_react.default.createElement("small", null, file.path)), /* @__PURE__ */ import_react.default.createElement("td", null, file.index, " / ", file.count), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement("strong", null, file.role), Object.keys(file.tensors).length ? Object.entries(file.tensors).map(([role, count]) => /* @__PURE__ */ import_react.default.createElement("div", { key: role, title: explanations[role] }, role, ": ", count, " tensor", count === 1 ? "" : "s")) : /* @__PURE__ */ import_react.default.createElement("span", null, file.role, " \xB7 metadata only"), /* @__PURE__ */ import_react.default.createElement("small", null, file.roleEvidence)), /* @__PURE__ */ import_react.default.createElement("td", null, size(file.bytes))))))));
}
function ModelsTable({ models, selected, setSelected, incomplete = false }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "strata-scroll" }, /* @__PURE__ */ import_react.default.createElement("table", null, /* @__PURE__ */ import_react.default.createElement("thead", null, /* @__PURE__ */ import_react.default.createElement("tr", null, !incomplete && /* @__PURE__ */ import_react.default.createElement("th", null, "Select"), /* @__PURE__ */ import_react.default.createElement("th", null, "Model"), /* @__PURE__ */ import_react.default.createElement("th", null, "Architecture"), /* @__PURE__ */ import_react.default.createElement("th", null, "Status"))), /* @__PURE__ */ import_react.default.createElement("tbody", null, models.map((model) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, { key: model.id }, /* @__PURE__ */ import_react.default.createElement("tr", null, !incomplete && /* @__PURE__ */ import_react.default.createElement("td", { className: "strata-select" }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "checkbox",
      "aria-label": "Select " + model.name,
      checked: selected.includes(model.id),
      onChange: (event) => setSelected(
        event.target.checked ? [...selected, model.id] : selected.filter((id) => id !== model.id)
      )
    }
  )), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement("strong", null, model.name), /* @__PURE__ */ import_react.default.createElement("small", null, model.files[0]?.path.split("/").slice(0, -1).join("/"))), /* @__PURE__ */ import_react.default.createElement("td", null, model.architecture || "Unknown; metadata shard may be missing", model.setupIssue && /* @__PURE__ */ import_react.default.createElement("small", null, model.setupIssue)), /* @__PURE__ */ import_react.default.createElement("td", null, model.missing.length ? "Missing shards: " + model.missing.join(", ") : model.duplicates.length ? "Review conflicting shards: " + model.duplicates.join(", ") : "All " + model.expected + " shards present")), /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("td", { colSpan: incomplete ? 3 : 4 }, /* @__PURE__ */ import_react.default.createElement(Files, { model }))))), !models.length && /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("td", { colSpan: 4 }, "None")))));
}
function Inventory({ inventory, selected, setSelected, add, disabled }) {
  const [query, setQuery] = (0, import_react.useState)("");
  if (!inventory)
    return /* @__PURE__ */ import_react.default.createElement("p", { className: "strata-muted" }, "Choose a folder to discover your local models and their components.");
  const matches = (model) => (model.name + " " + model.files.map((file) => file.path).join(" ")).toLowerCase().includes(query.toLowerCase());
  const complete = inventory.models.filter(
    (model) => model.status === "complete" && matches(model)
  );
  const incomplete = inventory.models.filter(
    (model) => model.status !== "complete" && matches(model)
  );
  return /* @__PURE__ */ import_react.default.createElement("section", { "aria-label": "Folder scan results" }, /* @__PURE__ */ import_react.default.createElement("label", null, "Find models and components", /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      "aria-label": "Filter models and components",
      value: query,
      onChange: (event) => setQuery(event.target.value),
      placeholder: "Model name or folder"
    }
  )), /* @__PURE__ */ import_react.default.createElement("p", null, inventory.filesScanned, " GGUF files scanned in", " ", /* @__PURE__ */ import_react.default.createElement("code", null, inventory.root)), /* @__PURE__ */ import_react.default.createElement("h4", null, "Complete models ", /* @__PURE__ */ import_react.default.createElement("span", null, complete.length)), /* @__PURE__ */ import_react.default.createElement(
    ModelsTable,
    {
      models: complete,
      selected,
      setSelected
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      disabled: disabled || !selected.length,
      onClick: add
    },
    "Add selected models (",
    selected.length,
    ")"
  ), /* @__PURE__ */ import_react.default.createElement("small", null, "Complete means the shard set is present. Strata checks engine compatibility during preparation.")), /* @__PURE__ */ import_react.default.createElement("h4", null, "Models missing shards or needing review ", /* @__PURE__ */ import_react.default.createElement("span", null, incomplete.length)), /* @__PURE__ */ import_react.default.createElement(ModelsTable, { models: incomplete, incomplete: true }), /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "Engram, MTP, DFlash, vision and other components (", inventory.components.length, ")"), /* @__PURE__ */ import_react.default.createElement("div", { className: "strata-scroll" }, /* @__PURE__ */ import_react.default.createElement("table", null, /* @__PURE__ */ import_react.default.createElement("thead", null, /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("th", null, "Component"), /* @__PURE__ */ import_react.default.createElement("th", null, "Role"), /* @__PURE__ */ import_react.default.createElement("th", null, "Purpose"), /* @__PURE__ */ import_react.default.createElement("th", null, "Files"), /* @__PURE__ */ import_react.default.createElement("th", null, "Status"))), /* @__PURE__ */ import_react.default.createElement("tbody", null, inventory.components.filter(matches).map((component) => /* @__PURE__ */ import_react.default.createElement("tr", { key: component.id }, /* @__PURE__ */ import_react.default.createElement("td", null, component.name), /* @__PURE__ */ import_react.default.createElement("td", null, component.role), /* @__PURE__ */ import_react.default.createElement("td", null, explanations[component.role] || "Additional model component"), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement(Files, { model: component })), /* @__PURE__ */ import_react.default.createElement("td", null, component.status === "complete" ? "All shards present" : "Missing: " + component.missing.join(", "))))))), /* @__PURE__ */ import_react.default.createElement("p", { className: "strata-muted" }, "Component detection does not establish compatibility. DFlash is inventoried; this stock Strata importer does not attach it.")), inventory.errors.length > 0 && /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "Files or folders that could not be inspected (", inventory.errors.length, ")"), inventory.errors.map((error, index) => /* @__PURE__ */ import_react.default.createElement("p", { key: index }, /* @__PURE__ */ import_react.default.createElement("code", null, error.path), ": ", error.error))));
}

// client/FilePicker.jsx
var import_react2 = __toESM(require("react"), 1);
function FilePicker({
  initialPath,
  projector = false,
  onSelect,
  onCancel
}) {
  const [path, setPath] = (0, import_react2.useState)(initialPath || "/");
  const [listing, setListing] = (0, import_react2.useState)(null);
  const [selected, setSelected] = (0, import_react2.useState)([]);
  const [error, setError] = (0, import_react2.useState)("");
  const [loading, setLoading] = (0, import_react2.useState)(true);
  (0, import_react2.useEffect)(() => {
    let live = true;
    request("browse", { path: initialPath || void 0 }).then((value) => {
      if (live) {
        setListing(value);
        setPath(value.path);
      }
    }).catch((error2) => {
      if (live) setError(error2.message);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [initialPath]);
  async function browse(folder) {
    setLoading(true);
    setError("");
    setSelected([]);
    try {
      const value = await request("browse", { path: folder });
      setListing(value);
      setPath(value.path);
    } catch (error2) {
      setListing(null);
      setError(error2.message);
    } finally {
      setLoading(false);
    }
  }
  async function choose(value) {
    setError("");
    try {
      await onSelect(value);
    } catch (error2) {
      setError(error2.message);
    }
  }
  const child = (name) => listing.path.replace(/\/$/, "") + "/" + name;
  return /* @__PURE__ */ import_react2.default.createElement(
    "section",
    {
      className: "strata-panel",
      "aria-label": projector ? "Select vision projector" : "Import model files"
    },
    /* @__PURE__ */ import_react2.default.createElement("h4", null, projector ? "Select vision projector (mmproj)" : "Import model files"),
    /* @__PURE__ */ import_react2.default.createElement("p", null, projector ? "Choose the model's mmproj GGUF file." : "Choose any model shard. Its other shards and nearby vision files are found automatically. You can also import a whole folder, including subfolders."),
    /* @__PURE__ */ import_react2.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react2.default.createElement(
      "input",
      {
        "aria-label": "Folder path",
        value: path,
        onChange: (event) => setPath(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            browse(path);
          }
        }
      }
    ), /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", disabled: loading, onClick: () => browse(path) }, "Open folder")),
    loading && /* @__PURE__ */ import_react2.default.createElement("p", { role: "status" }, "Loading files\u2026"),
    error && /* @__PURE__ */ import_react2.default.createElement("p", { role: "alert" }, error),
    listing && !loading && /* @__PURE__ */ import_react2.default.createElement("div", { className: "strata-folders" }, /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", onClick: () => browse(listing.parent) }, "\u2191 Parent folder"), listing.directories.map((name) => /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        key: name,
        onClick: () => browse(child(name))
      },
      name,
      "/"
    )), listing.files.map((name) => /* @__PURE__ */ import_react2.default.createElement("label", { className: "strata-check", key: name }, /* @__PURE__ */ import_react2.default.createElement(
      "input",
      {
        type: projector ? "radio" : "checkbox",
        name: "strata-file",
        checked: selected.includes(child(name)),
        onChange: (event) => setSelected(
          projector ? [child(name)] : event.target.checked ? [...selected, child(name)] : selected.filter((value) => value !== child(name))
        )
      }
    ), name)), !listing.files.length && /* @__PURE__ */ import_react2.default.createElement("p", null, "No GGUF files in this folder. Open a subfolder", projector ? "." : " or import this folder to search all subfolders.")),
    /* @__PURE__ */ import_react2.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", onClick: onCancel }, "Cancel"), !projector && /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        disabled: loading || !listing,
        onClick: () => choose({ path: listing.path })
      },
      "Import this folder"
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        disabled: loading || !selected.length,
        onClick: () => choose(
          projector ? selected[0] : { path: listing.path, files: selected }
        )
      },
      projector ? "Use projector" : `Import selected files (${selected.length})`
    ))
  );
}

// client/ProfileEditor.jsx
var import_react3 = __toESM(require("react"), 1);

// lib/choices.js
var kvChoices = Object.freeze([
  "FP16/FP16",
  "FP16/Q8",
  "Q8/Q8",
  "Q8/Q5",
  "Q5/Q5",
  "Q5/Q4",
  "Q4/Q4"
]);
var contextStep = 32768;
function nativeContext(profile) {
  const model = profile.model || profile;
  const metadata = model.files?.find((file) => file.index === 1)?.metadata || {};
  const value = Number(metadata[model.architecture + ".context_length"]);
  return Number.isInteger(value) && value >= 4096 && value <= 4194304 ? value : null;
}
function kvLabel(value) {
  return { fp16: "FP16/FP16", int8: "Q8/Q8", q4_0: "Q4/Q4", k8v4: "Q8/Q4" }[value] || value;
}
function contextChoices(profile) {
  const metadata = profile.model?.files?.find((file) => file.index === 1)?.metadata || {};
  const trained = Number(metadata[profile.model?.architecture + ".context_length"]) || contextStep;
  const limit = Math.min(4194304, Math.max(4096, trained));
  if (limit < contextStep) return [limit];
  const choices = Array.from(
    { length: Math.floor(limit / contextStep) },
    (_, index) => (index + 1) * contextStep
  );
  return [.../* @__PURE__ */ new Set([limit, ...choices])].sort((a, b) => a - b);
}

// client/ProfileEditor.jsx
function ProfileEditor({ profile, busy, save, run, close }) {
  const [draft, setDraft] = (0, import_react3.useState)(() => ({
    ...structuredClone(profile),
    kv: kvLabel(profile.kv)
  }));
  const [error, setError] = (0, import_react3.useState)("");
  const [picking, setPicking] = (0, import_react3.useState)(false);
  const [capabilities, setCapabilities] = (0, import_react3.useState)(null);
  const edit = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  (0, import_react3.useEffect)(() => {
    let live = true;
    request("capabilities", { id: profile.id }).then((value) => {
      if (live) setCapabilities(value);
    }).catch((error2) => {
      if (live) setError(error2.message);
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
        applyPreset: true
      });
      if (tuning) await run("tune", { id: draft.id });
    } catch (error2) {
      setError(error2.message);
    }
  }
  const contexts = contextChoices(draft);
  const native = nativeContext(draft);
  return /* @__PURE__ */ import_react3.default.createElement("section", { className: "strata-panel", "aria-label": "Model settings" }, /* @__PURE__ */ import_react3.default.createElement("h4", null, draft.name), error && /* @__PURE__ */ import_react3.default.createElement("p", { role: "alert" }, error), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-grid" }, /* @__PURE__ */ import_react3.default.createElement("label", null, "KV precision (K / V)", /* @__PURE__ */ import_react3.default.createElement(
    "select",
    {
      value: draft.kv,
      onChange: (event) => edit("kv", event.target.value)
    },
    !kvChoices.includes(draft.kv) && /* @__PURE__ */ import_react3.default.createElement("option", { value: draft.kv }, draft.kv, " (saved)"),
    kvChoices.map((value) => /* @__PURE__ */ import_react3.default.createElement(
      "option",
      {
        key: value,
        value,
        disabled: capabilities?.kv && !capabilities.kv.includes(value)
      },
      value,
      capabilities?.kv && !capabilities.kv.includes(value) ? " \u2014 unavailable in this engine" : ""
    ))
  )), /* @__PURE__ */ import_react3.default.createElement("label", null, "Context", /* @__PURE__ */ import_react3.default.createElement(
    "select",
    {
      value: draft.context,
      onChange: (event) => edit("context", Number(event.target.value))
    },
    native && /* @__PURE__ */ import_react3.default.createElement("option", { value: native }, "Native (", native.toLocaleString(), " tokens)"),
    !contexts.includes(draft.context) && /* @__PURE__ */ import_react3.default.createElement("option", { value: draft.context }, draft.context.toLocaleString(), " tokens (saved)"),
    contexts.filter((value) => value !== native).map((value) => /* @__PURE__ */ import_react3.default.createElement("option", { key: value, value }, value.toLocaleString(), " tokens"))
  ))), /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement("strong", null, "Vision projector"), draft.projector ? /* @__PURE__ */ import_react3.default.createElement("p", { title: draft.projector }, draft.projector.split("/").pop()) : /* @__PURE__ */ import_react3.default.createElement("p", null, draft.projectorChoice === "none" ? "Text only." : "No matching mmproj found. Select a projector for images, or continue without vision."), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setPicking(true)
    },
    draft.projector ? "Change projector" : "Select mmproj file"
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setDraft((previous) => ({
        ...previous,
        projector: "",
        projectorChoice: "none"
      }))
    },
    "Continue without vision"
  ))), picking && /* @__PURE__ */ import_react3.default.createElement(
    FilePicker,
    {
      projector: true,
      initialPath: (draft.projector || draft.model?.files?.[0]?.path || "").split("/").slice(0, -1).join("/") || void 0,
      onCancel: () => setPicking(false),
      onSelect: async (path) => {
        await request("projector", { path });
        setDraft((previous) => ({
          ...previous,
          projector: path,
          projectorChoice: "selected"
        }));
        setPicking(false);
      }
    }
  ), /* @__PURE__ */ import_react3.default.createElement("p", null, "Strata's Thorough tuner measures settings for your chosen KV precision and context."), /* @__PURE__ */ import_react3.default.createElement("p", null, "Conversation checkpoints use up to 16 GiB of SSD space per model. Oldest last-used checkpoints are removed first. Strata manages RAM caching automatically."), !["FP16/FP16", "Q8/Q8", "Q4/Q4", "Q8/Q4"].includes(draft.kv) && /* @__PURE__ */ import_react3.default.createElement("p", { role: "status" }, "This engine does not support SSD checkpoints for this KV pair. Switching models starts a fresh cache."), /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, "Runtime compatibility"), /* @__PURE__ */ import_react3.default.createElement("p", null, "Use the installed Strata runtime, or supply a compatible fork for this model."), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-grid" }, [
    ["controlDir", "Control directory"],
    ["python", "Python executable"],
    ["executable", "Engine executable"]
  ].map(([key, label]) => /* @__PURE__ */ import_react3.default.createElement("label", { key }, label, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      value: draft.runtime?.[key] || "",
      placeholder: "Use installed runtime",
      onChange: (event) => edit("runtime", {
        ...draft.runtime,
        [key]: event.target.value
      })
    }
  )))), /* @__PURE__ */ import_react3.default.createElement("label", { className: "strata-check" }, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: draft.runtime?.tqp || false,
      onChange: (event) => edit("runtime", { ...draft.runtime, tqp: event.target.checked })
    }
  ), "This fork supports Gyro L (TQP5/6/7)")), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", onClick: close }, "Close"), /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", disabled: busy, onClick: () => commit() }, "Save"), /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", disabled: busy, onClick: () => commit(true) }, "Save and auto-tune")));
}

// client/Download.jsx
var import_react4 = __toESM(require("react"), 1);
function Download({ busy, run, close }) {
  const [catalog, setCatalog] = (0, import_react4.useState)([]), [choice, setChoice] = (0, import_react4.useState)(""), [error, setError] = (0, import_react4.useState)(""), [tune, setTune] = (0, import_react4.useState)(true);
  (0, import_react4.useEffect)(() => {
    let live = true;
    request("catalog").then((values) => {
      if (live) {
        setCatalog(values);
        setChoice("0");
      }
    }).catch((error2) => {
      if (live) setError(error2.message);
    });
    return () => {
      live = false;
    };
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("section", { className: "strata-panel", "aria-label": "Download a model" }, /* @__PURE__ */ import_react4.default.createElement("h4", null, "Download a model"), /* @__PURE__ */ import_react4.default.createElement("p", null, "Selections come from the installed Strata catalog. Strata downloads, verifies, prepares and configures the model."), error && /* @__PURE__ */ import_react4.default.createElement("p", { role: "alert" }, error), /* @__PURE__ */ import_react4.default.createElement("label", null, "Model", /* @__PURE__ */ import_react4.default.createElement("select", { value: choice, onChange: (e) => setChoice(e.target.value) }, catalog.map((item, index) => /* @__PURE__ */ import_react4.default.createElement("option", { value: index, key: item.family + item.model }, item.title, " \xB7 ", item.model, item.downloadGB ? " \xB7 " + item.downloadGB + " GB download" : "")))), catalog[Number(choice)] && /* @__PURE__ */ import_react4.default.createElement("p", null, catalog[Number(choice)].about), /* @__PURE__ */ import_react4.default.createElement("label", { className: "strata-check" }, /* @__PURE__ */ import_react4.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: tune,
      onChange: (e) => setTune(e.target.checked)
    }
  ), "Run Thorough auto-tuning after installation"), /* @__PURE__ */ import_react4.default.createElement("p", { className: "strata-muted" }, "Files are stored in the plugin data directory. Downloads can be large; tuning starts GPU work."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react4.default.createElement("button", { type: "button", onClick: close }, "Cancel"), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy || !catalog.length,
      onClick: async () => {
        await run("download", { selection: catalog[Number(choice)], tune });
        close();
      }
    },
    "Download and install"
  )));
}

// client/styles.css
var styles_default = '.strata-card {\n  margin-top: 20px;\n  padding: 18px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n}\n.strata-card * {\n  box-sizing: border-box;\n}\n.strata-card header,\n.strata-actions {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;\n}\n.strata-card header {\n  justify-content: space-between;\n}\n.strata-card h3 {\n  margin: 0;\n  font-size: 18px;\n}\n.strata-card h4 {\n  margin: 18px 0 10px;\n  font-size: 15px;\n}\n.strata-card h4 span {\n  font-size: 12px;\n  opacity: 0.65;\n  margin-left: 6px;\n}\n.strata-card p,\n.strata-muted,\n.strata-card small {\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.5;\n}\n.strata-card small {\n  display: block;\n  font-size: 12px;\n  overflow-wrap: anywhere;\n}\n.strata-card button,\n.strata-card input,\n.strata-card select,\n.strata-card textarea {\n  font: inherit;\n  color: inherit;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 6px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 7px 9px;\n}\n.strata-card button {\n  cursor: pointer;\n}\n.strata-card button:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n.strata-card input:not([type="checkbox"]),\n.strata-card select,\n.strata-card textarea {\n  width: 100%;\n  min-width: 0;\n}\n.strata-card .strata-actions > input {\n  flex: 1;\n  min-width: 180px;\n}\n.strata-card input[type="checkbox"] {\n  margin: 0;\n}\n.strata-card label {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n.strata-card .strata-check {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  gap: 8px;\n  margin: 10px 0;\n}\n.strata-card details {\n  margin: 12px 0;\n}\n.strata-card summary {\n  cursor: pointer;\n  font-weight: 500;\n}\n.strata-panel {\n  padding: 14px;\n  margin: 16px 0;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n}\n.strata-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));\n  gap: 12px;\n  margin: 12px 0;\n}\n.strata-scroll {\n  width: 100%;\n  overflow-x: auto;\n}\n.strata-card table {\n  width: 100%;\n  border-collapse: collapse;\n  text-align: left;\n  font-size: 12px;\n}\n.strata-card td,\n.strata-card th {\n  vertical-align: top;\n  padding: 10px 7px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  overflow-wrap: anywhere;\n}\n.strata-card td {\n  min-width: 80px;\n  max-width: 360px;\n}\n.strata-card td:first-child {\n  min-width: 0;\n}\n.strata-files {\n  min-width: 150px;\n}\n.strata-card pre,\n.strata-card textarea {\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  font-family: monospace;\n  font-size: 12px;\n  max-height: 320px;\n  overflow: auto;\n}\n.strata-card textarea {\n  min-height: 110px;\n}\n.strata-card fieldset {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  margin: 16px 0;\n  padding: 12px;\n}\n.strata-saved,\n.strata-job {\n  padding: 12px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n}\n.strata-job > span {\n  display: block;\n  margin: 5px 0;\n}\n.strata-folders {\n  max-height: 220px;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  margin: 10px 0;\n}\n.strata-folders button {\n  text-align: left;\n}\n.strata-card .strata-error,\n.strata-card [role="alert"] {\n  color: var(--dsw-alias-danger-primary, #df665e);\n}\n@media (max-width: 600px) {\n  .strata-card {\n    padding: 12px;\n  }\n  .strata-grid {\n    grid-template-columns: 1fr;\n  }\n}\n\n/* Expanded shard tables span the model row, so filenames retain usable width. */\n.strata-scroll > table {\n  min-width: 560px;\n}\n.strata-card th {\n  white-space: nowrap;\n  overflow-wrap: normal;\n}\n.strata-card .strata-select {\n  width: 42px;\n  min-width: 42px;\n}\n.strata-files table td:first-child {\n  min-width: 240px;\n}\n.strata-files table td:nth-child(2),\n.strata-files table td:last-child {\n  white-space: nowrap;\n}\n.strata-files strong {\n  display: block;\n}\n';

// client/main.jsx
function StrataCard() {
  const [state, setState] = (0, import_react5.useState)(null), [error, setError] = (0, import_react5.useState)(""), [connectionError, setConnectionError] = (0, import_react5.useState)(""), [view, setView] = (0, import_react5.useState)(""), [selected, setSelected] = (0, import_react5.useState)([]), [tuneIds, setTuneIds] = (0, import_react5.useState)([]), [help, setHelp] = (0, import_react5.useState)(""), [pending, setPending] = (0, import_react5.useState)(false), [importJob, setImportJob] = (0, import_react5.useState)("");
  const refresh = (0, import_react5.useCallback)(async () => {
    setState(await request("state"));
  }, []);
  (0, import_react5.useEffect)(() => {
    let live = true;
    const update = () => request("state").then((value) => {
      if (live) {
        setState(value);
        setConnectionError("");
      }
    }).catch((error2) => {
      if (live) setConnectionError(error2.message);
    });
    update();
    const timer = setInterval(update, 2e3);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  (0, import_react5.useEffect)(() => {
    const job = state?.jobs.find((job2) => job2.id === importJob);
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
    } catch (error2) {
      setError(error2.message);
      throw error2;
    } finally {
      setPending(false);
    }
  }
  const act = (action, payload) => run(action, payload).catch(() => {
  });
  const busy = pending || state?.jobs.some((job) => ["queued", "running"].includes(job.status));
  const profile = state?.profiles.find((profile2) => profile2.id === view);
  return /* @__PURE__ */ import_react5.default.createElement("section", { className: "strata-card", "aria-label": "Strata" }, /* @__PURE__ */ import_react5.default.createElement("style", null, styles_default), /* @__PURE__ */ import_react5.default.createElement("header", null, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("h3", null, "Strata ", /* @__PURE__ */ import_react5.default.createElement("small", null, "0.5.1")), /* @__PURE__ */ import_react5.default.createElement("p", null, "Local models")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy || !state,
      onClick: () => act("purge-cache")
    },
    "Purge all cache"
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setView("download")
    },
    "Download a model"
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy || !state,
      onClick: () => setView("scan")
    },
    "Import files"
  ))), (error || connectionError) && /* @__PURE__ */ import_react5.default.createElement("p", { role: "alert", className: "strata-error" }, error || connectionError), !state ? /* @__PURE__ */ import_react5.default.createElement("p", null, "Connecting to Strata\u2026") : /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("small", null, "Strata 0.2.7 \xB7", " ", state.settings.bundledVersion ? "Included runtime" : "Runtime available from this plugin\u2019s release package"), view === "scan" && /* @__PURE__ */ import_react5.default.createElement(
    FilePicker,
    {
      initialPath: state.inventory?.root,
      onCancel: () => setView(""),
      onSelect: async (selection) => {
        const job = await run("import", selection);
        setImportJob(job.id);
        setSelected([]);
        setView("");
      }
    }
  ), view === "download" && /* @__PURE__ */ import_react5.default.createElement(Download, { busy, run: act, close: () => setView("") }), profile && /* @__PURE__ */ import_react5.default.createElement(
    ProfileEditor,
    {
      key: profile.id,
      profile,
      inventory: state.inventory,
      busy,
      save: async (p) => {
        await run("save", { profile: p });
        setView("");
      },
      run: act,
      close: () => setView("")
    }
  ), /* @__PURE__ */ import_react5.default.createElement("section", { "aria-label": "Saved Strata models" }, /* @__PURE__ */ import_react5.default.createElement("h4", null, "Saved models"), !state.profiles.length && /* @__PURE__ */ import_react5.default.createElement("p", { className: "strata-muted" }, "Choose Import files to add your models."), state.profiles.map((profile2) => /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-saved", key: profile2.id }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "strata-check" }, /* @__PURE__ */ import_react5.default.createElement(
    "input",
    {
      type: "checkbox",
      "aria-label": "Queue tuning for " + profile2.name,
      checked: tuneIds.includes(profile2.id),
      onChange: (e) => setTuneIds(
        e.target.checked ? [...tuneIds, profile2.id] : tuneIds.filter((id) => id !== profile2.id)
      )
    }
  ), /* @__PURE__ */ import_react5.default.createElement("strong", null, profile2.name)), /* @__PURE__ */ import_react5.default.createElement("small", null, profile2.status, " \xB7 ", profile2.context.toLocaleString(), " context \xB7 ", profile2.config ? "prepared" : "not prepared"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setView(profile2.id)
    },
    "Settings"
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => act(profile2.status === "running" ? "stop" : "start", {
        id: profile2.id
      })
    },
    profile2.status === "running" ? "Unload" : "Load"
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => act("remove", { id: profile2.id })
    },
    "Remove profile"
  )))), !!state.profiles.length && /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy || !tuneIds.length,
      onClick: () => act("tune", { ids: tuneIds })
    },
    "Auto-tune selected models (",
    tuneIds.length,
    ")"
  )), /* @__PURE__ */ import_react5.default.createElement(
    "details",
    {
      open: state.inventory?.models.some(
        (model) => model.status !== "complete"
      ) || void 0
    },
    /* @__PURE__ */ import_react5.default.createElement("summary", null, "Files and shards"),
    /* @__PURE__ */ import_react5.default.createElement(
      Inventory,
      {
        inventory: state.inventory,
        selected,
        setSelected,
        disabled: busy,
        add: async () => {
          const ids = await run("add", { ids: selected });
          setSelected([]);
          if (ids.length) setView(ids[0]);
        }
      }
    )
  ), /* @__PURE__ */ import_react5.default.createElement("small", null, "SSD checkpoints: 16 GiB per model \xB7 least recently used removed first \xB7 survive restarts"), state.cache?.notice && /* @__PURE__ */ import_react5.default.createElement("small", { role: "status" }, state.cache.notice), /* @__PURE__ */ import_react5.default.createElement("section", { "aria-label": "Strata operations" }, state.jobs.slice(-6).map((job) => /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-job", key: job.id }, /* @__PURE__ */ import_react5.default.createElement("strong", null, job.kind), /* @__PURE__ */ import_react5.default.createElement("span", null, job.status, ": ", job.progress), ["queued", "running"].includes(job.status) && /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => act("cancel", { id: job.id })
    },
    "Cancel"
  ), job.log && /* @__PURE__ */ import_react5.default.createElement("details", null, /* @__PURE__ */ import_react5.default.createElement("summary", null, "Operation log"), /* @__PURE__ */ import_react5.default.createElement("pre", null, job.log))))), help && /* @__PURE__ */ import_react5.default.createElement("details", { open: true }, /* @__PURE__ */ import_react5.default.createElement("summary", null, "Installed engine options"), /* @__PURE__ */ import_react5.default.createElement("pre", null, help), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", onClick: () => setHelp("") }, "Close options"))));
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject(
    "settings.models.footer",
    () => ctx.slots.register(
      { name: "settings.models.footer", id: "dsh-strata", order: 10 },
      StrataCard
    )
  );
}

return module.exports;
}});
