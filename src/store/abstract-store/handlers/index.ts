import handleAllow from "./allow";
import handleCopy from "./copy";
import handleDelete from "./delete";
import handleGet from "./get";
import handleOptions from "./options";
import handlePatch from "./patch";
import handlePost from "./post";
import handlePut from "./put";

export default {
  allow: handleAllow,
  copy: handleCopy,
  delete: handleDelete,
  get: handleGet,
  options: handleOptions,
  patch: handlePatch,
  post: handlePost,
  put: handlePut
};
