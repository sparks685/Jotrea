"use strict";

let implementationPromise;

module.exports = function validateReviewerCode(request, response) {
  implementationPromise ??= import(
    "../artifacts/jotrea/server/validate-reviewer-code.js"
  );

  return implementationPromise.then(({ default: handler }) =>
    handler(request, response),
  );
};