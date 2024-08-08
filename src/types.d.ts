import { SourceMapEntry, UnminificationMode } from "./DevToolsPlugin";
import { FunctionDescriptor } from "./FunctionDescriptor";

declare global {
  /** Use the chrome.devtools.FunctionNameGuesser API in DevTools. */
  namespace chrome.devtools.functionNameGuesser {
    interface FunctionNameGuesserExtensionPlugin {
      /**
       * Returns function Descriptors for given source file.
       */
      getFunctionRanges(fileName: string, sourceContent: string, sourceMap?: SourceMapEntry, unminificationMode?: UnminificationMode ): FunctionDescriptor[];
    }

    /**
     * Registers a FunctionNameGuesser extension plugin.
     * @param plugin An instance implementing the `FunctionNameGuesserExtensionPlugin` interface.
     * @param [name] The name of the plugin.
     * @param [capabilities] The file types that the plugin can parse.
     */
    function registerFunctionNameGuesserExtensionPlugin(
      plugin: FunctionNameGuesserExtensionPlugin,
      name: string,
      capabilities: string[],
    ): void
  }
}

export {};
