# Updating from the earlier plugin

Uninstall the plugin package, install `https://github.com/averyjohnkucan-arch/dsh-strata`, restart DSH, and reload the Web page. Version **0.4.0** shows **Import files** rather than **Select model files**.

This rebuild stores profiles under `dsh-strata-v2`. It does not parse or overwrite the earlier plugin's different profile schema. Import your original GGUF files again. They are not copied or modified. Profiles already created by the 0.3.0 rebuild remain readable.

The simplified editor exposes KV precision, context and projector selection. Saving through it removes legacy manual engine arguments and environment overrides; Strata's native tuner supplies the measured preset. Runtime paths remain available in collapsed compatibility controls, including a separate fork for Gyro L.

Automatic runtime installation uses a versioned private directory so it can retain an older installation. Runtime changes invalidate prepared launch configurations; the upstream packer can reuse staged data. No Strata source patches are installed by this plugin.
