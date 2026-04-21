; FOAM model definitions (foam.CLASS, foam.ENUM, foam.INTERFACE)
(call_expression
  function: (member_expression
    object: (identifier) @_obj
    (#eq? @_obj "foam"))
  arguments: (arguments
    (object) @function.inside)) @function.around

; Method/property objects inside axiom arrays
(pair
  key: (property_identifier) @_section
  value: (array
    (object) @class.inside)
  (#any-of? @_section
    "properties" "methods" "actions" "listeners"
    "constants" "classes" "enums" "mixins"
    "static" "reactions" "templates" "values"
    "sections")) @class.around

; Function-style methods inside arrays
(pair
  key: (property_identifier) @_section
  value: (array
    (function_expression) @class.inside)
  (#any-of? @_section "methods" "listeners" "actions" "static")) @class.around

; Comments
(comment) @comment.around
