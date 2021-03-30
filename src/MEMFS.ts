/* eslint-disable @typescript-eslint/ban-ts-comment */
import { HEAP } from "./Global";
import { FS } from "./FS";
import { FSNode } from "./FSNode";
import { FSStream } from "./FSStream";
import { abort, logger } from "./utils";

const STACK_ALIGN = 16;

function alignMemory(size: number, factor: number) {
  if (!factor) factor = STACK_ALIGN;
  return Math.ceil(size / factor) * factor;
}

function mmapAlloc(size: number) {
  const alignedSize = alignMemory(size, 16384);
  const ptr = abort();
  logger("ptr::", ptr);

  // @ts-ignore
  while (size < alignedSize) HEAP.HEAP8[ptr + size++] = 0;
  return ptr;
}

export const MEMFS = {
  ops_table: null as any,
  mount: function (_mount: any) {
    return MEMFS.createNode(null, "/", 16384 | 511, 0);
  },
  createNode: function (parent: FSNode, name: string, mode: any, dev: any) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(63);
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink,
          },
          stream: { llseek: MEMFS.stream_ops.llseek },
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync,
          },
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink,
          },
          stream: {},
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
          },
          stream: FS.chrdev_stream_ops,
        },
      };
    }
    const node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node;
      parent.timestamp = node.timestamp;
    }
    return node;
  },
  getFileDataAsTypedArray: function (node: FSNode) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray)
      return node.contents.subarray(0, node.usedBytes);
    return new Uint8Array(node.contents);
  },
  expandFileStorage: function (node: FSNode, newCapacity: any) {
    const prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    const CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(
      newCapacity,
      (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0
    );
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    const oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    if (node.usedBytes > 0)
      node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  resizeFileStorage: function (node: FSNode, newSize: any) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      node.usedBytes = 0;
    } else {
      const oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      if (oldContents) {
        node.contents.set(
          oldContents.subarray(0, Math.min(newSize, node.usedBytes))
        );
      }
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr: function (node: FSNode) {
      const attr = {
        dev: FS.isChrdev(node.mode) ? node.id : 1,
        ino: node.id,
        mode: node.mode,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: node.rdev,
        atime: new Date(node.timestamp),
        mtime: new Date(node.timestamp),
        ctime: new Date(node.timestamp),
        blksize: 4096,
        size: 0,
        blocks: 0,
      };
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      }
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr: function (node: FSNode, attr: any) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode;
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp;
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup: function (_parent: FSNode, _name: string) {
      throw FS.genericErrors[44];
    },
    mknod: function (parent: FSNode, name: string, mode: any, dev: any) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename: function (old_node: FSNode, new_dir: FSNode, new_name: string) {
      if (FS.isDir(old_node.mode)) {
        let new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
          // eslint-disable-next-line no-empty
        } catch (e) {}
        if (new_node) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const _i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
      }
      delete old_node.parent.contents[old_node.name];
      old_node.parent.timestamp = Date.now();
      old_node.name = new_name;
      new_dir.contents[new_name] = old_node;
      new_dir.timestamp = old_node.parent.timestamp;
      old_node.parent = new_dir;
    },
    unlink: function (parent: FSNode, name: string) {
      delete parent.contents[name];
      parent.timestamp = Date.now();
    },
    rmdir: function (parent: FSNode, name: string) {
      const node = FS.lookupNode(parent, name);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.timestamp = Date.now();
    },
    readdir: function (node: FSNode) {
      const entries = [".", ".."];
      for (const key in node.contents) {
        if (!Object.prototype.hasOwnProperty.call(node.contents, key)) {
          continue;
        }
        entries.push(key);
      }
      return entries;
    },
    symlink: function (parent: FSNode, newname: string, oldpath: string) {
      const node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink: function (node: FSNode) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    },
  },

  stream_ops: {
    read: function (
      stream: FSStream,
      buffer: any,
      offset: number,
      length: number,
      position: number
    ) {
      const contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      const size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (let i = 0; i < size; i++)
          buffer[offset + i] = contents[position + i];
      }
      return size;
    },

    write: function (
      stream: FSStream,
      buffer: any,
      offset: number,
      length: number,
      position: number,
      canOwn: boolean
    ) {
      if (!length) return 0;
      const node = stream.node;
      node.timestamp = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (let i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },

    llseek: function (stream: FSStream, offset: number, whence: number) {
      let position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },

    allocate: function (stream: FSStream, offset: number, length: number) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },

    mmap: function (
      stream: FSStream,
      address: any,
      length: number,
      position: number,
      prot: any,
      flags: any
    ) {
      if (address !== 0) {
        throw new FS.ErrnoError(28);
      }
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      let ptr;
      let allocated;
      let contents = stream.node.contents;
      if (!(flags & 2) && contents.buffer === HEAP.buffer) {
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        if (position > 0 || position + length < contents.length) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length);
          } else {
            contents = Array.prototype.slice.call(
              contents,
              position,
              position + length
            );
          }
        }
        allocated = true;
        ptr = mmapAlloc(length);
        // @ts-ignore
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        HEAP.HEAP8.set(contents, ptr);
      }
      return { ptr: ptr, allocated: allocated };
    },

    msync: function (
      stream: FSStream,
      buffer: any,
      offset: number,
      length: number,
      mmapFlags: number
    ) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      if (mmapFlags & 2) {
        return 0;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _bytesWritten = MEMFS.stream_ops.write(
        stream,
        buffer,
        0,
        length,
        offset,
        false
      );
      return 0;
    },
  },
};
