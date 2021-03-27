import { FS } from "./FS";

const readMode = 292 | 73;
const writeMode = 146;

export class FSNode {
  constructor(parent: FSNode | null, name: string, mode: number, rdev: number) {
    if (!parent) {
      parent = this;
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
  }

  public parent: FSNode;
  public mount: any;
  public mounted: any;
  public id: any;
  public name: string;
  public mode: number;
  public node_ops: any;
  public stream_ops: any;
  public rdev: number;
  public contents: any;
  public usedBytes: number;
  public timestamp: number;
  public link: any;

  public get read(): boolean {
    return (this.mode & readMode) === readMode;
  }
  public set read(val: boolean) {
    val ? (this.mode |= readMode) : (this.mode &= ~readMode);
  }

  public get write() {
    return (this.mode & writeMode) === writeMode;
  }
  public set write(val: boolean) {
    val ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
  }

  public get isFolder() {
    return FS.isDir(this.mode);
  }

  public get isDevice() {
    return FS.isChrdev(this.mode);
  }
}
