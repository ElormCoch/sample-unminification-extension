/**
 * Represents a function in a source file.
 * A function is represented by a name, and start and end coordinates.
 */
export class FunctionDescriptor {
  constructor(
      readonly name: string,
      readonly startLine: number,
      readonly startColumn: number,
      readonly endLine: number,
      readonly endColumn: number,
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