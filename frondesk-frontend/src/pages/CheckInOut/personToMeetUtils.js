export const OTHER_ID = '__OTHER__';

export function filterPersonsByHostDepartment(persons, hostDepartment, departments) {
  if (!hostDepartment) return persons;
  const dept = departments.find((d) => d.id === hostDepartment);
  if (!dept) return persons;
  return persons.filter((p) => p.department === dept.name);
}

/** Collapse whitespace, lowercase, NFKC — fixes NBSP/double-space breaking substring match. */
function normalizeSearchString(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSearchHaystack(hayRaw, rawQuery) {
  if (!rawQuery || !String(rawQuery).trim()) return true;
  const hay = normalizeSearchString(hayRaw);
  const qDigits = String(rawQuery).replace(/\D/g, '');
  if (qDigits.length >= 3) {
    const hayDigits = hay.replace(/\D/g, '');
    if (hayDigits.includes(qDigits)) return true;
  }
  const qNorm = normalizeSearchString(rawQuery);
  if (!qNorm) return true;
  const tokens = qNorm.split(' ').filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

/** Haystack for matching name, department, employee id, or phone (any substring / token). */
export function buildPersonSearchText(person) {
  if (!person) return '';
  const phoneDigits = String(person.phone || '').replace(/\D/g, '');
  const raw = [
    person.name,
    person.department,
    person.id,
    phoneDigits,
    String(person.phone || '').replace(/\s/g, ''),
  ]
    .filter(Boolean)
    .join(' ');
  return normalizeSearchString(raw);
}

/** True if `person` matches free-text query (name, dept, id, phone / digits). */
export function personMatchesSearchQuery(person, rawQuery) {
  return matchesSearchHaystack(buildPersonSearchText(person), rawQuery);
}

export function buildPersonSelectOptions(persons, { includeOther = true } = {}) {
  const options = persons.map((p) => ({
    id: p.id,
    name: `${p.name} — ${p.department}`,
    searchText: buildPersonSearchText(p),
  }));
  if (includeOther) {
    return [
      { id: OTHER_ID, name: '— Other (Enter Manually) —', searchText: 'other enter manually' },
      ...options,
    ];
  }
  return options;
}

/** Filter dropdown options; uses optional `searchText` (person rows) or falls back to `name` (e.g. departments). */
export function filterOptionsBySearch(options, rawQuery) {
  if (!rawQuery || !String(rawQuery).trim()) return options;
  return options.filter((o) => {
    const hay = o.searchText ?? o.name ?? '';
    return matchesSearchHaystack(hay, rawQuery);
  });
}

export function resolveHostDepartmentForPerson(person, departments) {
  if (!person) return '';
  const dept = departments.find((d) => d.name === person.department);
  return dept ? dept.id : '';
}

export function personMatchesHostDepartment(person, hostDepartment, departments) {
  if (!hostDepartment || !person) return true;
  const dept = departments.find((d) => d.id === hostDepartment);
  return dept ? person.department === dept.name : true;
}

export function nextHostDepartmentSelection(current, hostDepartment, persons, departments) {
  const next = { ...current, hostDepartment };
  if (current.personToMeet && current.personToMeet !== OTHER_ID) {
    const person = persons.find((p) => p.id === current.personToMeet);
    if (person && !personMatchesHostDepartment(person, hostDepartment, departments)) {
      next.personToMeet = '';
      next.personToMeetCustom = '';
    }
  }
  return next;
}
