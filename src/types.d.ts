import { NamedFunctionRange } from "./NamedFunctionRange";

declare global {
  /** Use the chrome.devtools.languageServices API in DevTools. */
  namespace chrome.devtools.languageServices {
    function setFunctionRangesForScript(scriptUrl: string, ranges : NamedFunctionRange[]): Promise<void>;
  }
}

export { };
