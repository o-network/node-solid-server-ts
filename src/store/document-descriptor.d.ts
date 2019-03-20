declare type DocumentDescriptor = {
  isFile(): boolean
  isDirectory(): boolean;
  size: number;
  modified: Date;
  uri: string;
};
