import Handlers from "./handlers";
import "isomorphic-fetch";
import { types, lookup } from "mime-types";
import { basename, extname, dirname } from "path";
import $rdf, { Formula, ValueType } from "rdflib";
import SolidNamespace from "solid-namespace";
import { For } from "@babel/types";

const ns = SolidNamespace($rdf);

export type AbstractStoreOptions = {
  rootUrl: string;
  includeHost: boolean;
  defaultContentType: string;
  indexFileNames?: string[];
  indexFileName?: string;
  overrideTypes: { [key: string]: string };
  live: boolean;
  metaExtension: string;
  aclExtension: string;
};

abstract class AbstractStore implements Store {

  private store: Store;

  public readonly rootUrl: string;

  protected readonly defaultContentType: string;
  protected readonly indexFileNames: string[];
  protected readonly types: { [key: string]: string };

  protected readonly metaExtension: string;
  protected readonly aclExtension: string;

  public readonly live: boolean;

  protected constructor(store: AbstractStore | Store | any, {
    rootUrl,
    defaultContentType = "application/octet-stream",
    overrideTypes = {
      acl: "text/turtle",
      meta: "text/turtle"
    },
    indexFileNames,
    indexFileName,
    live,
    metaExtension,
    aclExtension
  }: AbstractStoreOptions | any = {}) {
    this.store = store;
    this.rootUrl = rootUrl;
    this.defaultContentType = defaultContentType;
    this.types = {
      ...types,
      ...overrideTypes
    };

    this.metaExtension = metaExtension;
    this.aclExtension = aclExtension;

    this.indexFileNames = [];

    this.live = live;

    if (Array.isArray(indexFileNames)) {
      this.indexFileNames = indexFileNames
        .filter(value => value && typeof value === "string");
    }

    if (indexFileName) {
      this.indexFileNames.push(indexFileName);
    }

  }

  public createReadStream(uri: URILike, encoding: string = "utf-8"): Promise<any> {
    return this.store.createReadStream(uri, encoding);
  }

  public createWriteStream(uri: URILike, encoding: string = "utf-8"): Promise<any> {
    return this.store.createWriteStream(uri, encoding);
  }

  public list(uri: URILike): Promise<DocumentDescriptor[]> {
    return this.store.list(uri);
  }

  public get(uri: URILike, encoding: string = "utf-8"): Promise<Uint8Array | string> {
    return this.store.get(uri, encoding);
  }

  public put(uri: URILike, content: Uint8Array | string, encoding: string = "utf-8"): Promise<any> {
    return this.store.put(uri, content, encoding);
  }

  public delete(uri: URILike): Promise<any> {
    return this.store.delete(uri);
  }

  public async getDescriptor(uri: URILike): Promise<DocumentDescriptor> {
    if (typeof uri !== "string" && (uri as DocumentDescriptor).uri) {
      return uri as DocumentDescriptor;
    }
    if (typeof uri !== "string") {
      return this.getDescriptor(uri.toString());
    }
    return this.store.getDescriptor(uri);
  }

  public async handle(input: RequestInfo, init?: RequestInit): Promise<Response> {
    if (this.store.handle) {
      return this.store.handle(input, init);
    }

    const request = new Request(input, init);

    request.headers.forEach((value, key) => {
      (request.headers as any)[key.toLowerCase()] = value;
    });

    const handlers = Handlers as any;
    const handler = handlers[request.method.toLowerCase()] as any;

    if (!(handler && handler instanceof Function)) {
      throw new Error(`Invalid method ${request.method}`);
    }

    return handler(this, request);
  }

  public getContainerURL(uri: URILike): URL {
    const url = this.getURL(uri);
    url.pathname = dirname(url.pathname);
    return url;
  }

  public getURL(uri: URILike): URL {
    const base = typeof uri === "string" ? uri : ((uri as DocumentDescriptor).uri || uri.toString());
    // Absolute path, treat this as a path of the rootUrl
    if (base.indexOf("/") === 0) {
      return new URL(base, this.rootUrl);
    }
    if (base.indexOf("/,,") > -1) {
      throw new Error("Disallowed /.. segment in URL");
    }
    // Anything else should have its own protocol
    return new URL(base);
  }

  public getContentType(descriptor: DocumentDescriptor): string {

    if (descriptor.isDirectory()) {
      return "text/turtle"; // TODO find out a way to change to any accepted type
    }

    const fileName = basename(descriptor.uri);
    const extension = extname(fileName);

  }

  protected getJoinedUri(base: URILike, child: string): string {
    const url = this.getURL(base);
    if (child.indexOf("./") !== 0) {
      throw new Error("Invalid child uri");
    }
    url.pathname = `${url.pathname.replace(/\/$/, "")}${child.substr(1)}`;
    return url.toString();
  }

  public async getContainer(uri: URILike): Promise<Uint8Array | string | any> {
    const containerDescriptor = await this.getDescriptor(uri);
    if (!containerDescriptor.isDirectory()) {
      return undefined;
    }
    const resourceGraph = $rdf.graph();
    await this.addContainerToResource(resourceGraph, containerDescriptor);
    const documents = await this.list(uri);
    await Promise.all(
      documents
        .map(descriptor => this.addDocumentToResource(resourceGraph, descriptor, containerDescriptor))
    );
  }

  private async addContainerToResource(graph: Formula, descriptor: DocumentDescriptor) {
    const url = this.getURL(descriptor),
      urlString = url.toString();

    const containerMeta = (
      await this.get(
        this.getJoinedUri(
          url,
          `./${this.metaExtension}`
        )
      )
        .catch(() => "")
    ) as string;

    const resourceGraph: Formula = await new Promise(
      (resolve, reject) => {
        $rdf.parse(
          containerMeta,
          $rdf.graph(),
          url.toString(),
          "text/turtle",
          (error: any, graph: Formula) => {
            if (error) return reject(error);
            resolve(graph);
          }
        );
      }
    );

    this.addDescriptorsToResource(resourceGraph, descriptor);

    graph.add(
      graph.sym(urlString),
      ns.rdf("type"),
      ns.ldp("BasicContainer"),
      graph
    );

    graph.add(
      graph.sym(urlString),
      ns.rdf("type"),
      ns.ldp("Container"),
      graph
    );
  }

  private async addDocumentToResource(graph: Formula, descriptor: DocumentDescriptor, containerDescriptor: DocumentDescriptor) {
    const url = this.getURL(descriptor),
      extension = extname(url.pathname),
      urlString = url.toString();

    if (extension === this.metaExtension || extension === this.aclExtension) {
      return;
    }

    this.addDescriptorsToResource(graph, descriptor);

  }

  private addDescriptorsToResource(graph: Formula, descriptor: DocumentDescriptor) {
    const url = this.getURL(descriptor),
      urlString = url.toString();
    graph.add(
      graph.sym(urlString),
      ns.stat("mtime"),
      descriptor.modified.getTime() / 1000,
      graph
    );

    graph.add(
      graph.sym(urlString),
      ns.dct("modified"),
      descriptor.modified,
      graph
    );

    graph.add(
      graph.sym(urlString),
      ns.stat("size"),
      descriptor.size,
      graph
    );

    if (!descriptor.isFile()) {
      return;
    }

    const foundType = lookup(basename(url.pathname));

    if (!foundType) {
      return;
    }

    graph.add(
      graph.sym(urlString),
      ns.rdf("type"),
      graph.sym(foundType),
      graph
    );

  }

}

export default AbstractStore;
