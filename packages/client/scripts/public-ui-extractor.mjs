import ts from 'typescript';
import { babelExtractor } from '@lingui/cli/api/extractors/babel';

/** Public pages share the Lingui catalog while keeping the helper out of the macro transform. */
export function extractPublicMessages(filename, code) {
    const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
    const helpers = new Set();
    for (const node of source.statements) {
        if (!ts.isImportDeclaration(node) || !/\/public-ui(?:\.js)?$/.test(node.moduleSpecifier.text)) continue;
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            for (const item of bindings.elements) {
                if ((item.propertyName ?? item.name).text === 'ui') helpers.add(item.name.text);
            }
        }
    }
    const messages = [];
    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && helpers.has(node.expression.text)) {
            const [message, , explicitId] = node.arguments;
            if (!message || !(ts.isStringLiteral(message) || ts.isNoSubstitutionTemplateLiteral(message))) {
                throw new Error(`${filename}: public UI messages must have a literal English source.`);
            }
            if (/[가-힣]/.test(message.text) || (explicitId && !ts.isStringLiteral(explicitId))) {
                throw new Error(`${filename}: use English source messages and literal message IDs.`);
            }
            const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
            messages.push({
                id: explicitId?.text ?? `public.${message.text}`,
                message: message.text,
                origin: [filename, line + 1, character]
            });
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return messages;
}

export default {
    match: babelExtractor.match,
    async extract(filename, code, onMessageExtracted, context) {
        await babelExtractor.extract(filename, code, onMessageExtracted, context);
        for (const message of extractPublicMessages(filename, code)) onMessageExtracted(message);
    }
};
