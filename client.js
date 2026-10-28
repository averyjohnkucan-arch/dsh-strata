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
var import_react7 = __toESM(require("react"), 1);

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
  Vision: "Image encoder / vision projector",
  "Control vector": "Activation steering data; not a standalone model"
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
  )), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement("strong", null, model.name)), /* @__PURE__ */ import_react.default.createElement("td", null, model.architecture || "Unknown; metadata shard may be missing", model.setupIssue && /* @__PURE__ */ import_react.default.createElement("small", null, model.setupIssue)), /* @__PURE__ */ import_react.default.createElement("td", null, model.missing.length ? "Missing shards: " + model.missing.join(", ") : model.duplicates.length ? "Review conflicting shards: " + model.duplicates.join(", ") : "All " + model.expected + " shards present")), /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("td", { colSpan: incomplete ? 3 : 4 }, /* @__PURE__ */ import_react.default.createElement(Files, { model }))))), !models.length && /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("td", { colSpan: 4 }, "None")))));
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
  )), /* @__PURE__ */ import_react.default.createElement("p", null, inventory.filesScanned, " GGUF files scanned"), inventory.root && /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "Scan location"), /* @__PURE__ */ import_react.default.createElement("code", null, inventory.root)), /* @__PURE__ */ import_react.default.createElement("h4", null, "Complete models ", /* @__PURE__ */ import_react.default.createElement("span", null, complete.length)), /* @__PURE__ */ import_react.default.createElement(
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
  ), /* @__PURE__ */ import_react.default.createElement("small", null, "Complete means the shard set is present. Strata checks engine compatibility during preparation.")), /* @__PURE__ */ import_react.default.createElement("h4", null, "Models missing shards or needing review ", /* @__PURE__ */ import_react.default.createElement("span", null, incomplete.length)), /* @__PURE__ */ import_react.default.createElement(ModelsTable, { models: incomplete, incomplete: true }), /* @__PURE__ */ import_react.default.createElement("details", { open: !inventory.models.length && !!inventory.components.length }, /* @__PURE__ */ import_react.default.createElement("summary", null, "Components (", inventory.components.length, ")"), /* @__PURE__ */ import_react.default.createElement("div", { className: "strata-scroll" }, /* @__PURE__ */ import_react.default.createElement("table", null, /* @__PURE__ */ import_react.default.createElement("thead", null, /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("th", null, "Component"), /* @__PURE__ */ import_react.default.createElement("th", null, "Role"), /* @__PURE__ */ import_react.default.createElement("th", null, "Purpose"), /* @__PURE__ */ import_react.default.createElement("th", null, "Files"), /* @__PURE__ */ import_react.default.createElement("th", null, "Status"))), /* @__PURE__ */ import_react.default.createElement("tbody", null, inventory.components.filter(matches).map((component) => /* @__PURE__ */ import_react.default.createElement("tr", { key: component.id }, /* @__PURE__ */ import_react.default.createElement("td", null, component.name), /* @__PURE__ */ import_react.default.createElement("td", null, component.role), /* @__PURE__ */ import_react.default.createElement("td", null, explanations[component.role] || "Additional model component"), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement(Files, { model: component })), /* @__PURE__ */ import_react.default.createElement("td", null, component.status === "complete" ? "All shards present" : "Missing: " + component.missing.join(", "))))))), /* @__PURE__ */ import_react.default.createElement("p", { className: "strata-muted" }, "Component detection does not establish compatibility. DFlash is inventoried; this stock Strata importer does not attach it.")), inventory.errors.length > 0 && /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "Files or folders that could not be inspected (", inventory.errors.length, ")"), inventory.errors.map((error, index) => /* @__PURE__ */ import_react.default.createElement("p", { key: index }, /* @__PURE__ */ import_react.default.createElement("code", null, error.path), ": ", error.error))));
}

// client/FilePicker.jsx
var import_react2 = __toESM(require("react"), 1);
function FilePicker({
  initialPath,
  projector = false,
  folder = false,
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
    request("browse", {
      path: initialPath || void 0,
      includeMtpFiles: folder
    }).then((value) => {
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
  }, [initialPath, folder]);
  async function browse(target) {
    setLoading(true);
    setError("");
    setSelected([]);
    try {
      const value = await request("browse", {
        path: target,
        includeMtpFiles: folder
      });
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
      "aria-label": folder ? "Select MTP runtime" : projector ? "Select vision projector" : "Import model files"
    },
    /* @__PURE__ */ import_react2.default.createElement("h4", null, folder ? "Select MTP runtime folder" : projector ? "Select vision projector (mmproj)" : "Import model files"),
    /* @__PURE__ */ import_react2.default.createElement("p", null, folder ? "Enter the full path, select Open folder, then select Use this folder. Choose the folder that directly contains the MTP files." : projector ? "Choose the model's mmproj GGUF file." : "Choose any model shard. Its other shards and nearby vision files are found automatically. You can also import a whole folder, including subfolders."),
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
    folder && listing && path !== listing.path && /* @__PURE__ */ import_react2.default.createElement("p", null, "Press Open folder to open the path you entered."),
    listing && !loading && /* @__PURE__ */ import_react2.default.createElement("div", { className: "strata-folders" }, /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", onClick: () => browse(listing.parent) }, "\u2191 Parent folder"), listing.directories.map((name) => /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        key: name,
        onClick: () => browse(child(name))
      },
      name,
      "/"
    )), folder && listing.files.map((name) => /* @__PURE__ */ import_react2.default.createElement("p", { key: name }, name)), folder && listing.files.some(
      (name) => name.toLowerCase().endsWith(".gguf")
    ) && /* @__PURE__ */ import_react2.default.createElement("p", null, "GGUF draft files are shown for reference. This picker selects a prepared runtime folder, not a GGUF file."), !folder && listing.files.map((name) => /* @__PURE__ */ import_react2.default.createElement("label", { className: "strata-check", key: name }, /* @__PURE__ */ import_react2.default.createElement(
      "input",
      {
        type: projector ? "radio" : "checkbox",
        name: "strata-file",
        checked: selected.includes(child(name)),
        onChange: (event) => setSelected(
          projector ? [child(name)] : event.target.checked ? [...selected, child(name)] : selected.filter((value) => value !== child(name))
        )
      }
    ), name)), !folder && !listing.files.length && /* @__PURE__ */ import_react2.default.createElement("p", null, "No GGUF files in this folder. Open a subfolder", projector ? "." : " or import this folder to search all subfolders.")),
    /* @__PURE__ */ import_react2.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", onClick: onCancel }, "Cancel"), folder ? /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        disabled: loading || !listing || path !== listing.path,
        onClick: () => choose(listing.path)
      },
      "Use this folder"
    ) : !projector && /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        disabled: loading || !listing,
        onClick: () => choose({ path: listing.path })
      },
      "Import this folder"
    ), !folder && /* @__PURE__ */ import_react2.default.createElement(
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
function supportsFlashMtp(model) {
  const meta = model?.files?.find((file) => file.index === 1)?.metadata || model?.files?.[0]?.metadata || {};
  return model?.architecture === "qwen4exp" && meta["qwen4exp.embedding_length"] === 2560 && meta["qwen4exp.expert_count"] === 512 && (meta["general.base_model.0.repo_url"] === "https://huggingface.co/Qwen/Qwen3.8-Flash-Next" || meta["general.basename"] === "Qwen3.8-Flash-Next");
}
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
  const heading = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    heading.current?.focus();
  }, []);
  const [draft, setDraft] = (0, import_react3.useState)(() => ({
    ...structuredClone(profile),
    kv: kvLabel(profile.kv)
  }));
  const [error, setError] = (0, import_react3.useState)("");
  const [picking, setPicking] = (0, import_react3.useState)(false);
  const [pickingMtp, setPickingMtp] = (0, import_react3.useState)(false);
  const [capabilities, setCapabilities] = (0, import_react3.useState)(null);
  const [mtpStatus, setMtpStatus] = (0, import_react3.useState)(null);
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
  (0, import_react3.useEffect)(() => {
    let live = true;
    if (supportsFlashMtp(profile.model)) {
      request("mtp-status", { id: profile.id }).then((status) => {
        if (live) setMtpStatus(status);
      }).catch((error2) => {
        if (live) setError(error2.message);
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
        applyPreset: true
      });
      if (tuning) await run("tune", { id: draft.id });
    } catch (error2) {
      setError(error2.message);
    }
  }
  const contexts = contextChoices(draft);
  const native = nativeContext(draft);
  return /* @__PURE__ */ import_react3.default.createElement("section", { className: "strata-panel", "aria-label": "Model settings" }, /* @__PURE__ */ import_react3.default.createElement("h4", { ref: heading, tabIndex: -1 }, draft.name), error && /* @__PURE__ */ import_react3.default.createElement("p", { role: "alert" }, error), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-grid" }, /* @__PURE__ */ import_react3.default.createElement("label", null, "KV precision (K / V)", draft.model?.architecture === "qwen35moe" ? /* @__PURE__ */ import_react3.default.createElement("span", null, "FP32 / FP32 (native engine)") : /* @__PURE__ */ import_react3.default.createElement(
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
  ))), /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement("strong", null, "Vision projector"), draft.projector ? /* @__PURE__ */ import_react3.default.createElement("p", { title: draft.projector }, draft.projector.split("/").pop()) : /* @__PURE__ */ import_react3.default.createElement("p", null, draft.projectorChoice === "none" ? "Text only." : "Select an mmproj file for images."), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react3.default.createElement(
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
    "Text only"
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
  ), /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement("strong", null, "MTP"), supportsFlashMtp(draft.model) ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("p", null, draft.model?.files?.some((file) => (file.tensors?.MTP || 0) > 0) ? "MTP tensors were detected in the model. Strata uses a separate MTP runtime for this model." : "No built-in MTP detected. Strata uses a separate MTP runtime for this model."), /* @__PURE__ */ import_react3.default.createElement("p", null, !mtpStatus ? "Checking MTP files\u2026" : mtpStatus.kind === "selected" ? "Ready: a separate MTP folder is selected. Save your settings, then load or tune the model." : mtpStatus.kind === "automatic-ready" ? "Ready: the automatically prepared MTP files are already installed. They will be used when you load or tune this model." : mtpStatus.kind === "missing" ? "The selected MTP folder is missing or incomplete. Choose another folder." : "Not installed for this model yet. Strata will download and prepare MTP (about 5 GB) when you load or tune it."), mtpStatus?.path && /* @__PURE__ */ import_react3.default.createElement("p", { className: "strata-path" }, mtpStatus.path), mtpStatus?.kind === "download" && mtpStatus.candidates?.map((path) => /* @__PURE__ */ import_react3.default.createElement("div", { key: path }, /* @__PURE__ */ import_react3.default.createElement("p", null, "Found a prepared MTP folder: ", path), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => {
        edit("mtp", path);
        setMtpStatus({ kind: "selected", path });
      }
    },
    "Use this MTP folder"
  ))), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setPickingMtp(true)
    },
    draft.mtp && draft.mtp !== "auto" ? "Change MTP folder" : "Use existing MTP folder"
  )) : draft.model?.architecture === "qwen35moe" && draft.model?.files?.some((file) => (file.tensors?.MTP || 0) > 0) ? /* @__PURE__ */ import_react3.default.createElement("p", null, "Built-in MTP is enabled. Strata drafts only for greedy requests without sampling or penalties.") : /* @__PURE__ */ import_react3.default.createElement("p", null, "No supported built-in MTP detected.")), pickingMtp && /* @__PURE__ */ import_react3.default.createElement(
    FilePicker,
    {
      folder: true,
      initialPath: (draft.mtp !== "auto" && draft.mtp || draft.model?.files?.[0]?.path || "").split("/").slice(0, -1).join("/") || "/",
      onCancel: () => setPickingMtp(false),
      onSelect: async (path) => {
        await request("mtp-runtime", { path });
        edit("mtp", path);
        setMtpStatus({ kind: "selected", path });
        setPickingMtp(false);
      }
    }
  ), !["FP16/FP16", "Q8/Q8", "Q4/Q4", "Q8/Q4"].includes(draft.kv) && /* @__PURE__ */ import_react3.default.createElement("p", { role: "status" }, "This engine does not support SSD checkpoints for this KV pair. Switching models starts a fresh cache."), /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, "Advanced"), /* @__PURE__ */ import_react3.default.createElement("p", null, "16 GiB SSD checkpoints per model, oldest last-used removed first. Strata manages RAM caching."), /* @__PURE__ */ import_react3.default.createElement("p", null, "Use the installed Strata runtime, or supply a compatible fork for this model."), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-grid" }, [
    ["controlDir", "Control directory"],
    ["python", "Python executable"],
    ["executable", "Engine executable"]
  ].map(([key, label2]) => /* @__PURE__ */ import_react3.default.createElement("label", { key }, label2, /* @__PURE__ */ import_react3.default.createElement(
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
  ), "This fork supports Gyro L (TQP5/6/7)")), /* @__PURE__ */ import_react3.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", onClick: close }, "Cancel"), /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", disabled: busy, onClick: () => commit() }, "Save"), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-primary",
      disabled: busy,
      onClick: () => commit(true)
    },
    "Save and auto-tune"
  )), /* @__PURE__ */ import_react3.default.createElement("small", null, "Auto-tune uses Strata's native Thorough tuner."));
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

// client/ModelList.jsx
var import_react5 = __toESM(require("react"), 1);
function label(profile) {
  const match = profile.name.match(/^(.+?Flash-Next)-(.+)$/i);
  return match ? {
    name: match[2].replace(/^Gyro-([SML])-/, "Gyro $1 \xB7 "),
    family: match[1].replaceAll("-", " ")
  } : { name: profile.name, family: "" };
}
function ModelList({ profiles, busy, open, run }) {
  const [selecting, setSelecting] = (0, import_react5.useState)(false), [selected, setSelected] = (0, import_react5.useState)([]), [query, setQuery] = (0, import_react5.useState)("");
  const ids = selected.filter((id) => profiles.some((p) => p.id === id));
  const families = profiles.map((profile) => label(profile).family);
  const sharedFamily = families.length && families[0] && families.every((family) => family === families[0]) ? families[0] : "";
  return /* @__PURE__ */ import_react5.default.createElement("section", { "aria-label": "Saved Strata models" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-list-heading" }, /* @__PURE__ */ import_react5.default.createElement("h4", null, sharedFamily || "Models", " ", /* @__PURE__ */ import_react5.default.createElement("span", null, profiles.length)), !!profiles.length && /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-text-button",
      onClick: () => {
        setSelecting(!selecting);
        setSelected([]);
      }
    },
    selecting ? "Done" : "Select"
  )), profiles.length > 4 && /* @__PURE__ */ import_react5.default.createElement(
    "input",
    {
      "aria-label": "Find a saved model",
      placeholder: "Find a model",
      value: query,
      onChange: (e) => setQuery(e.target.value)
    }
  ), !profiles.length && /* @__PURE__ */ import_react5.default.createElement("p", { className: "strata-empty" }, "Import files to add your models."), /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-model-list" }, profiles.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).map((profile) => {
    const title = label(profile), loaded = profile.status === "running", native = profile.context === nativeContext(profile);
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-model-row", key: profile.id }, selecting && /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "checkbox",
        "aria-label": "Select " + profile.name,
        checked: ids.includes(profile.id),
        onChange: (e) => setSelected(
          e.target.checked ? [...ids, profile.id] : ids.filter((id) => id !== profile.id)
        )
      }
    ), /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-model-title", title: profile.name }, /* @__PURE__ */ import_react5.default.createElement("strong", null, title.name), /* @__PURE__ */ import_react5.default.createElement("small", null, title.family && !sharedFamily && /* @__PURE__ */ import_react5.default.createElement("span", null, title.family, " \xB7 "), native ? "Native \xB7 " : "", (profile.context / 1024).toLocaleString(), "K context")), loaded && /* @__PURE__ */ import_react5.default.createElement("span", { className: "strata-status is-loaded" }, "Loaded"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-row-actions" }, /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        type: "button",
        disabled: busy,
        "aria-label": "Settings for " + profile.name,
        onClick: () => open(profile.id)
      },
      "Settings"
    ), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        type: "button",
        className: loaded ? "" : "strata-primary",
        disabled: busy,
        "aria-label": (loaded ? "Unload " : "Load ") + profile.name,
        onClick: () => run(loaded ? "stop" : "start", { id: profile.id })
      },
      loaded ? "Unload" : "Load"
    ), /* @__PURE__ */ import_react5.default.createElement("details", { className: "strata-menu" }, /* @__PURE__ */ import_react5.default.createElement("summary", { "aria-label": "More actions for " + profile.name }, "\u22EF"), /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        type: "button",
        disabled: busy,
        onClick: (e) => {
          e.currentTarget.closest("details").open = false;
          run("tune", { id: profile.id });
        }
      },
      "Auto-tune"
    ), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        type: "button",
        disabled: busy,
        onClick: () => run("remove", { id: profile.id })
      },
      "Remove model"
    )))));
  })), selecting && /* @__PURE__ */ import_react5.default.createElement("div", { className: "strata-selection" }, /* @__PURE__ */ import_react5.default.createElement("span", null, ids.length, " selected"), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-primary",
      disabled: busy || !ids.length,
      onClick: () => run("tune", { ids })
    },
    "Auto-tune selected"
  )));
}

// client/Operations.jsx
var import_react6 = __toESM(require("react"), 1);
function Operations({ jobs, run, history = false }) {
  const active = jobs.find((job) => job.status === "running") || jobs.find((job) => job.status === "queued");
  const latest = jobs.at(-1);
  if (!history && !active && latest?.status === "complete")
    return /* @__PURE__ */ import_react6.default.createElement("p", { className: "strata-notice", role: "status" }, latest.kind === "Purge all cache" ? "Cache cleared" : latest.kind + " complete");
  const visible = history ? jobs.slice(-8).reverse() : active ? [active] : ["failed", "cancelled"].includes(latest?.status) ? [latest] : [];
  return /* @__PURE__ */ import_react6.default.createElement("section", { "aria-label": history ? "Activity history" : "Current operation" }, history && !visible.length && /* @__PURE__ */ import_react6.default.createElement("p", { className: "strata-empty" }, "No recent activity."), visible.map((job) => /* @__PURE__ */ import_react6.default.createElement("div", { className: "strata-job", key: job.id }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "strata-list-heading" }, /* @__PURE__ */ import_react6.default.createElement("strong", null, job.kind), /* @__PURE__ */ import_react6.default.createElement("small", null, job.status)), /* @__PURE__ */ import_react6.default.createElement("p", { role: job.status === "failed" ? "alert" : "status" }, job.progress), ["queued", "running"].includes(job.status) && /* @__PURE__ */ import_react6.default.createElement("button", { type: "button", onClick: () => run("cancel", { id: job.id }) }, "Cancel"), job.kind === "Install Strata" && ["failed", "cancelled"].includes(job.status) && /* @__PURE__ */ import_react6.default.createElement("button", { type: "button", onClick: () => run("install") }, "Retry installation"), history && job.log && /* @__PURE__ */ import_react6.default.createElement("details", null, /* @__PURE__ */ import_react6.default.createElement("summary", null, "View log"), /* @__PURE__ */ import_react6.default.createElement("pre", null, job.log)))));
}

// client/styles.css
var styles_default = '.strata-card {\n  margin-top: 20px;\n  padding: 18px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n}\n.strata-card * {\n  box-sizing: border-box;\n}\n.strata-card header,\n.strata-actions {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;\n}\n.strata-card header {\n  justify-content: space-between;\n}\n.strata-card h3 {\n  margin: 0;\n  font-size: 18px;\n}\n.strata-card h4 {\n  margin: 18px 0 10px;\n  font-size: 15px;\n}\n.strata-card h4 span {\n  font-size: 12px;\n  opacity: 0.65;\n  margin-left: 6px;\n}\n.strata-card p,\n.strata-muted,\n.strata-card small {\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.5;\n}\n.strata-card small {\n  display: block;\n  font-size: 12px;\n  overflow-wrap: anywhere;\n}\n.strata-card button,\n.strata-card input,\n.strata-card select,\n.strata-card textarea {\n  font: inherit;\n  color: inherit;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 6px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 7px 9px;\n}\n.strata-card button {\n  cursor: pointer;\n}\n.strata-card button:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n.strata-card input:not([type="checkbox"]),\n.strata-card select,\n.strata-card textarea {\n  width: 100%;\n  min-width: 0;\n}\n.strata-card .strata-actions > input {\n  flex: 1;\n  min-width: 180px;\n}\n.strata-card input[type="checkbox"] {\n  margin: 0;\n}\n.strata-card label {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n.strata-card .strata-check {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  gap: 8px;\n  margin: 10px 0;\n}\n.strata-card details {\n  margin: 12px 0;\n}\n.strata-card summary {\n  cursor: pointer;\n  font-weight: 500;\n}\n.strata-panel {\n  padding: 14px;\n  margin: 16px 0;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n}\n.strata-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));\n  gap: 12px;\n  margin: 12px 0;\n}\n.strata-scroll {\n  width: 100%;\n  overflow-x: auto;\n}\n.strata-card table {\n  width: 100%;\n  border-collapse: collapse;\n  text-align: left;\n  font-size: 12px;\n}\n.strata-card td,\n.strata-card th {\n  vertical-align: top;\n  padding: 10px 7px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  overflow-wrap: anywhere;\n}\n.strata-card td {\n  min-width: 80px;\n  max-width: 360px;\n}\n.strata-card td:first-child {\n  min-width: 0;\n}\n.strata-files {\n  min-width: 150px;\n}\n.strata-card pre,\n.strata-card textarea {\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  font-family: monospace;\n  font-size: 12px;\n  max-height: 320px;\n  overflow: auto;\n}\n.strata-card textarea {\n  min-height: 110px;\n}\n.strata-card fieldset {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  margin: 16px 0;\n  padding: 12px;\n}\n.strata-job {\n  padding: 12px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n}\n.strata-folders {\n  max-height: 220px;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  margin: 10px 0;\n}\n.strata-folders button {\n  text-align: left;\n}\n.strata-card .strata-error,\n.strata-card [role="alert"] {\n  color: var(--dsw-alias-danger-primary, #df665e);\n}\n@media (max-width: 600px) {\n  .strata-card {\n    padding: 12px;\n  }\n  .strata-grid {\n    grid-template-columns: 1fr;\n  }\n}\n\n/* Expanded shard tables span the model row, so filenames retain usable width. */\n.strata-scroll > table {\n  min-width: 560px;\n}\n.strata-card th {\n  white-space: nowrap;\n  overflow-wrap: normal;\n}\n.strata-card .strata-select {\n  width: 42px;\n  min-width: 42px;\n}\n.strata-files table td:first-child {\n  min-width: 240px;\n}\n.strata-files table td:nth-child(2),\n.strata-files table td:last-child {\n  white-space: nowrap;\n}\n.strata-files strong {\n  display: block;\n}\n\n/* Keep the provider overview compact; editors and inventory replace it as separate views. */\n.strata-card .strata-header {\n  align-items: center;\n  margin-bottom: 16px;\n}\n.strata-card .strata-header h3 {\n  display: flex;\n  align-items: baseline;\n  gap: 8px;\n}\n.strata-version {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-secondary);\n}\n.strata-card .strata-header small {\n  margin-top: 4px;\n}\n.strata-card .strata-text-button {\n  border-color: transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n}\n.strata-toolbar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  flex-wrap: wrap;\n  padding-bottom: 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n}\n.strata-toolbar nav {\n  display: flex;\n  gap: 3px;\n}\n.strata-toolbar nav button {\n  border-color: transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  padding: 7px 8px;\n}\n.strata-toolbar nav button[aria-current="page"] {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.15));\n}\n.strata-card .strata-primary {\n  background: var(--dsw-alias-label-primary, #ddd);\n  color: var(--dsw-alias-bg-layer-1, #202020);\n  border-color: transparent;\n}\n.strata-list-heading {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 10px;\n}\n.strata-list-heading h4 {\n  margin: 16px 0 10px;\n}\n.strata-model-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 16px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n}\n.strata-model-row:last-child {\n  border-bottom: 0;\n}\n.strata-model-title {\n  flex: 1;\n  min-width: 0;\n}\n.strata-model-title strong {\n  display: block;\n  line-height: 1.4;\n  overflow-wrap: anywhere;\n  font-size: 13px;\n}\n.strata-model-title small {\n  margin-top: 5px;\n  font-size: 11px;\n}\n.strata-status {\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary);\n  white-space: nowrap;\n}\n.strata-status.is-loaded {\n  color: var(--dsw-alias-success-primary, #7fc897);\n}\n.strata-row-actions {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n}\n.strata-card .strata-row-actions button {\n  font-size: 12px;\n  padding: 6px 8px;\n}\n.strata-card .strata-menu {\n  margin: 0;\n  position: relative;\n}\n.strata-menu summary {\n  list-style: none;\n  padding: 4px 6px;\n  font-size: 18px;\n  line-height: 1;\n}\n.strata-menu summary::-webkit-details-marker {\n  display: none;\n}\n.strata-menu > div {\n  position: absolute;\n  right: 0;\n  top: 100%;\n  z-index: 5;\n  min-width: 145px;\n  display: grid;\n  gap: 3px;\n  padding: 6px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-1, #252525);\n  box-shadow: 0 8px 20px #0004;\n}\n.strata-menu > div button {\n  text-align: left;\n  border-color: transparent;\n}\n.strata-selection {\n  display: flex;\n  gap: 12px;\n  align-items: center;\n  justify-content: space-between;\n  padding-top: 12px;\n  font-size: 12px;\n}\n.strata-card .strata-footer {\n  display: flex;\n  justify-content: space-between;\n  gap: 10px;\n  color: var(--dsw-alias-label-secondary);\n  border-top: 1px solid var(--dsw-alias-border-l3);\n  margin-top: 12px;\n  padding-top: 12px;\n  font-size: 11px;\n}\n.strata-card .strata-empty {\n  padding: 18px 0;\n  margin: 0;\n  font-size: 13px;\n}\n.strata-card .strata-back {\n  margin: 6px 0;\n  padding-left: 0;\n}\n.strata-content:focus,\n.strata-panel h4:focus {\n  outline: none;\n}\n.strata-content > .strata-panel {\n  margin-top: 8px;\n}\n.strata-job p {\n  font-size: 12px;\n  margin: 8px 0;\n}\n@media (max-width: 600px) {\n  .strata-model-row {\n    gap: 8px;\n    flex-wrap: wrap;\n  }\n  .strata-model-title {\n    min-width: 140px;\n  }\n  .strata-status {\n    display: none;\n  }\n  .strata-toolbar {\n    gap: 10px;\n  }\n  .strata-row-actions {\n    margin-left: auto;\n  }\n}\n.strata-count {\n  display: inline-block;\n  padding: 0 5px;\n  margin-left: 5px;\n  border-radius: 5px;\n  font-size: 10px;\n  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.15));\n}\n.strata-card .strata-notice {\n  margin: 10px 0;\n  font-size: 12px;\n}\n';

// client/main.jsx
function StrataCard() {
  const [state, setState] = (0, import_react7.useState)(null), [error, setError] = (0, import_react7.useState)(""), [connectionError, setConnectionError] = (0, import_react7.useState)(""), [view, setView] = (0, import_react7.useState)("models"), [selected, setSelected] = (0, import_react7.useState)([]), [pending, setPending] = (0, import_react7.useState)(false), [importJob, setImportJob] = (0, import_react7.useState)("");
  const content = (0, import_react7.useRef)(null);
  const refresh = (0, import_react7.useCallback)(async () => setState(await request("state")), []);
  (0, import_react7.useEffect)(() => {
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
  (0, import_react7.useEffect)(() => {
    const job = state?.jobs.find((job2) => job2.id === importJob);
    if (job?.status === "complete") {
      setImportJob("");
      setView(job.result.ids?.[0] || "files");
    }
  }, [state, importJob]);
  (0, import_react7.useEffect)(() => {
    if (view !== "models") {
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
  const primary = ["models", "files", "activity"].includes(view);
  const missing = state?.inventory?.models.filter((model) => model.status !== "complete").length || 0;
  return /* @__PURE__ */ import_react7.default.createElement("section", { className: "strata-card", "aria-label": "Strata" }, /* @__PURE__ */ import_react7.default.createElement("style", null, styles_default), /* @__PURE__ */ import_react7.default.createElement("header", { className: "strata-header" }, /* @__PURE__ */ import_react7.default.createElement("div", null, /* @__PURE__ */ import_react7.default.createElement("h3", null, "Strata ", /* @__PURE__ */ import_react7.default.createElement("span", { className: "strata-version" }, "0.5.11")), /* @__PURE__ */ import_react7.default.createElement("small", null, state?.settings.bundledVersion ? "Included runtime" : "Local model provider")), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-text-button",
      disabled: busy || !state,
      onClick: () => act("purge-cache")
    },
    "Purge all cache"
  )), (error || connectionError) && /* @__PURE__ */ import_react7.default.createElement("p", { role: "alert" }, error || connectionError), !state ? /* @__PURE__ */ import_react7.default.createElement("p", null, "Connecting to Strata\u2026") : /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, primary ? /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, /* @__PURE__ */ import_react7.default.createElement("div", { className: "strata-toolbar" }, /* @__PURE__ */ import_react7.default.createElement("nav", { "aria-label": "Strata views" }, [
    ["models", "Models"],
    ["files", "Files"],
    ["activity", "Activity"]
  ].map(([id, name]) => /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      key: id,
      type: "button",
      "aria-current": view === id ? "page" : void 0,
      onClick: () => setView(id)
    },
    name,
    id === "files" && missing > 0 && /* @__PURE__ */ import_react7.default.createElement(
      "span",
      {
        className: "strata-count",
        title: missing + " incomplete models"
      },
      missing
    )
  ))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "strata-actions" }, /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      disabled: busy,
      onClick: () => setView("download")
    },
    "Download"
  ), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-primary",
      disabled: busy,
      onClick: () => setView("scan")
    },
    "Import files"
  )))) : /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "strata-back strata-text-button",
      onClick: () => setView("models")
    },
    "\u2190 Back to models"
  ), /* @__PURE__ */ import_react7.default.createElement("div", { ref: content, tabIndex: -1, className: "strata-content" }, view === "models" && /* @__PURE__ */ import_react7.default.createElement(
    ModelList,
    {
      profiles: state.profiles,
      busy,
      open: setView,
      run: act
    }
  ), view === "files" && /* @__PURE__ */ import_react7.default.createElement(
    Inventory,
    {
      inventory: state.inventory,
      selected,
      setSelected,
      disabled: busy,
      add: async () => {
        await run("add", { ids: selected });
        setSelected([]);
        setView("models");
      }
    }
  ), view === "activity" && /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, /* @__PURE__ */ import_react7.default.createElement(Operations, { jobs: state.jobs, run: act, history: true }), state.cache?.notice && /* @__PURE__ */ import_react7.default.createElement("p", { className: "strata-notice", role: "status" }, state.cache.notice)), view === "scan" && /* @__PURE__ */ import_react7.default.createElement(
    FilePicker,
    {
      initialPath: state.inventory?.root,
      onCancel: () => setView("models"),
      onSelect: async (selection) => {
        const job = await run("import", selection);
        setImportJob(job.id);
        setSelected([]);
        setView("models");
      }
    }
  ), view === "download" && /* @__PURE__ */ import_react7.default.createElement(Download, { busy, run: act, close: () => setView("models") }), profile && /* @__PURE__ */ import_react7.default.createElement(
    ProfileEditor,
    {
      key: profile.id,
      profile,
      busy,
      save: async (p) => {
        await run("save", { profile: p });
        setView("models");
      },
      run: act,
      close: () => setView("models")
    }
  )), view !== "activity" && /* @__PURE__ */ import_react7.default.createElement(Operations, { jobs: state.jobs, run: act }), /* @__PURE__ */ import_react7.default.createElement("footer", { className: "strata-footer" }, /* @__PURE__ */ import_react7.default.createElement("span", null, "16 GiB cache / model"), /* @__PURE__ */ import_react7.default.createElement("span", { title: "Least recently used checkpoints are removed first; files survive restarts" }, "Survives restarts"))));
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
