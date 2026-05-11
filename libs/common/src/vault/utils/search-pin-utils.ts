const searchPinMarkerPrefix = "<!--BW-SEARCH-PIN:";
const searchPinMarkerSuffix = "-->";

export type SearchPinNotesData = {
  visibleNotes: string;
  searchPin: string | null;
};

export function parseSearchPinFromNotes(notes?: string | null): SearchPinNotesData {
  if (notes == null || notes === "") {
    return {
      visibleNotes: "",
      searchPin: null,
    };
  }

  const markerRegex = /(?:\r?\n)?<!--BW-SEARCH-PIN:([^]+?)-->$/;
  const match = markerRegex.exec(notes);

  if (match == null || match.index == null) {
    return {
      visibleNotes: notes,
      searchPin: null,
    };
  }

  try {
    return {
      visibleNotes: notes.slice(0, match.index),
      searchPin: decodeURIComponent(match[1]),
    };
  } catch {
    return {
      visibleNotes: notes,
      searchPin: null,
    };
  }
}

export function getVisibleNotes(notes?: string | null): string {
  return parseSearchPinFromNotes(notes).visibleNotes;
}

export function getSearchPin(notes?: string | null): string | null {
  return parseSearchPinFromNotes(notes).searchPin;
}

export function hasSearchPin(notes?: string | null): boolean {
  return !!getSearchPin(notes);
}

export function matchesSearchPinExactly(
  notes: string | null | undefined,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery === "") {
    return false;
  }

  const searchPin = getSearchPin(notes);

  return searchPin != null && searchPin !== "" && normalizeSearchPin(searchPin) === normalizedQuery;
}

export function buildNotesWithSearchPin(
  visibleNotes?: string | null,
  searchPin?: string | null,
): string | null {
  const normalizedVisibleNotes = visibleNotes ?? "";
  const normalizedSearchPin = searchPin?.trim() ?? "";

  if (normalizedSearchPin === "") {
    return normalizedVisibleNotes === "" ? null : normalizedVisibleNotes;
  }

  const encodedSearchPin = encodeURIComponent(normalizedSearchPin);
  const searchPinMarker = searchPinMarkerPrefix + encodedSearchPin + searchPinMarkerSuffix;

  if (normalizedVisibleNotes === "") {
    return searchPinMarker;
  }

  return normalizedVisibleNotes + "\n" + searchPinMarker;
}

function normalizeSearchPin(searchPin: string): string {
  return searchPin
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
