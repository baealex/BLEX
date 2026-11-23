export type EscapeAction = 'close' | 'clear' | 'hold' | 'none';

type EscapeKey = Pick<KeyboardEvent, 'isComposing' | 'keyCode' | 'repeat'>;

/** Safari ends composition before the keydown, so only this key code shows the IME handled the key. */
const imeProcessKeyCode = 229;

/**
 * Decides what Esc does in the search box. Every action except `none` must cancel the browser's
 * default, because native search inputs clear themselves and fire an `input` event that reopens the panel.
 * `hold` does nothing else: the IME owns the key, or a held key must not turn a close into a clear.
 */
export function escapeAction(key: EscapeKey, panelOpen: boolean, hasText: boolean): EscapeAction {
    if (key.isComposing || key.keyCode === imeProcessKeyCode) return 'hold';
    if (panelOpen) return 'close';
    if (!hasText) return 'none';
    return key.repeat ? 'hold' : 'clear';
}
