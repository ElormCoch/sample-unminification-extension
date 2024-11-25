import { FunctionDescriptor } from "./FunctionDescriptor";

declare global {
  /** Use the chrome.devtools.languageServices API in DevTools. */
  namespace chrome.devtools.languageServices {
    function addFunctionNameRangesForScript(scriptUrl: string, ranges : FunctionDescriptor[]): Promise<void>;
  }
}

export { };
