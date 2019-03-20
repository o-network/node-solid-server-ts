declare module "solid-namespace" {

  import { ValueType } from "rdflib";

  export default function (...args: any[]): { [key: string]: (key: string) => ValueType };

}
