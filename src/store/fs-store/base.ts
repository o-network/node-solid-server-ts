import AbstractStore, { AbstractStoreOptions } from "../abstract-store";
import { ReadStream, WriteStream } from "fs";
import { promisify } from "util";
import RemoveDirectory from "rimraf";
import { mkdirp } from "fs-extra";
import { join, basename } from "path";

export type FSStoreBaseOptions = AbstractStoreOptions & {
  rootPath: string
  includeHost: boolean
};

class FSStoreBase extends AbstractStore {

  private readonly fs: any;
  private readonly fsPromise: any;

  protected readonly rootPath: string;
  protected readonly includeHost: boolean;

  constructor(fs: any, options: FSStoreBaseOptions) {
    super(undefined, options);
    const {
      rootPath,
      includeHost
    } = options;
    this.rootPath = rootPath;
    this.includeHost = includeHost;
    this.fs = fs;
    this.fsPromise = {
      stat: promisify(fs.stat),
      readdir: promisify(fs.readdir),
      readFile: promisify(fs.readFile),
      writeFile: promisify(fs.writeFile),
      unlink: promisify(fs.unlink)
    };
  }

  public async createReadStream(uri: URILike, encoding: string = "utf-8"): Promise<ReadStream> {
    const descriptor = await this.getDescriptor(uri);
    if (descriptor && !descriptor.isFile()) {
      throw new Error("Not a file");
    }
    return this.fs.createReadStream(this.getPathFromUri(uri), { encoding });
  }

  public async createWriteStream(uri: URILike, encoding: string = "utf-8"): Promise<WriteStream> {
    const descriptor = await this.getDescriptor(uri);
    if (descriptor && !descriptor.isFile()) {
      throw new Error("Not a file");
    }
    return this.fs.createWriteStream(this.getPathFromUri(uri), { encoding });
  }

  public async list(uri: URILike): Promise<DocumentDescriptor[]> {
    const descriptor = await this.getDescriptor(uri);
    if (!descriptor || !descriptor.isDirectory()) {
      return [];
    }
    const files = await this.fsPromise.readdir(this.getPathFromUri(uri));
    return Promise.all<DocumentDescriptor>(
      files
        .map((path: string) => this.getJoinedUri(uri, path))
        .map((uri: string) => this.getDescriptor(uri))
    );
  }

  public async get(uri: URILike, encoding: string = "utf-8"): Promise<Uint8Array | string> {
    const descriptor = await this.getDescriptor(uri);
    if (!descriptor || !descriptor.isFile()) {
      throw new Error("Not a file");
    }
    return this.fsPromise.readFile(descriptor, { encoding });
  }

  public async put(uri: URILike, content: Uint8Array | string, encoding: string = "utf-8"): Promise<any> {
    const descriptor = await this.getDescriptor(uri);
    if (descriptor && descriptor.isDirectory()) {
      throw new Error(`${uri} is a directory`);
    }
    await this.ensureDirectoryExists(uri);
    await this.fsPromise.writeFile(descriptor, content, { encoding });
  }

  public async delete(uri: URILike): Promise<any> {
    const descriptor = await this.getDescriptor(uri);
    if (!descriptor) {
      throw new Error("Not found");
    }
    if (descriptor.isDirectory()) {
      await this.deleteDirectory(uri);
    } else if (descriptor.isFile()) {
      await this.fsPromise.unlink(descriptor);
    }
  }

  private async ensureDirectoryExists(uri: URILike): Promise<any> {
    /*
    Its better to get the descriptor here, as mkdirp default is to
    do a mkdir, then do a stat, so lets do one early so we can reduce that one call

    Result is that if the directory doesn't exist, then we will make an extra stat, which
    seems fine since we will be doing "heavy" fs tasks right after anyway
     */
    const descriptor = await this.getDescriptor(uri);
    // Already present
    if (descriptor && descriptor.isDirectory()) {
      return;
    }
    const path = this.getPathFromUri(uri);
    const fn = mkdirp as Function;
    await promisify(fn)(path, {
      fs: this.fs
    });
  }

  private async deleteDirectory(uri: URILike): Promise<any> {
    await promisify(RemoveDirectory)(this.getPathFromUri(uri), this.fs);
  }

  public async getDescriptor(uri: URILike): Promise<DocumentDescriptor> {
    let stat;
    try {
      stat = await this.fsPromise.stat(this.getPathFromUri(uri));
    } catch(err) {
      return undefined;
    }
    if (!stat.isDirectory() && !stat.isFile()) {
      return undefined;
    }
    stat.uri = uri;
    stat.modified = stat.mtime;
    return stat as DocumentDescriptor;
  }

  private getPathFromUri(uri: URILike): string {
    const url = this.getURL(uri);

    const pathParts = [
      this.includeHost && url.hostname,
      url.pathname
    ]
      .filter(value => value);

    return join(this.rootPath, ...pathParts);
  }

}

export default FSStoreBase;
