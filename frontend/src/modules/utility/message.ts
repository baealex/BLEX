const LEVEL = {
    CONFIRM: '😮 ',
    SYSTEM_ERR: '😱 ',
    BEFORE_REQ_ERR: '🤔 ',
    AFTER_REQ_ERR: '😥 ',
    AFTER_REQ_DONE: '😀 '
};

type MessageLevel = keyof typeof LEVEL;

export function message(level: MessageLevel, text?: string) {
    return LEVEL[level] + (text ? text : '');
}