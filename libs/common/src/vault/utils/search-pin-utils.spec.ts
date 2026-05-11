import {
  buildNotesWithSearchPin,
  getSearchPin,
  getVisibleNotes,
  hasSearchPin,
  matchesSearchPinExactly,
  parseSearchPinFromNotes,
} from "./search-pin-utils";

describe("search-pin-utils", () => {
  it("parses visible notes and search pin from stored notes", () => {
    const notes = buildNotesWithSearchPin("Visible note", "1234");

    expect(parseSearchPinFromNotes(notes)).toEqual({
      visibleNotes: "Visible note",
      searchPin: "1234",
    });
  });

  it("stores marker-only notes when there is only a search pin", () => {
    const notes = buildNotesWithSearchPin("", "1234");

    expect(notes).toBe("<!--BW-SEARCH-PIN:1234-->");
    expect(getVisibleNotes(notes)).toBe("");
    expect(getSearchPin(notes)).toBe("1234");
  });

  it("removes the search pin marker when the pin is cleared", () => {
    expect(buildNotesWithSearchPin("Visible note", "")).toBe("Visible note");
    expect(buildNotesWithSearchPin("", "")).toBeNull();
  });

  it("matches a search pin only on exact normalized query equality", () => {
    const notes = buildNotesWithSearchPin("Visible note", "Cafe");

    expect(matchesSearchPinExactly(notes, "cafe")).toBe(true);
    expect(matchesSearchPinExactly(notes, "caf")).toBe(false);
    expect(matchesSearchPinExactly(notes, "cafes")).toBe(false);
  });

  it("detects when notes contain a search pin", () => {
    expect(hasSearchPin(buildNotesWithSearchPin("Visible note", "1234"))).toBe(true);
    expect(hasSearchPin("Visible note")).toBe(false);
  });
});
