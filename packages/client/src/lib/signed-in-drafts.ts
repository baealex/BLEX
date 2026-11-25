// Screens keep a signed-in viewer's unsaved edits under these names. Each entry names its account, and a
// signed-out visitor has none, so signing out removes them all.
/** The post editor's local copies of unsaved edits, in local storage. */
export const postEditRecoveryPrefix = 'blex:post-edit-recovery';
/** The post list's unsaved tag and series changes, in session storage. */
export const postClassificationDraftsKey = 'blex:settings-post-classification-drafts';

/** Removes the unsaved edits that signed-in screens keep in browser storage. */
export function removeSignedInDrafts(): void {
    try {
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith(`${postEditRecoveryPrefix}:`)) localStorage.removeItem(key);
        }
    } catch {
        /* Without local storage there is no copy to remove. */
    }
    try {
        sessionStorage.removeItem(postClassificationDraftsKey);
    } catch {
        /* Without session storage there is no draft to remove. */
    }
}
