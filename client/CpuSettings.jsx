import React, { useEffect, useState } from "react";

export function CpuSettings({ budget, busy, run }) {
  const [value, setValue] = useState(budget?.coresKeptFree ?? 0);
  const [error, setError] = useState("");
  useEffect(
    () => setValue(budget?.coresKeptFree ?? 0),
    [budget?.coresKeptFree],
  );
  if (!budget) return null;
  return (
    <form
      className="strata-panel"
      aria-label="Strata CPU limit"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          await run("cpu-settings", { coresKeptFree: Number(value) });
        } catch (error) {
          setError(error.message);
        }
      }}
    >
      <label>
        Cores kept free
        <input
          type="number"
          min="0"
          max={budget.available - 1}
          step="1"
          required
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p>
        Strata may use {budget.limit} of {budget.available} available logical
        CPU cores. Applies to all Strata models and tuning on their next start.
      </p>
      <button
        type="submit"
        disabled={
          busy || value === "" || Number(value) === budget.coresKeptFree
        }
      >
        Save CPU limit
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
