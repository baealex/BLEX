import { Extension, ReactRenderer } from '@tiptap/react';
import type { Range } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import PostLinkSuggestionList from '../components/menus/PostLinkSuggestionList';
import type {
    PostLinkSuggestionListHandle,
    PostLinkSuggestionListProps
} from '../components/menus/PostLinkSuggestionList';
import {
    POST_LINK_SEARCH_DEBOUNCE_MS,
    POST_LINK_TRIGGER,
    buildPostLinkContent,
    isPostLinkQuery
} from '../config/postLink';
import type { PostLinkCandidate, PostLinkSearch } from '../config/postLink';

export interface PostLinkSuggestionOptions {
    search: PostLinkSearch | null;
}

const postLinkSuggestionPluginKey = new PluginKey('postLinkSuggestion');

const isInsideCode = (state: EditorState, range: Range) => {
    if (state.doc.resolve(range.from).parent.type.spec.code) {
        return true;
    }

    const codeMark = state.schema.marks.code;
    return Boolean(codeMark && state.doc.rangeHasMark(range.from, range.to, codeMark));
};

export const PostLinkSuggestion = Extension.create<PostLinkSuggestionOptions>({
    name: 'postLinkSuggestion',

    addOptions() {
        return { search: null };
    },

    addProseMirrorPlugins() {
        const { search } = this.options;
        if (!search) {
            return [];
        }

        let lastSearchFailed = false;
        let visibleItems: PostLinkCandidate[] = [];

        return [
            Suggestion<PostLinkCandidate, PostLinkCandidate>({
                editor: this.editor,
                pluginKey: postLinkSuggestionPluginKey,
                char: POST_LINK_TRIGGER,
                allowSpaces: true,
                allowedPrefixes: null,
                debounce: POST_LINK_SEARCH_DEBOUNCE_MS,
                allow: ({ state, range }) => {
                    const query = state.doc.textBetween(range.from, range.to).slice(POST_LINK_TRIGGER.length);
                    return isPostLinkQuery(query) && !isInsideCode(state, range);
                },
                items: async ({ query, signal }) => {
                    try {
                        const items = await search(query, { signal });
                        lastSearchFailed = false;
                        return items;
                    } catch (error) {
                        if (signal.aborted) {
                            throw error;
                        }
                        lastSearchFailed = true;
                        return [];
                    }
                },
                command: ({ editor, range, props }) => {
                    const nextText = editor.state.doc.textBetween(
                        range.to,
                        Math.min(range.to + 1, editor.state.doc.content.size)
                    );
                    // Reuse an existing following space instead of leaving two spaces after the link.
                    const replaceRange =
                        nextText === ' '
                            ? {
                                  ...range,
                                  to: range.to + 1
                              }
                            : range;

                    editor.chain().focus().insertContentAt(replaceRange, buildPostLinkContent(props)).run();
                },
                render: () => {
                    let component: ReactRenderer<PostLinkSuggestionListHandle, PostLinkSuggestionListProps> | null =
                        null;
                    let unmount: (() => void) | null = null;

                    const toListProps = (props: {
                        items: PostLinkCandidate[];
                        loading: boolean;
                        command: (item: PostLinkCandidate) => void;
                    }): PostLinkSuggestionListProps => {
                        // Keep the previous results on screen while the next query loads to avoid flicker.
                        if (!props.loading) {
                            visibleItems = props.items;
                        }

                        return {
                            items: visibleItems,
                            loading: props.loading,
                            failed: !props.loading && lastSearchFailed,
                            command: props.command
                        };
                    };

                    return {
                        onStart: (props) => {
                            visibleItems = [];
                            lastSearchFailed = false;
                            component = new ReactRenderer(PostLinkSuggestionList, {
                                editor: props.editor,
                                props: toListProps(props),
                                className: 'z-[1100]'
                            });
                            unmount = props.mount(component.element);
                        },
                        onUpdate: (props) => {
                            component?.updateProps(toListProps(props));
                        },
                        onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,
                        onExit: () => {
                            unmount?.();
                            component?.destroy();
                            unmount = null;
                            component = null;
                            visibleItems = [];
                        }
                    };
                }
            })
        ];
    }
});
