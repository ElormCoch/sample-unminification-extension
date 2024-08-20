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
  }
}

export default class FunctionNameGuesserPlugin implements chrome.devtools.functionNameGuesser.FunctionNameGuesserExtensionPlugin {
    getFunctionRanges(fileName: string, sourceContent: string): FunctionDescriptor[] {  
      return parse(fileName, sourceContent,);
    }
}

function parse(fileName: string, source: string,) {
    const markName = `parsing: ${fileName}`;
    const endMarkName = `${markName}-end`;
    performance.mark(markName);
    const kind = getFileType(fileName);
    const tsSource = tsc.createSourceFile(fileName, source, tsc.ScriptTarget.ESNext, /* setParentNodes: */ true, kind);
    const result = visitRoot(tsSource, fileName);
    performance.mark(endMarkName);
    performance.measure(fileName, markName, endMarkName);
    return result;
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
    source: ts.SourceFile, fileName: string): FunctionDescriptor[] {
  const accumulator: FunctionDescriptor[] = [];

  const name = `globalCode: ${fileName}`;
  accumulator.push(createDescriptor(name, source, source));

  for (const child of source.getChildren()) {
    visitNodeIterative(accumulator, child, source);
  }

  return accumulator;
}

function visitNodeIterative(
    dest: FunctionDescriptor[], node: ts.Node, source: ts.SourceFile): void {
  if (tsc.isFunctionDeclaration(node) || tsc.isFunctionExpression(node) || tsc.isMethodDeclaration(node) ||
      tsc.isArrowFunction(node) || tsc.isConstructorDeclaration(node) || tsc.isGetAccessor(node) ||
      tsc.isGetAccessorDeclaration(node) || tsc.isSetAccessor(node) || tsc.isSetAccessorDeclaration(node)) {
    visitFunctionNodeImpl(dest, node, source);
  }

  for (const child of node.getChildren()) {
    visitNodeIterative(dest, child, source);
  }
}

async function loadTypeScript() {
  const mod = await import('typescript');
  if (!mod.default) {
    throw new ReferenceError('Enhanced DevTools were not available.');
  }
  return mod.default;
}

export interface ResolvedNames {
  nameAsFunction: string,
  nameAsObject?: string,
}

function visitFunctionNodeImpl(
    dest: FunctionDescriptor[], node: ts.FunctionLikeDeclaration, source: ts.SourceFile,): void {
if (node.body) {
    const {nameAsFunction, nameAsObject} = getNamesForFunctionLikeDeclaration(node);
    const descriptor = createDescriptor(nameAsFunction, node, source, nameAsObject);
    dest.push(descriptor);
  }
}


function createDescriptor(nameAsFunction: string, range: ts.TextRange, source: ts.SourceFile, nameAsObject?: string) {
  const {pos, end} = range;
  const {line: startLine, character: startColumn} = source.getLineAndCharacterOfPosition(pos);
  const {line: endLine, character: endColumn} = source.getLineAndCharacterOfPosition(end);

  return new FunctionDescriptor(nameAsFunction, startLine, startColumn, endLine, endColumn, nameAsObject);
}

function getNamesForFunctionLikeDeclaration(func: ts.FunctionLikeDeclaration): ResolvedNames {
  let nameAsFunction = 'anonymousFunction';
  let nameAsObject;
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
    nameAsFunction = getNameOfNameNode(nameNode, func, nameAsFunction);
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
      nameAsFunction =  `constructorCall:, ${className}`;
      nameAsObject = `constructorCall:, ${className}`; 
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
          nameAsFunction = getNameOfNameNode(parent.name, func, nameAsFunction);
        }
      } else if (tsc.isBinaryExpression(parent) && parent.operatorToken.kind === tsc.SyntaxKind.EqualsToken) {
        if (tsc.isPropertyAccessExpression(parent.left) || tsc.isElementAccessExpression(parent.left)) {
          nameAsFunction = recursivelyGetPropertyAccessName(parent.left);
        } else if (
            tsc.isIdentifier(parent.left) || tsc.isStringLiteral(parent.left) || tsc.isNumericLiteral(parent.left)) {
          nameAsFunction = parent.left.text;
        }
        // else unknown
      } else if (tsc.isCallOrNewExpression(func.parent) || tsc.isDecorator(func.parent)) {
        let parentExpressionName = recursivelyGetPropertyAccessName(func.parent.expression);
        if (tsc.isNewExpression(func.parent)) {
          // Localization is not required: this is a programming expression ("new Foo")
          parentExpressionName = `new ${parentExpressionName}`;
        }
        nameAsFunction = `anonymousCallbackTo: ${parentExpressionName}`;
      }
    }
  }
  if (!nameAsObject) {
    nameAsObject = nameAsFunction;
  }
  return {nameAsFunction, nameAsObject};
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