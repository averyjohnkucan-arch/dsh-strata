# Strata 0.6.5

Local DeepSeek 4.1 Flash imports now use Strata's unchanged native setup. Complete supported shard sets are staged without copying weights; nearby Engram, DSpark and metadata files are verified and reused. The native installer obtains the separate official DeepSeek engine, prepares its runtime pack and writes its own configuration. Engine-specific library paths are preserved.

Existing DeepSeek profiles are no longer blocked by a cached importer warning. The editor explains native KV management, DSpark and text-only local setup. Update and restart DSH, then load the existing DeepSeek profile or re-import its folder.

Native engine code and binaries are not modified by this update. DeepSeek's official engine is installed through its upstream signed feed when needed.
