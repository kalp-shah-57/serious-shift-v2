/**
 * Text sanitisers for visible UI strings.
 *
 * Product copy must read "AI", not "AGI". The underlying data files (claims,
 * scenarios, sub-trends, bios, etc.) still contain "AGI" because they capture
 * verbatim sourcing, attributed quotes, and substantive entity names that we
 * don't want to mutate on disk. We strip "AGI" → "AI" at the render boundary
 * instead — `useMapLookup` runs every map entity through `sanitiseList`, and
 * pages that load data directly (e.g. ThinkerProfile) call `stripAgi` inline.
 *
 * EXCEPTION: verbatim source/podcast/article titles must display as their
 * actual published title. We therefore never touch keys in NEVER_SANITISE,
 * and callers can pass extra keys to skip via the `skip` argument
 * (e.g. when sanitising a source record, pass `skip: ['title']`).
 */

const NEVER_SANITISE = new Set(['source_title'])

/** Replace every "AGI" occurrence in a string with "AI". Non-strings pass through. */
export const stripAgi = (s) =>
  (typeof s === 'string' ? s.replace(/AGI/g, 'AI') : s)

/**
 * Return a shallow copy of `obj` with every string field run through stripAgi
 * (and every string[] field mapped element-wise). Fields named in NEVER_SANITISE
 * or in the per-call `skip` set are left untouched.
 *
 * The object is *not* deep-cloned — nested object values are left as-is. The
 * map data we care about is flat at the entity level.
 */
export const sanitiseEntity = (obj, skip = []) => {
  if (!obj || typeof obj !== 'object') return obj
  const skipSet = new Set([...NEVER_SANITISE, ...skip])
  const out = { ...obj }
  for (const k of Object.keys(out)) {
    if (skipSet.has(k)) continue
    const v = out[k]
    if (typeof v === 'string') {
      out[k] = v.replace(/AGI/g, 'AI')
    } else if (Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string')) {
      out[k] = v.map(x => x.replace(/AGI/g, 'AI'))
    }
  }
  return out
}

/** Apply sanitiseEntity to each item in a list. Non-arrays pass through. */
export const sanitiseList = (arr, skip = []) =>
  Array.isArray(arr) ? arr.map(o => sanitiseEntity(o, skip)) : arr
