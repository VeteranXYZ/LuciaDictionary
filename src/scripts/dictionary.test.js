import { setSetting } from "./storage.js";
import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDictionaryService,
  extractLookupTerms,
  extractWordTerms,
  lookup,
  lookupBaseWord,
  lookupLayered,
  buildCoreFormIndex,
} from "./dictionary.js";

const dict = {
  go: "去",
  do: "做",
  child: "孩子",
  mouse: "老鼠",
  good: "好的",
  run: "跑",
  buy: "买",
  bring: "带来",
  think: "想",
  study: "学习",
  make: "制作",
  take: "拿",
  write: "写",
  see: "看见",
  quick: "快的",
  work: "工作",
};

describe("dictionary lookup", () => {
  it("looks up direct words", () => {
    expect(lookup(dict, "work")).toBe("工作");
  });

  it("handles elementary irregular morphology", () => {
    expect(lookup(dict, "went")).toBe("去(变化形式)");
    expect(lookup(dict, "children")).toBe("孩子");
    expect(lookup(dict, "mice")).toBe("老鼠");
    expect(lookup(dict, "better")).toBe("更好的");
    expect(lookup(dict, "best")).toBe("最好的");
    expect(lookup(dict, "studying")).toBe("学习");
    expect(lookup(dict, "written")).toBe("写(变化形式)");
  });

  it("falls back to regular suffix morphology", () => {
    expect(lookup(dict, "quickly")).toBe("快的地");
    expect(lookup(dict, "worked")).toBe("工作(过去式)");
  });

  it("returns the normalized base word when found", () => {
    expect(lookupBaseWord(dict, "bought")).toEqual({
      base: "buy",
      modifier: "(变化形式)",
    });
  });
});

// The runtime ships the lexicon as an eager head plus a deferred long tail;
// lookups must succeed across both once the tail has been merged in.
const coreLexiconHead = JSON.parse(
  fs.readFileSync("public/assets/lexicon/core-lexicon.json", "utf8"),
);
const coreLexiconExtended = JSON.parse(
  fs.readFileSync("public/assets/lexicon/core-lexicon-extended.json", "utf8"),
);
const coreLexicon = { ...coreLexiconHead, ...coreLexiconExtended };
const sourceCoreLexicon = JSON.parse(
  fs.readFileSync("tools/lexicon-data/core-lexicon.source.json", "utf8"),
);
const phraseLexicon = JSON.parse(
  fs.readFileSync("tools/lexicon-data/phrase-lexicon.json", "utf8"),
);
const formIndex = buildCoreFormIndex(coreLexicon);

describe("local lexicon layers", () => {
  const layers = {
    phraseLexicon,
    coreLexicon,
    formIndex,
    dict: {
      address: "旧地址释义",
      tips: "尖端",
    },
  };

  it("finds required common words locally", () => {
    expect(lookupLayered(layers, "address")).toContain("住址");
    expect(lookupLayered(layers, "activity")).toContain("活动");
    expect(lookupLayered(layers, "privacy")).toContain("隐私");
    expect(lookupLayered(layers, "policy")).toContain("政策");
    expect(lookupLayered(layers, "thoughtful")).toContain("体贴");
    expect(lookupLayered(layers, "supportive")).toBeTruthy();
    expect(lookupLayered(layers, "fun")).toContain("乐趣");
    expect(lookupLayered(layers, "lab")).toContain("实验室");
    expect(lookupLayered(layers, "inbox")).toBeTruthy();
  });

  it("cleans noisy ECDICT meanings at lookup time", () => {
    expect(lookupLayered(layers, "more")).not.toContain("DOS");
    expect(lookupLayered(layers, "share")).not.toContain("DOS");
    expect(lookupLayered(layers, "time")).not.toContain("DOS");
    expect(lookupLayered(layers, "a")).not.toContain("累加器");
    expect(lookupLayered(layers, "art")).not.toContain("平均检索时间");
    expect(lookupLayered(layers, "cm")).not.toContain("通信多路转换器");
  });

  it("resolves required morphology through core forms", () => {
    expect(lookupLayered(layers, "activities")).toContain("活动");
    expect(lookupLayered(layers, "resources")).toBeTruthy();
    expect(lookupLayered(layers, "parents")).toContain("父母");
    expect(lookupLayered(layers, "challenges")).toContain("挑战");
    expect(lookupLayered(layers, "stories")).toContain("故事");
    expect(lookupLayered(layers, "plants")).toBeTruthy();
    expect(lookupLayered(layers, "animals")).toContain("动物");
    expect(lookupLayered(layers, "questions")).toContain("问题");
  });

  it("detects high-priority phrases before single words", () => {
    expect(lookupLayered(layers, "privacy policy")).toBe("隐私政策");
    expect(lookupLayered(layers, "privacy policy")).not.toContain("个人");
    expect(lookupLayered(layers, "email address")).toBe("电子邮件地址");
    expect(lookupLayered(layers, "give up")).toBe("放弃");
    expect(lookupLayered(layers, "face challenges")).toBe("面对挑战");
  });

  it("uses child-friendly context meanings from core lexicon", () => {
    expect(lookupLayered(layers, "tips")).toBeTruthy();
    expect(lookupLayered(layers, "woods")).toContain("树林");
  });

  it("lets core lexicon override existing dict.json meanings", () => {
    expect(lookupLayered(layers, "address")).not.toBe("旧地址释义");
  });

  it("returns phrases and words in sentence reading order", () => {
    const terms = extractLookupTerms(
      "Write your email address and read the privacy policy.",
      phraseLexicon,
    );
    expect(terms).toContain("email address");
    expect(terms).toContain("privacy policy");
    expect(terms.indexOf("write")).toBeLessThan(terms.indexOf("email address"));
    expect(terms.indexOf("email address")).toBeLessThan(
      terms.indexOf("privacy policy"),
    );
  });

  it("does not also split a matched phrase into its own words", () => {
    const terms = extractLookupTerms(
      "Write your email address.",
      phraseLexicon,
    );
    expect(terms).toContain("email address");
    expect(terms).not.toContain("email");
    expect(terms).not.toContain("address");
  });

  it("main analysis resolves classroom phrases as single cards", () => {
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async (task) => task(),
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
    });

    expect(service.extractLookupTerms("grow together")).toEqual([
      "grow together",
    ]);
    expect(service.extractLookupTerms("email address")).toEqual([
      "email address",
    ]);
    expect(service.lookup("privacy policy")).toBe("隐私政策");
  });

  it("filters isolated OCR noise while keeping a and I", () => {
    expect(extractWordTerms("a I g u x r plant 2024 ©")).toEqual([
      "a",
      "I",
      "plant",
    ]);
  });

  it("keeps Lucia and Rayna project names as known local cards", () => {
    expect(lookupLayered(layers, "lucia")).toBe("Lucia，角色名");
    expect(lookupLayered(layers, "rayna")).toBe("Rayna，角色名");
    expect(lookupLayered(layers, "lucia&rayna")).toBe("Lucia & Rayna，品牌名");
    expect(lookupLayered(layers, "luciaandrayna")).toBe(
      "Lucia & Rayna，品牌名",
    );
  });

  it("extracts Lucia and Rayna project names without creating unknown tokens", () => {
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async (task) => task(),
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
    });

    expect(
      service.extractLookupTerms("Lucia&Rayna Rayna Lucia luciaandrayna"),
    ).toEqual(["lucia&rayna", "rayna", "lucia", "luciaandrayna"]);
  });

  it("does not query online for Lucia and Rayna project names", async () => {
    let networkCalls = 0;
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async (task) => {
        networkCalls++;
        return task();
      },
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
    });

    expect(await service.lookupOnlineData("rayna")).toBe(null);
    expect(await service.lookupOnlineData("lucia&rayna")).toBe(null);
    expect(networkCalls).toBe(0);
  });

  it("does not need online lookup for required common words", async () => {
    let networkCalls = 0;
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async (task) => {
        networkCalls++;
        return task();
      },
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
    });

    expect(service.lookup("address")).toContain("住址");
    expect(service.lookup("privacy policy")).toBe("隐私政策");
    expect(await service.lookupOnlineData("address")).toBe(null);
    expect(networkCalls).toBe(0);
  });

  it("does not need online lookup for common OCR words", async () => {
    let networkCalls = 0;
    const service = createDictionaryService({
      dict: {},
      coreLexicon,
      phraseLexicon,
      phonetics: {},
      translateText: async () => "",
      enqueueNetwork: async (task) => {
        networkCalls++;
        return task();
      },
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
    });

    for (const word of [
      "address",
      "activity",
      "privacy",
      "policy",
      "thoughtful",
      "supportive",
      "fun",
      "lab",
      "inbox",
    ]) {
      expect(service.lookup(word)).toBeTruthy();
      expect(await service.lookupOnlineData(word)).toBe(null);
    }
    expect(networkCalls).toBe(0);
  });

  it("does not output empty-cn core entries", () => {
    expect(
      Object.entries(sourceCoreLexicon).filter(
        ([, entry]) => !String(entry.cn || "").trim(),
      ),
    ).toEqual([]);
  });

  it("does not ship generated examples or simple definitions in core entries", () => {
    expect(
      Object.entries(sourceCoreLexicon).filter(
        ([, entry]) =>
          "examples" in entry || "simple" in entry || "source" in entry,
      ),
    ).toEqual([]);
  });

  it("ships a learning band with every compact runtime entry", () => {
    expect(
      Object.values(coreLexicon).every((entry) =>
        ["foundation", "developing", "expanding"].includes(entry[4]),
      ),
    ).toBe(true);
  });
});

describe("word cards from the original sentence", () => {
  it("keeps repeated classroom phrases on one offline card", () => {
    expect(
      extractLookupTerms("Clean up, then clean up!", phraseLexicon),
    ).toEqual(["clean up", "then"]);
    expect(lookupLayered({ phraseLexicon }, "clean up")).toBe("收拾干净");
  });
  it("preserves contractions and their position in a mixed phrase sentence", () => {
    const terms = extractLookupTerms(
      "Don’t show your work yet. I can't swim.",
      phraseLexicon,
    );
    expect(terms).toEqual([
      "don't",
      "show your work",
      "yet",
      "I",
      "can't",
      "swim",
    ]);
    expect(lookupLayered({}, "don’t")).toContain("不要");
    expect(lookupLayered({}, "can't")).toContain("不能");
  });

  it("only displays phonetics recorded for the actual word form", () => {
    const service = createDictionaryService({
      coreLexicon,
      dict: {},
      phonetics: { went: "/went/" },
    });
    expect(service.lookupLocalPhonetic("went")).toBe("went");
    expect(service.lookupLocalPhonetic("children")).toBe("");
    expect(service.lookupLocalPhonetic("child")).toBeTruthy();
  });
});

describe("optional dictionary requests", () => {
  afterEach(() => vi.unstubAllGlobals());
  function onlineDictionary(overrides) {
    return createDictionaryService({
      dict: {},
      phonetics: {},
      enqueueNetwork: (task) => task(),
      getCachedOnlineWord: () => null,
      setCachedOnlineWord: () => {},
      ...overrides,
    });
  }

  it("revokes a queued lookup even if offline-only is subsequently switched off", async () => {
    const values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    let dispatch;
    const service = onlineDictionary({
      enqueueNetwork: (job) =>
        new Promise((resolve) => {
          dispatch = () => resolve(job());
        }),
    });
    const pending = service.lookupOnlineData("classroomexample");
    setSetting("offlineOnly", true);
    setSetting("offlineOnly", false);
    dispatch();
    await expect(pending).rejects.toMatchObject({ code: "offline_only" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries a failed definition translation without saving an error as a meaning", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json([
        {
          meanings: [
            {
              partOfSpeech: "noun",
              definitions: [{ definition: "a school exercise" }],
            },
          ],
        },
      ]),
    );
    const translated = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("练习");
    const cache = vi.fn();
    const service = onlineDictionary({
      translateText: translated,
      setCachedOnlineWord: cache,
    });
    await expect(
      service.lookupOnlineData("classroomexample"),
    ).rejects.toThrow();
    expect(cache).not.toHaveBeenCalled();
    await expect(
      service.lookupOnlineData("classroomexample"),
    ).resolves.toMatchObject({ meaning: "名词：练习" });
    expect(cache).toHaveBeenCalledOnce();
  });
});
