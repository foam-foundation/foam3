; FOAM model definitions: foam.CLASS, foam.ENUM, foam.INTERFACE
(call_expression
  function: (member_expression
    object: (identifier) @_obj
    property: (property_identifier) @context)
  arguments: (arguments
    (object
      (pair
        key: (property_identifier) @_key
        value: (string (string_fragment) @name))))
  (#eq? @_obj "foam")
  (#eq? @_key "name")) @item

; extends key with its value
(pair
  key: (property_identifier) @context
  value: (string (string_fragment) @name)
  (#eq? @context "extends")) @item

; Axiom sections: properties, methods, actions, etc.
(pair
  key: (property_identifier) @name
  value: (array)
  (#any-of? @name
    "properties" "methods" "actions" "listeners"
    "requires" "imports" "exports" "implements"
    "topics" "constants" "classes" "enums"
    "axioms" "mixins" "static" "reactions"
    "templates" "values" "sections")) @item

; Named items inside axiom arrays (each object with a name property)
(pair
  key: (property_identifier) @_section
  value: (array
    (object
      (pair
        key: (property_identifier) @_key
        value: (string (string_fragment) @name))) @item)
  (#any-of? @_section
    "properties" "methods" "actions" "listeners"
    "constants" "classes" "enums" "mixins"
    "static" "reactions" "templates" "values"
    "sections")
  (#eq? @_key "name"))

; String items inside requires, imports, exports, implements arrays
(pair
  key: (property_identifier) @_section
  value: (array
    (string (string_fragment) @name) @item)
  (#any-of? @_section "requires" "imports" "exports" "implements" "mixins"))

; Function-style methods: function foo() {} inside arrays
(pair
  key: (property_identifier) @_section
  value: (array
    (function_expression
      name: (identifier) @name) @item)
  (#any-of? @_section "methods" "listeners" "actions" "static"))
