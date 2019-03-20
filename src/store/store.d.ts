declare type URILike = string | DocumentDescriptor | URL;

declare type Store = {

  live: boolean;

  createReadStream(uri: URILike, encoding: string): Promise<any>;
  createWriteStream(uri: URILike, encoding: string): Promise<any>;
  list(uri: URILike): Promise<DocumentDescriptor[]>;
  get(uri: URILike, encoding: string): Promise<Uint8Array | string>;
  put(uri: URILike, content: Uint8Array | string, encoding: string): Promise<any>;
  delete(uri: URILike): Promise<any>;
  getDescriptor(uriLike: URILike): Promise<DocumentDescriptor>;
  handle?(input: RequestInfo, init?: RequestInit): Promise<Response>;
  getContentType(descriptor: DocumentDescriptor): string;

  getURL(uri: URILike): URL;
};
