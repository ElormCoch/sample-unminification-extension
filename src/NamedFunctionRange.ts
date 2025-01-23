/**
 * Represents a function in a source file.
 * A function is represented by a name, and start and end coordinates.
 */

interface Position {
  line: number;
  column: number;
}

export class NamedFunctionRange {
  constructor(
      readonly name: string,
      readonly start: Position,
      readonly end: Position,
  ) {
    if (start.line < 0 || start.column < 0 || end.line < 0 || end.column < 0) {
      throw new Error(
          `Line and column positions should be positive but were not: startLine=${start.line}, startColumn=${
              start.column}, endLine=${end.line}, endColumn=${end.column}`,
      );
    }
    if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
      throw new Error(
          `End position should be greater than start position: startLine=${start.line}, startColumn=${
              start.column}, endLine=${end.line}, endColumn=${end.column}`,
      );
    }
  }
}