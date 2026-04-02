import { state } from "../state/workspace";

type Translations = Record<string, any>;

let currentTranslations: Translations = {};
let currentLocale = 'ja';

export async function initI18n() {
    const savedLocale = localStorage.getItem('editary-language') || 'ja';
    await loadLocale(savedLocale);
}

export async function loadLocale(locale: string) {
    try {
        const response = await fetch(`views://mainview/locales/${locale}.json`);
        if (!response.ok) throw new Error(`Failed to load locale: ${locale}`);
        currentTranslations = await response.json();
        currentLocale = locale;
        state.editorSettings.language = locale as 'ja' | 'en';
        localStorage.setItem('editary-language', locale);
        document.documentElement.lang = locale;
        updateUI();
    } catch (error) {
        console.error("i18n error:", error);
    }
}

export function t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value = currentTranslations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key;
        }
    }

    if (typeof value !== 'string') return key;

    let translated = value as string;
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            translated = translated.replace(`{${k}}`, String(v));
        });
    }
    
    return translated;
}

export function updateUI() {
    // 1. Text Content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.textContent = t(key);
        }
    });

    // 2. Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            const translated = t(key);
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                el.placeholder = translated;
            }
            // CSS の attr(data-placeholder) や var(--placeholder-text) で参照できるように設定
            el.setAttribute('data-placeholder', translated);
            el.style.setProperty('--placeholder-text', `"${translated}"`);
        }
    });

    // 3. Tooltips
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        if (key) {
            el.setAttribute('data-tooltip', t(key));
        }
    });

    // 4. Aria Labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key) {
            el.setAttribute('aria-label', t(key));
        }
    });
}

export function getLocale(): string {
    return currentLocale;
}
