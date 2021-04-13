import * as path from "path";
import * as fs from "fs/promises";

import { Waface } from "../src/index";

export async function demo() {
  const wasmPath = path.join(__dirname, "scanf.wasm");
  const wasm = await fs.readFile(wasmPath);

  const asmLibraryArgs = [
    { key: "c", value: "_emscripten_memcpy_big" },
    { key: "d", value: "_emscripten_resize_heap" },
    { key: "f", value: "_fd_close" },
    { key: "e", value: "_fd_read" },
    { key: "b", value: "_fd_seek" },
    { key: "a", value: "_fd_write" },
  ];

  const app = new Waface();
  app.set("asmLibraryArg", asmLibraryArgs);

  await app.init(wasm);
}
process.env.debug = "true";

demo();
