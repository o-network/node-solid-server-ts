import Negotiator from "negotiator";
import { URL } from "url";
import RDF_MIME_TYPES from "../rdf-mime-types";
import "isomorphic-fetch";
import $rdf from "rdflib";

const RDFs = [...RDF_MIME_TYPES];

async function getResponseForDirectory(store: Store, negotiator: Negotiator, descriptor: DocumentDescriptor): Promise<Response> {
  const requestedType = negotiator.mediaType();
  const possibleRDFType = negotiator.mediaType(RDFs);



  return undefined;
}

async function getResponseForFile(store: Store, negotiator: Negotiator, descriptor: DocumentDescriptor): Promise<Response> {
  const requestedType = negotiator.mediaType();
  const possibleRDFType = negotiator.mediaType(RDFs);
  return undefined;
}

export default async function(store: Store, request: Request): Promise<Response> {
  const headers: any = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const negotiator = new Negotiator({
    headers
  });

  const response = new Response();

  response.headers.set("MS-Author-Via", "SPARQL");

  if (store.live) {
    const liveUrl = new URL(store.getURL(request.url).toString());
    liveUrl.protocol = "ws:";
    response.headers.set(
      "Updates-Via",
      liveUrl.toString()
    );
  }

  const descriptor = await store.getDescriptor(request.url);

  if (!descriptor) {
    return new Response(undefined, {
      status: 404
    });
  }

  const contentType = store.getContentType(descriptor);

  response.headers.set("Content-Type", contentType);

  // HEAD
  if (request.method !== "GET") {
    return new Response(undefined, {
      ...response,
      status: 200
    });
  }

  if (descriptor.isDirectory()) {
    return getResponseForDirectory(store, negotiator, descriptor);
  } else {
    return getResponseForFile(store, negotiator, descriptor);
  }
}
