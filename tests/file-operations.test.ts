import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { handleFileOperations } from "../src/bun/file-operations";

describe("file-operations", () => {
    const testRoot = join(import.meta.dir, "tmp-test");

    beforeAll(async () => {
        await mkdir(testRoot, { recursive: true });
        await mkdir(join(testRoot, "subdir"), { recursive: true });
        await writeFile(join(testRoot, "test.md"), "# Hello");
        await writeFile(join(testRoot, "subdir", "sub.md"), "## Sub");
        await writeFile(join(testRoot, "ignore.txt"), "Ignore me");
    });

    afterAll(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    test("readDirectory should return a tree of .md files", async () => {
        const entries = await handleFileOperations.readDirectory({ dirPath: testRoot });
        
        // Tree should have: test.md and subdir (which contains sub.md)
        expect(entries.length).toBe(2);
        
        const testMd = entries.find(e => e.name === "test.md");
        const subdir = entries.find(e => e.name === "subdir");
        
        expect(testMd).toBeDefined();
        expect(testMd?.isDirectory).toBe(false);
        
        expect(subdir).toBeDefined();
        expect(subdir?.isDirectory).toBe(true);
        expect(subdir?.children?.length).toBe(1);
        expect(subdir?.children?.[0].name).toBe("sub.md");
    });

    test("readFile should return content", async () => {
        const content = await handleFileOperations.readFile({ filePath: join(testRoot, "test.md") });
        expect(content).toBe("# Hello");
    });

    test("getLicenses should load from JSON", async () => {
        const licenses = await handleFileOperations.getLicenses({});
        expect(Array.isArray(licenses)).toBe(true);
        expect(licenses.length).toBeGreaterThan(0);
        expect(licenses[0]).toHaveProperty("name");
        expect(licenses[0]).toHaveProperty("text");
    });
});
