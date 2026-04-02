import { expect, test, describe, beforeAll } from "bun:test";
import "./setup";
import { t, setTranslationsForTest } from "../src/mainview/utils/i18n";

describe("i18n utility", () => {
    const mockTranslations = {
        editor: {
            bold: "Bold",
            mathInline: "Inline Math ($...$)",
            greeting: "Hello {name}!"
        },
        common: {
            ok: "OK"
        }
    };

    beforeAll(() => {
        setTranslationsForTest(mockTranslations);
    });

    test("should resolve simple nested keys", () => {
        expect(t("common.ok")).toBe("OK");
        expect(t("editor.bold")).toBe("Bold");
    });

    test("should return original key if translation is missing", () => {
        expect(t("missing.key")).toBe("missing.key");
        expect(t("editor.missing")).toBe("editor.missing");
    });

    test("should substitute params correctly", () => {
        expect(t("editor.greeting", { name: "Antigravity" })).toBe("Hello Antigravity!");
    });
    
    test("should return key if value is not a string", () => {
        // @ts-ignore - testing invalid input
        expect(t("editor")).toBe("editor");
    });
});
