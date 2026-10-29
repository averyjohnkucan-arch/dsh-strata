# Strata 0.6.6

DeepSeek profiles now share one official engine. The plugin reuses installed signed runtimes from earlier profiles through Strata's native verified installer, preserving the originals and avoiding duplicate downloads when model files move or another profile is added. Existing managed profiles migrate on their next load or tune; explicit custom runtime overrides stay unchanged.

Model preparation now finishes before tuning requests GPU admission. Preparing, waiting and measuring are separate UI phases. A preparation job no longer pins an idle Strata GPU server or displays premature token-rate measurements. Model files and native tuning policy are unchanged.
