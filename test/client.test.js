import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("the shipped browser bundle activates through the DSH module and slot contracts", async () => {
  let definition, registration;
  const source = await readFile(
    new URL("../client.js", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value;
        },
      },
    },
  });
  assert.equal(definition.id, "dsh-strata");
  const plugin = definition.factory((name) => {
    assert.equal(name, "react");
    return {};
  });
  plugin.apply({
    slots: {
      inject(name, register) {
        assert.equal(name, "settings.models.footer");
        register();
      },
      register(options, component) {
        registration = { options, component };
        return () => {};
      },
    },
  });
  assert.equal(registration.options.name, "settings.models.footer");
  assert.equal(typeof registration.component, "function");
});
