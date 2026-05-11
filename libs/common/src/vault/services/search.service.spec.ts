import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SearchService } from "./search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

describe("SearchService", () => {
  let service: SearchService;

  const userId = "user-id" as UserId;
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };
  const mockLocale$ = new BehaviorSubject<string>("en");
  const mockI18nService = {
    locale$: mockLocale$.asObservable(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(
      mockLogService as unknown as LogService,
      mockI18nService as unknown as I18nService,
    );
  });

  describe("isSearchable", () => {
    it("returns false if the query is empty", async () => {
      const result = await service.isSearchable("");
      expect(result).toBe(false);
    });

    it("returns false if the query is null", async () => {
      const result = await service.isSearchable(null as any);
      expect(result).toBe(false);
    });

    it("returns true if the query is longer than searchableMinLength", async () => {
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable("test");
      expect(result).toBe(true);
    });

    it("returns false if the query is shorter than searchableMinLength", async () => {
      service["searchableMinLength"] = 5;
      const result = await service.isSearchable("test");
      expect(result).toBe(false);
    });
  });

  describe("searchCiphers", () => {
    it("uses basic search for regular queries", async () => {
      const basicSearchSpy = jest.spyOn(service, "searchCiphersBasic");
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "personal", ciphers);

      expect(basicSearchSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("returns original ciphers for non-searchable queries", async () => {
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "", ciphers);

      expect(result).toEqual(ciphers);
    });

    it("hides ciphers with a search pin from regular search results", async () => {
      const visibleCipher = createCipherView("cipher-1", "Github");
      const hiddenCipher = createCipherView("cipher-2", "Github");
      hiddenCipher.notes = "Visible note\n<!--BW-SEARCH-PIN:1234-->";

      const result = await service.searchCiphers(userId, null, "github", [
        visibleCipher,
        hiddenCipher,
      ]);

      expect(result).toEqual([visibleCipher]);
    });

    it("reveals ciphers with a search pin on an exact pin search", async () => {
      const hiddenCipher = createCipherView("cipher-1", "Github");
      hiddenCipher.notes = "Visible note\n<!--BW-SEARCH-PIN:1234-->";

      const result = await service.searchCiphers(userId, null, "1234", [hiddenCipher]);

      expect(result).toEqual([hiddenCipher]);
    });

    it("does not reveal ciphers with partial search pin matches", async () => {
      const hiddenCipher = createCipherView("cipher-1", "Github");
      hiddenCipher.notes = "Visible note\n<!--BW-SEARCH-PIN:1234-->";

      const result = await service.searchCiphers(userId, null, "123", [hiddenCipher]);

      expect(result).toEqual([]);
    });

    it("reveals ciphers with a one-character search pin even when the query is normally too short", async () => {
      const hiddenCipher = createCipherView("cipher-1", "Github");
      hiddenCipher.notes = "Visible note\n<!--BW-SEARCH-PIN:1-->";

      const result = await service.searchCiphers(userId, null, "1", [hiddenCipher]);

      expect(result).toEqual([hiddenCipher]);
    });
  });

  describe("searchCiphersBasic", () => {
    it("adds exact search pin matches even when the regular search fields do not match", () => {
      const hiddenCipher = createCipherView("cipher-1", "Github");
      hiddenCipher.notes = "Visible note\n<!--BW-SEARCH-PIN:1234-->";

      expect(service.searchCiphersBasic([hiddenCipher], "1234")).toEqual([hiddenCipher]);
    });
  });
});
