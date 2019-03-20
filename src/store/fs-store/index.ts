import AbstractStore from "../abstract-store";
import FSStoreBase, { FSStoreBaseOptions } from "./base";

export {
  FSStoreBaseOptions
};

class FSStore extends AbstractStore {
  constructor(fs: any, options: FSStoreBaseOptions) {
    super(new FSStoreBase(fs, options));
  }
}

export default FSStore;
