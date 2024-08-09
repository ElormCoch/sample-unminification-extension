import tsc, {type default as ts} from 'typescript';
import {FunctionDescriptor} from './FunctionDescriptor';

export interface ExtensionRequest {
  requestId: number,
  method: string,
  parameters: ExtensionRequestParams,
}

export interface ExtensionRequestParams {
  request: {
    fileName: string,
    sourceContent: string,
    sourceMap: SourceMapEntry,
    unminificationMode: UnminificationMode, // UnminificationMode
  }
}
export interface SourceMapEntry {
lineNumber: number;
columnNumber: number;
sourceURL: string|undefined;
sourceLineNumber: number;
sourceColumnNumber: number;
name: string|undefined;
}

export default class FunctionNameGuesserPlugin implements chrome.devtools.functionNameGuesser.FunctionNameGuesserExtensionPlugin {
    getFunctionRanges(fileName: string, sourceContent: string, sourceMap?: SourceMapEntry, unminificationMode?: UnminificationMode ): FunctionDescriptor[] {  
      return parse(sourceContent, fileName, unminificationMode ?? UnminificationMode.Default);
    }
}

function parse(source: string, fileName: string, unminificationMode: UnminificationMode) {
    const markName = `parsing: ${fileName}`;
    const endMarkName = `${markName}-end`;
    performance.mark(markName);
    const kind = getFileType(fileName);
    const tsSource = tsc.createSourceFile(fileName, source, tsc.ScriptTarget.ESNext, /* setParentNodes: */ true, kind);
    const result = visitRoot(tsSource, fileName, unminificationMode);
    performance.mark(endMarkName);
    performance.measure(fileName, markName, endMarkName);
    return result;
}

export const enum UnminificationMode {
    Default = 0,
    HeapSnapshot = 1,
}

function getFileType(fileName: string) {
  try {
    const lowered = fileName.toLowerCase();
    if (lowered.endsWith('.tsx')) {
      return tsc.ScriptKind.TSX;
    }

    if (lowered.endsWith('.ts')) {
      return tsc.ScriptKind.TS;
    }

    if (lowered.endsWith('.jsx')) {
      return tsc.ScriptKind.JSX;
    }

    if (lowered.endsWith('.js') || lowered.endsWith('.cjs') || lowered.endsWith('.mjs')) {
      return tsc.ScriptKind.JS;
    }

    return tsc.ScriptKind.TS;
  } catch (e) {
    console.log(e)
  }
}

function visitRoot(
    source: ts.SourceFile, fileName: string, unminificationMode: UnminificationMode): FunctionDescriptor[] {
  const accumulator: FunctionDescriptor[] = [];

  const name = `globalCode: ${fileName}`;
  accumulator.push(createDescriptor(name, source, source));

  for (const child of source.getChildren()) {
    visitNodeIterative(accumulator, child, source, unminificationMode);
  }

  return accumulator;
}

function visitNodeIterative(
    dest: FunctionDescriptor[], node: ts.Node, source: ts.SourceFile, unminificationMode: UnminificationMode): void {
  if (tsc.isFunctionDeclaration(node) || tsc.isFunctionExpression(node) || tsc.isMethodDeclaration(node) ||
      tsc.isArrowFunction(node) || tsc.isConstructorDeclaration(node) || tsc.isGetAccessor(node) ||
      tsc.isGetAccessorDeclaration(node) || tsc.isSetAccessor(node) || tsc.isSetAccessorDeclaration(node)) {
    visitFunctionNodeImpl(dest, node, source, unminificationMode);
  }

  for (const child of node.getChildren()) {
    visitNodeIterative(dest, child, source, unminificationMode);
  }
}

async function loadTypeScript() {
  const mod = await import('typescript');
  if (!mod.default) {
    throw new ReferenceError('Enhanced DevTools were not available.');
  }
  return mod.default;
}


function visitFunctionNodeImpl(
    dest: FunctionDescriptor[], node: ts.FunctionLikeDeclaration, source: ts.SourceFile,
    unminificationMode: UnminificationMode): void {
if (node.body) {
    const name = getFunctionName(node, unminificationMode);
    const descriptor = createDescriptor(name, node, source);
    dest.push(descriptor);
  }
}

function createDescriptor(name: string, range: ts.TextRange, source: ts.SourceFile) {
  const {pos, end} = range;
  const {line: startLine, character: startColumn} = source.getLineAndCharacterOfPosition(pos);
  const {line: endLine, character: endColumn} = source.getLineAndCharacterOfPosition(end);

  return new FunctionDescriptor(name, startLine, startColumn, endLine, endColumn);
}

function getFunctionName(func: ts.FunctionLikeDeclaration, unminificationMode: UnminificationMode): string {
  let nameText = `anonymousFunction`;
  const nameNode = func.name;
  if (nameNode) {
    // named function, property name, identifier, string, computed property
    /**
     * function foo() {}   <--
     * class Sample {
     *   constructor() { }   NOT this one
     *   bar() { }    <--
     *   get baz() { }    <--
     *   set frob() { }    <--
     *   [Symbol.toString]()    <--
     * }
     */
    nameText = getNameOfNameNode(nameNode, func, nameText);
  } else if (tsc.isConstructorDeclaration(func)) {
    /**
     * class Sample {
     *   constructor() { }   <--
     * }
     */
    // (constructor for class Foo)
    const classDefinition = func.parent;
    if (tsc.isClassDeclaration(classDefinition)) {
      let className = 'anonymousClass';
      if (classDefinition.name) {
        className = classDefinition.name.text;
      }
      nameText = (unminificationMode === UnminificationMode.HeapSnapshot) ?
          `classConstructorCall: ${className}` :
          `constructorCall:, ${className}`;
    }
  } else {
    /**
     * const x = function() { }
     * const y = () => { }
     * const z = {
     *  frob: function() { },
     *  florbo: () => { },
     * }
     *
     * doSomething(function() { })
     * doSomething(() => { })
     */

    if (tsc.isFunctionExpression(func) || tsc.isArrowFunction(func)) {
      let parent = func.parent;
      // e.g., ( () => { } )
      if (tsc.isParenthesizedExpression(parent)) {
        parent = parent.parent;
      }

      if (tsc.isVariableDeclaration(parent) || tsc.isPropertyAssignment(parent) ||
          tsc.isPropertyDeclaration(parent)) {
        if (parent.name && tsc.isIdentifier(parent.name)) {
          nameText = getNameOfNameNode(parent.name, func, nameText);
        }
      } else if (tsc.isBinaryExpression(parent) && parent.operatorToken.kind === tsc.SyntaxKind.EqualsToken) {
        if (tsc.isPropertyAccessExpression(parent.left) || tsc.isElementAccessExpression(parent.left)) {
          nameText = recursivelyGetPropertyAccessName(parent.left);
        } else if (
            tsc.isIdentifier(parent.left) || tsc.isStringLiteral(parent.left) || tsc.isNumericLiteral(parent.left)) {
          nameText = parent.left.text;
        }
        // else unknown
      } else if (tsc.isCallOrNewExpression(func.parent) || tsc.isDecorator(func.parent)) {
        let parentExpressionName = recursivelyGetPropertyAccessName(func.parent.expression);
        if (tsc.isNewExpression(func.parent)) {
          // Localization is not required: this is a programming expression ("new Foo")
          parentExpressionName = `new ${parentExpressionName}`;
        }
        nameText = `anonymousCallbackTo: ${parentExpressionName}`;
      }
    }
  }

  return nameText;
}

function recursivelyGetPropertyAccessName(expression: ts.Expression): string {
  if (tsc.isPropertyAccessExpression(expression)) {
    return `${recursivelyGetPropertyAccessName(expression.expression)}.${expression.name.text}`;
  }

  if (tsc.isElementAccessExpression(expression)) {
    return `${recursivelyGetPropertyAccessName(expression.expression)}[${expression.argumentExpression}]`;
  }

  if (tsc.isCallExpression(expression)) {
    return expression.getText();
  }

  if (tsc.isIdentifier(expression) || tsc.isStringLiteral(expression) || tsc.isNumericLiteral(expression)) {
    return expression.text;
  }

  return `computedProperty`;
}

function getNameOfNameNode(nameNode: ts.PropertyName, declaringNode: ts.Node, fallback: string): string {
  let nameText = fallback;
  switch (nameNode.kind) {
    case tsc.SyntaxKind.ComputedPropertyName:
      if (tsc.isIdentifier(nameNode.expression)) {
        nameText = `[${nameNode.expression.text}]`;
      } else if (tsc.isStringLiteral(nameNode.expression) || tsc.isNumericLiteral(nameNode.expression)) {
        nameText = `[${nameNode.expression.text}]`;
      } else {
        nameText = `computedProperty`;
      }
      break;

    case tsc.SyntaxKind.StringLiteral:
    case tsc.SyntaxKind.NumericLiteral:
    case tsc.SyntaxKind.Identifier:
    case tsc.SyntaxKind.PrivateIdentifier:
      nameText = nameNode.text;
      break;
  }

  if (tsc.isGetAccessor(declaringNode) || tsc.isGetAccessorDeclaration(declaringNode)) {
    nameText = `get ${nameText}`;
  } else if (tsc.isSetAccessor(declaringNode) || tsc.isSetAccessor(declaringNode)) {
    nameText = `set ${nameText}`;
  }

  if (declaringNode.parent && tsc.isClassDeclaration(declaringNode.parent)) {
    let className = `anonymousClass)`;
    if (declaringNode.parent.name) {
      className = declaringNode.parent.name.text;
    }

    nameText = `${className}.${nameText}`;
  }

  return nameText;
}

let scriptLoadPromise: Promise<any> | undefined = undefined;
export async function getFunctionParser() {
  let tsc;

  try {
    if (!scriptLoadPromise) {
      scriptLoadPromise = loadTypeScript();
    }
    tsc = await scriptLoadPromise;
  } catch (_ignored) {
    return null;
  }

  if (!tsc) {
    return null;
  }

  return parse;
}

chrome.devtools.functionNameGuesser.registerFunctionNameGuesserExtensionPlugin(
    new FunctionNameGuesserPlugin(),
    /* name=*/ 'FunctionNameGuesser',
    /* capabilities=*/['.js', '.jsx']
);