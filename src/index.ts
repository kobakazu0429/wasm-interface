import { CLangRunner } from "./CLangRunner";

// export type Key = "stdout" | "stderr";
// export type InternalModule = { [k in Key]: (args: any) => void } & {
//   initialized: boolean;
// };

export type Key = string;
export type InternalModule = { [k in Key]: (args: any) => void } & {
  initialized: boolean;
  asmLibraryArg: Array<Record<string, string>>;
};

export const waface = () => {
  const internalModule = { initialized: false } as InternalModule;
  const runner = new CLangRunner();

  return {
    set: (key: Key | string, value: any) => {
      internalModule[key] = value;
    },
    init: async (wasmBinary: Buffer) => {
      runner.createWasm(wasmBinary, internalModule["asmLibraryArg"]);
      runner.preRun();
    },
    run: async () => {
      if (internalModule.initialized === false) {
        runner.run();
        internalModule.initialized = true;
      } else {
        runner.callMain();
      }
    },
  };
};
