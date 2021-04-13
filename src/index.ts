import { CLangRunner } from "./CLangRunner";
import type { ArgType } from "./CLangRunner";
import { IO } from "./IO";

// export type PublicKey = "stdout" | "stderr";
// export type PrivateKey = "initialized";
// export type Key = PublicKey | PrivateKey;
// export type InternalModule = { [k in Key]: (args: any) => void } & {
//   initialized: boolean;
// } & {
//   asmLibraryArg: { key: string; value: string }[];
// };

export type Key = string;
export type InternalModule = { [k in Key]: (args: any) => void } & {
  initialized: boolean;
  asmLibraryArg: Array<Record<string, string>>;
  caller: Record<"___wasm_call_ctors" | "_main" | string, string>;
  wasmRuntime: Record<"wasmMemory" | "wasmTable", string>;
};

export class Wasface {
  private internalModule = { initialized: false } as InternalModule;
  private runner = new CLangRunner();

  public async init(wasmBinary: Buffer) {
    if (this.internalModule.stdout) IO.stdout = this.internalModule.stdout;
    if (this.internalModule.stderr) IO.stderr = this.internalModule.stderr;
    if (this.internalModule.debug) IO.debug = this.internalModule.debug;
    if (this.internalModule.stdin) IO.stdin = this.internalModule.stdin;

    await this.runner.createWasm(
      wasmBinary,
      this.internalModule["asmLibraryArg"],
      this.internalModule["wasmRuntime"]
    );
    this.runner.preRun(this.internalModule.caller);
  }

  public async run() {
    if (this.internalModule.initialized === false) {
      this.runner.run();
      this.internalModule.initialized = true;
    } else {
      this.runner.callMain();
    }
  }

  public async runFunction(
    ident: string,
    returnType: ArgType = null,
    argTypes: ArgType[] = null
  ) {
    return (...arg: any[]) =>
      this.runner.cwrap(ident, returnType, argTypes)(...arg);
  }

  public set(key: Key, value: any) {
    this.internalModule[key] = value;
  }
}
