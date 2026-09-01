; Journal entries: p({...}), r({...}), etc.
(entry
  body: (object) @function.inside) @function.around

; Prefixed entries: daoName.p({...})
(prefixed_entry
  (entry
    body: (object) @function.inside)) @function.around

; Comments
(comment) @comment.around
