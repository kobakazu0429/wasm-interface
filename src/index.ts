import { CLangRunner } from "./CLangRunner";
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
};

export class Waface {
  private internalModule = { initialized: false } as InternalModule;
  private runner = new CLangRunner();

  public async init(wasmBinary: Buffer) {
    if (this.internalModule.stdout) IO.stdout = this.internalModule.stdout;
    if (this.internalModule.stderr) IO.stderr = this.internalModule.stderr;
    if (this.internalModule.stdin) IO.stdin = this.internalModule.stdin;

    this.runner.createWasm(wasmBinary, this.internalModule["asmLibraryArg"]);
    this.runner.preRun();
  }

  public async run() {
    if (this.internalModule.initialized === false) {
      this.runner.run();
      this.internalModule.initialized = true;
    } else {
      this.runner.callMain();
    }
  }

  public set(key: Key, value: any) {
    this.internalModule[key] = value;
  }
}
