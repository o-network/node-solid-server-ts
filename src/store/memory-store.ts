import AbstractStore from "./abstract-store";
import FSStore, { FSStoreBaseOptions } from "./fs-store";
import { fs } from "memfs";

class MemoryStore extends AbstractStore {

  constructor(options: FSStoreBaseOptions) {
    super(new FSStore(fs, options));
  }

}

export default MemoryStore;
