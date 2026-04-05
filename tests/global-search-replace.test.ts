import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { handleFileOperations } from "../src/bun/file-operations";

describe("Global Search and Replace Options", () => {
    const testDir = join(import.meta.dir, "tmp-search-test");

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
        // Create test files with varied content
        await writeFile(join(testDir, "file1.md"), "Hello World\nThis is a test.\nCase sensitive check.");
        await writeFile(join(testDir, "file2.md"), "WholeWord testing\nWord is here\nRegex 123 content");
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    test("Default search (case-insensitive, no whole-word, no regex)", async () => {
        const results = await handleFileOperations.searchInFiles({ 
            query: "hello", 
            dirPath: testDir 
        });
        expect(results.length).toBe(1);
        expect(results[0].matches[0].text).toContain("Hello");
    });

    test("Case sensitive search", async () => {
        // Query "hello" should not match "Hello" when case sensitive
        const noResults = await handleFileOperations.searchInFiles({ 
            query: "hello", 
            dirPath: testDir,
            options: { isCaseSensitive: true, isWholeWord: false, isRegex: false }
        });
        expect(noResults.length).toBe(0);

        // Query "Hello" should match "Hello"
        const results = await handleFileOperations.searchInFiles({ 
            query: "Hello", 
            dirPath: testDir,
            options: { isCaseSensitive: true, isWholeWord: false, isRegex: false }
        });
        expect(results.length).toBe(1);
    });

    test("Whole word search", async () => {
        // "Word" should not match "WholeWord" when whole word is on
        const results = await handleFileOperations.searchInFiles({ 
            query: "Word", 
            dirPath: testDir,
            options: { isCaseSensitive: false, isWholeWord: true, isRegex: false }
        });
        // matches "Word is here" but not "WholeWord testing"
        expect(results.length).toBe(1);
        expect(results[0].matches.length).toBe(1);
        expect(results[0].matches[0].line).toBe(2); 
    });

    test("Regex search", async () => {
        // Search for numbers using regex \d+
        const results = await handleFileOperations.searchInFiles({ 
            query: "\\d+", 
            dirPath: testDir,
            options: { isCaseSensitive: false, isWholeWord: false, isRegex: true }
        });
        expect(results.length).toBe(1);
        expect(results[0].matches[0].text).toContain("123");
    });

    test("Global replace with regex", async () => {
        const filePath = join(testDir, "file2.md");
        
        // Replace numbers with "NUM"
        await handleFileOperations.replaceAllInFiles({
            query: "\\d+",
            replace: "NUM",
            filePaths: [filePath],
            options: { isCaseSensitive: false, isWholeWord: false, isRegex: true }
        });

        const newContent = await readFile(filePath, "utf-8");
        expect(newContent).toContain("Regex NUM content");
    });

    test("Global replace with case sensitivity", async () => {
        const filePath = join(testDir, "file1.md");
        
        // Replace "test" (lowercase) - should not match "Test" if we had it, but here it's "test."
        // We replace "test" with "PROVED"
        await handleFileOperations.replaceAllInFiles({
            query: "test",
            replace: "PROVED",
            filePaths: [filePath],
            options: { isCaseSensitive: true, isWholeWord: false, isRegex: false }
        });

        const content = await readFile(filePath, "utf-8");
        expect(content).toContain("This is a PROVED.");
    });

    test("Search with include filter", async () => {
        // Search "Word" but only in file2.md
        const results = await handleFileOperations.searchInFiles({ 
            query: "Word", 
            dirPath: testDir,
            options: { 
                isCaseSensitive: false, 
                isWholeWord: false, 
                isRegex: false,
                includePattern: "file2.md" 
            }
        });
        expect(results.length).toBe(1);
        expect(results[0].fileName).toBe("file2.md");
    });

    test("Search with exclude filter", async () => {
        // Search "World" (in file1.md) but exclude file1.md
        const results = await handleFileOperations.searchInFiles({ 
            query: "World", 
            dirPath: testDir,
            options: { 
                isCaseSensitive: false, 
                isWholeWord: false, 
                isRegex: false,
                excludePattern: "file1.md" 
            }
        });
        expect(results.length).toBe(0);
    });

    test("Search with wildcard filters", async () => {
        // Include *.md (should match both)
        const results = await handleFileOperations.searchInFiles({ 
            query: "e", 
            dirPath: testDir,
            options: { 
                isCaseSensitive: false, 
                isWholeWord: false, 
                isRegex: false,
                includePattern: "*.md" 
            }
        });
        expect(results.length).toBe(2);
    });
});
