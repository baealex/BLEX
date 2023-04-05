export function getHash(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash += text.charCodeAt(i);
    }
    return hash;
}
