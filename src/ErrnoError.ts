import type { FSNode } from "./FSNode";

export class ErrnoError {
  constructor(errno: number, node?: FSNode) {
    this.node = node;
    this.message = "FS error";
    this.setErrno(errno);
  }

  public stack?: string;

  private node: FSNode | undefined;
  private message: string;
  private errno?: number;

  private setErrno(errno: number) {
    this.errno = errno;
  }
}
