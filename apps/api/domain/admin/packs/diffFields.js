function diffFields(before, after, paths) {
  const changes = [];
  for (const p of paths) {
    const b = before?.[p];
    const a = after?.[p];

    const equal =
      b === a || (b?.toString && a?.toString && b.toString() === a.toString());

    if (!equal) changes.push({ path: p, before: b, after: a });
  }
  return changes;
}

module.exports = { diffFields };
