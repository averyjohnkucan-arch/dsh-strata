/** Compact imported filenames, but display a user's saved custom name verbatim. */
export function modelLabel(profile) {
  const original = profile.model?.name || profile.name;
  const match = original.match(/^(.+?Flash-Next)-(.+)$/i);
  return match
    ? {
        name:
          profile.name === original
            ? match[2].replace(/^Gyro-([SML])-/, "Gyro $1 · ")
            : profile.name,
        family: match[1].replaceAll("-", " "),
      }
    : { name: profile.name, family: "" };
}
