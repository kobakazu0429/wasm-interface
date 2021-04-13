/* eslint-disable @typescript-eslint/no-empty-function */

import type { StreamOps, Tty } from "./TTY";
import type { FSNode } from "./FSNode";

export class FSStream {
  constructor() {}

  public node: FSNode;
  public flags!: number;
  public fd!: number;
  public stream_ops!: StreamOps;
  public path!: string;
  public seekable!: boolean;
  public position!: number;
  public ungotten!: any[];
  public error!: boolean;
  public getdents!: null;
  public tty: Tty;

  public get object() {
    return this.node;
  }

  public set object(val) {
    this.node = val;
  }

  public get isRead() {
    return (this.flags & 2097155) !== 1;
  }

  public get isWrite() {
    return (this.flags & 2097155) !== 0;
  }

  public get isAppend() {
    return this.flags & 1024;
  }
}
