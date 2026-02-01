import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore, PaneId } from '../store';
import { themeCompartment, listenerCompartment } from '../common/editorCompartments';
import './EditorComponent.css';

interface EditorComponentProps {
    paneId: PaneId;
}

const EditorComponent: React.FC<EditorComponentProps> = ({ paneId }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<EditorView | null>(null);

    // Store State
    const {
        tabs,
        panes,
        theme,
        updateTabContent,
        setEditorState,
        setCursorPos,
        setActivePane
    } = useAppStore();

    // Derived State
    const activeTabId = panes[paneId].activeTabId;
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Refs for stable callbacks
    const activeTabIdRef = useRef(activeTabId);
    const updateTabContentRef = useRef(updateTabContent);
    const setEditorStateRef = useRef(setEditorState);
    const setCursorPosRef = useRef(setCursorPos);

    // Track paneId in ref if needed, but mostly activeTabId is determining factor
    useEffect(() => {
        activeTabIdRef.current = activeTabId;
        updateTabContentRef.current = updateTabContent;
        setEditorStateRef.current = setEditorState;
        setCursorPosRef.current = setCursorPos;
    }, [activeTabId, updateTabContent, setEditorState, setCursorPos]);

    // --- Initialization Logic ---
    useEffect(() => {
        if (!editorRef.current) return;
        if (!activeTab) {
            setView(null); // Clear view if no tab
            return;
        }

        // 1. Definition of update listener
        const updateListener = EditorView.updateListener.of((update) => {
            if (update.selectionSet) {
                const state = update.state;
                const pos = state.selection.main.head;
                const line = state.doc.lineAt(pos);
                setCursorPosRef.current({
                    line: line.number,
                    col: pos - line.from + 1
                });
            }
            if (update.docChanged || update.selectionSet) {
                const currentId = activeTabIdRef.current;
                if (currentId) {
                    if (update.docChanged) updateTabContentRef.current(currentId, update.state.doc.toString(), true);
                    setEditorStateRef.current(currentId, update.state);
                }
            }
        });

        // 2. Extensions Configuration
        const extensions: Extension[] = [
            lineNumbers(),
            highlightActiveLine(),
            history(),
            highlightSelectionMatches(),
            markdown(),
            themeCompartment.of(theme === 'dark' ? oneDark : []),
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
            listenerCompartment.of(updateListener),
            EditorView.domEventHandlers({
                focus: () => {
                    setActivePane(paneId);
                }
            })
        ];

        // 3. State Creation
        let state: EditorState;
        if (activeTab.editorState) {
            state = activeTab.editorState;
        } else {
            state = EditorState.create({
                doc: activeTab.content,
                extensions: extensions
            });
        }

        // 4. View Creation
        const newView = new EditorView({
            state,
            parent: editorRef.current
        });

        // 5. Post-Restore Fixup
        if (activeTab.editorState) {
            newView.dispatch({
                effects: listenerCompartment.reconfigure(updateListener)
            });
            newView.dispatch({
                effects: themeCompartment.reconfigure(theme === 'dark' ? oneDark : [])
            });
        }

        setView(newView);
        if (!activeTab.editorState) {
            setEditorStateRef.current(activeTab.id, state);
        }

        return () => {
            newView.destroy();
            setView(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTabId, paneId]); // Re-mount when tab changes

    // --- Effects ---

    // 1. Theme Change
    useEffect(() => {
        if (!view) return;
        view.dispatch({
            effects: themeCompartment.reconfigure(
                theme === 'dark' ? oneDark : []
            )
        });
    }, [theme, view]);

    // 2. External Content Reload
    const renderedVersionRef = useRef<number>(activeTab?.contentVersion || 0);
    const renderedInternalVersionRef = useRef<number>(activeTab?.internalContentVersion || 0);

    // Sync from Store (External + Internal)
    useEffect(() => {
        if (!view || !activeTab) return;

        let shouldUpdate = false;

        // External Reload
        if (activeTab.contentVersion > renderedVersionRef.current) {
            shouldUpdate = true;
            renderedVersionRef.current = activeTab.contentVersion;
            // Also sync internal version to avoid double update if mixed
            renderedInternalVersionRef.current = activeTab.internalContentVersion;
        }
        // Internal Sync (Other Split Pane)
        else if (activeTab.internalContentVersion > renderedInternalVersionRef.current) {
            // Check if content is actually different to avoid strict loops
            // (Store updates internalVersion on dispatch, so THIS editor will see bump too.
            // But if THIS editor *caused* the bump, doc is already same. 
            // If OTHER editor caused it, doc is different.)
            const currentDoc = view.state.doc.toString();
            if (currentDoc !== activeTab.content) {
                shouldUpdate = true;
            }
            renderedInternalVersionRef.current = activeTab.internalContentVersion;
        }

        if (shouldUpdate) {
            const transaction = view.state.update({
                changes: { from: 0, to: view.state.doc.length, insert: activeTab.content },
            });
            view.dispatch(transaction);
        }
    }, [activeTab?.contentVersion, activeTab?.internalContentVersion, activeTab?.content, view]);

    // 3. Undo/Redo Events
    useEffect(() => {
        const handleUndo = () => { if (view && useAppStore.getState().activePaneId === paneId) undo(view); };
        const handleRedo = () => { if (view && useAppStore.getState().activePaneId === paneId) redo(view); };
        window.addEventListener('editor:undo', handleUndo);
        window.addEventListener('editor:redo', handleRedo);
        return () => {
            window.removeEventListener('editor:undo', handleUndo);
            window.removeEventListener('editor:redo', handleRedo);
        };
    }, [view, paneId]);

    // --- Render ---
    if (!activeTab) {
        return (
            <div
                className="editor-container empty-state"
                onClick={() => setActivePane(paneId)}
                tabIndex={0}
            >
                <div className="empty-message">No file is open</div>
            </div>
        );
    }

    return (
        <div
            className="editor-container"
            ref={editorRef}
            onClick={() => {
                // Ensure focus sets active pane on click
                if (useAppStore.getState().activePaneId !== paneId) {
                    setActivePane(paneId);
                }
            }}
        />
    );
};

export default EditorComponent;
