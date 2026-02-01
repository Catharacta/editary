import React, { useEffect, useRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore } from '../store';
import './EditorComponent.css';

const EditorComponent: React.FC = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Store Integration
    const { tabs, activeTabId, updateTabContent, setEditorState } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Refs to hold latest values for callbacks without triggering re-effects
    const activeTabIdRef = useRef(activeTabId);
    const updateTabContentRef = useRef(updateTabContent);
    const setEditorStateRef = useRef(setEditorState);

    useEffect(() => {
        activeTabIdRef.current = activeTabId;
        updateTabContentRef.current = updateTabContent;
        setEditorStateRef.current = setEditorState;
    }, [activeTabId, updateTabContent, setEditorState]);

    // Listener Compartment to allow dynamic updates if needed (though ref approach simplifies this)
    const listenerCompartment = useRef(new Compartment());

    // Initialize Editor View (Run Once)
    useEffect(() => {
        if (!editorRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet) {
                const currentId = activeTabIdRef.current;
                if (!currentId) return;

                // Save content and dirty state
                if (update.docChanged) {
                    const content = update.state.doc.toString();
                    updateTabContentRef.current(currentId, content, true);
                }

                // Save EditorState (for history/undo/redo persistence)
                // We save it on every change? Or on blur/switch?
                // Saving on every change ensures we don't lose history if app crashes or tab switches suddenly.
                // EditorState is immutable structure sharing, so it's efficient.
                setEditorStateRef.current(currentId, update.state);
            }
        });

        const extensions: Extension[] = [
            lineNumbers(),
            highlightActiveLine(),
            history(),
            highlightSelectionMatches(),
            markdown(),
            oneDark,
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap
            ]),
            listenerCompartment.current.of(updateListener)
        ];

        // Initial placeholder state
        const state = EditorState.create({
            doc: "",
            extensions
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    // Handle Active Tab Change
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        if (!activeTab) {
            // No active tab? Maybe clear editor
            view.setState(EditorState.create({ doc: "", extensions: [] })); // Or show empty
            return;
        }

        // If the tab already has a state, restore it
        if (activeTab.editorState) {
            if (view.state !== activeTab.editorState) {
                view.setState(activeTab.editorState);
            }
        } else {
            // New tab or first load of tab -> Create new State
            // We need to re-use the same extensions configuration defined in init
            // But we can't easily extract "extensions" from the view to create a NEW state completely from scratch 
            // without re-declaring them.

            // Better: We stored the extensions config implicitly in the view's current state (via init).
            // But `EditorState.create` needs explicit extensions.

            const updateListener = EditorView.updateListener.of((update) => {
                if (update.docChanged || update.selectionSet) {
                    const currentId = activeTabIdRef.current;
                    if (!currentId) return;
                    if (update.docChanged) {
                        updateTabContentRef.current(currentId, update.state.doc.toString(), true);
                    }
                    setEditorStateRef.current(currentId, update.state);
                }
            });

            const extensions: Extension[] = [
                lineNumbers(),
                highlightActiveLine(),
                history(),
                highlightSelectionMatches(),
                markdown(),
                oneDark,
                keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
                listenerCompartment.current.of(updateListener)
            ];

            const newState = EditorState.create({
                doc: activeTab.content || "",
                extensions
            });

            view.setState(newState);
            // Also update the store immediately with this initial state so we have history init
            setEditorState(activeTab.id, newState);
        }

        // Focus editor
        view.focus();

    }, [activeTabId]); // Dependency on ID is enough, we pull data from activeTab via ID lookup or closure? 
    // Wait, `activeTab` object changes when content changes. We DON'T want to reset state on every keystroke.
    // So dependency should ONLY be `activeTabId`.
    // But we need `activeTab` data inside the effect. 
    // Re-fetching `activeTab` inside effect is safe since `activeTab` is in scope.
    // BUT we must ensure we don't trigger this effect if `activeTab` content changed but ID didn't.
    // So `[activeTabId]` is correct. `activeTab` in closure will be the updated one?
    // No, `activeTab` in the component scope updates on every render.
    // The effect runs only when `activeTabId` changes.
    // So `activeTab` inside the effect will be the value AT THE TIME `activeTabId` changed.
    // That's exactly what we want (initial load of tab).

    return (
        <div className="editor-container" ref={editorRef} />
    );
};

export default EditorComponent;
