/**
 * Represents a function in a source file.
 * A function is represented by a name, and start and end coordinates.
 */
export class FunctionDescriptor {
  constructor(
      readonly nameAsFunction: string,
      readonly startLine: number,
      readonly startColumn: number,
      readonly endLine: number,
      readonly endColumn: number,
      readonly nameAsObject?: string,
      /**
       * TODO: consolidate nameAsObject and nameAFunction in to anme and have type param
       * {
        // ... ranges
        name: 'Foo',
        type: 'constructor' -> (memory: class Foo) | (perf: constructor for class Foo) | 'anonymousCallback To' -> name | 'function' -> name
      }
      **/
  ) {
    if (startLine < 0 || startColumn < 0 || endLine < 0 || endColumn < 0) {
      throw new Error(
          `Line and column positions should be positive but were not: startLine=${startLine}, startColumn=${
              startColumn}, endLine=${endLine}, endColumn=${endColumn}`,
      );
    }
    if (startLine > endLine || (startLine === endLine && startColumn > endColumn)) {
      throw new Error(
          `End position should be greater than start position: startLine=${startLine}, startColumn=${
              startColumn}, endLine=${endLine}, endColumn=${endColumn}`,
      );
    }
  }
}