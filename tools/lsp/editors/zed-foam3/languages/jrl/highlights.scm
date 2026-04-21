(ERROR) @error

; Commands: each gets a distinct color
; p (put) — standard function color (blue)
((command) @function
  (#eq? @function "p"))

; r (remove) — keyword color (red/pink)
((command) @keyword
  (#eq? @keyword "r"))

; c (create) — type color (green/teal)
((command) @type
  (#eq? @type "c"))

; v (version) — attribute color (yellow/orange)
((command) @attribute
  (#eq? @attribute "v"))

; Comments
(comment) @comment

; "class" key with its value highlighted as a type
(pair
  key: (key
    (identifier) @property
    (#eq? @property "class"))
  value: (string
    (string_content) @type))

(pair
  key: (key
    (string
      (string_content) @property
      (#eq? @property "class")))
  value: (string
    (string_content) @type))

; "id" and "name" keys with values highlighted specially
(pair
  key: (key
    (identifier) @property
    (#any-of? @property "id" "name"))
  value: (string
    (string_content) @string.special))

(pair
  key: (key
    (string
      (string_content) @property
      (#any-of? @property "id" "name")))
  value: (string
    (string_content) @string.special))

(pair
  key: (key
    (identifier) @property
    (#any-of? @property "id" "name"))
  value: (single_string
    (single_string_content) @string.special))

(pair
  key: (key
    (string
      (string_content) @property
      (#any-of? @property "id" "name")))
  value: (single_string
    (single_string_content) @string.special))

; Unquoted keys (identifiers)
(pair
  key: (key
    (identifier) @property))

; Quoted keys
(pair
  key: (key
    (string
      (string_content) @property)))

; Strings
(string) @string
(single_string) @string

; Triple-quoted strings (embedded code)
(triple_string) @string

; Backtick strings (embedded code)
(backtick_string) @string

; Template variables: {adminUserId}
(template_variable) @variable.special

; Numbers
(number) @number

; Boolean and null constants
(true) @constant.builtin
(false) @constant.builtin
(null) @constant.builtin

; Escape sequences
(escape_sequence) @string.escape

; DAO prefix in routing journals
(prefixed_entry
  dao: (identifier) @variable)

; Punctuation
"(" @punctuation.bracket
")" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
":" @punctuation.delimiter
"," @punctuation.delimiter
"." @punctuation.delimiter
