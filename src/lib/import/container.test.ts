import { gzipSync } from "node:zlib";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { decodeText, readSourceFiles } from "./container";
import { ImportError } from "./types";

const enc = (s: string) => new TextEncoder().encode(s);

describe("decodeText", () => {
  it("decodes plain UTF-8 and strips a BOM", () => {
    expect(decodeText(enc("hello"))).toBe("hello");
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc("hi")]))).toBe("hi");
  });

  it("decodes UTF-16LE with a BOM", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]); // "AB"
    expect(decodeText(bytes)).toBe("AB");
  });
});

describe("readSourceFiles", () => {
  it("passes plain text through unchanged", () => {
    const files = readSourceFiles(enc("Title\nGoblin"), "list.csv");
    expect(files).toEqual([{ name: "list.csv", text: "Title\nGoblin" }]);
  });

  it("unpacks a .gz file", () => {
    const gz = gzipSync(Buffer.from("Title\nGoblin"));
    const files = readSourceFiles(gz, "animelist.xml.gz");
    expect(files).toEqual([{ name: "animelist.xml", text: "Title\nGoblin" }]);
  });

  it("unpacks a single-file zip", () => {
    const zip = zipSync({ "list.csv": enc("Title\nGoblin") });
    const files = readSourceFiles(zip, "export.zip");
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("list.csv");
    expect(files[0].text).toBe("Title\nGoblin");
  });

  it("picks the Letterboxd files out of a multi-file export zip", () => {
    const zip = zipSync({
      "profile.csv": enc("ignored"),
      "watched.csv": enc("Date,Name,Year,Letterboxd URI\n2020-01-01,Oldboy,2003,x"),
      "ratings.csv": enc("Date,Name,Year,Letterboxd URI,Rating\n2020-01-01,Oldboy,2003,x,4.5"),
      "comments.csv": enc("ignored"),
    });
    const files = readSourceFiles(zip, "letterboxd-export.zip");
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(["ratings.csv", "watched.csv"]);
  });

  it("rejects an empty file", () => {
    expect(() => readSourceFiles(new Uint8Array(0), "x.csv")).toThrow(ImportError);
  });

  it("rejects a zip with no readable list inside", () => {
    const zip = zipSync({ "cover.jpg": enc("hello"), "data.json": enc("{}") });
    expect(() => readSourceFiles(zip, "export.zip")).toThrow(ImportError);
  });

  it("rejects a zip with several unrelated list files (ambiguous)", () => {
    const zip = zipSync({ "a.csv": enc("Title\nA"), "b.csv": enc("Title\nB") });
    expect(() => readSourceFiles(zip, "export.zip")).toThrow(ImportError);
  });

  it("ignores files nested in subfolders of a zip", () => {
    const zip = zipSync({ "nested/list.csv": enc("Title\nGoblin"), "top.csv": enc("Title\nGoblin") });
    const files = readSourceFiles(zip, "export.zip");
    expect(files.map((f) => f.name)).toEqual(["top.csv"]);
  });
});
