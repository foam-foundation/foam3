; Journal entries: command + class as context, id/name as label
; Each combo written for both orderings (class before/after id/name)

; === Quoted keys, double-quoted values ===

; "class" then "id"
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context))
    (pair key: (key (string (string_content) @_ik)) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; "id" then "class"
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ik)) value: (string (string_content) @name))
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; "class" then "name"
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context))
    (pair key: (key (string (string_content) @_nk)) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_nk "name")) @item
; "name" then "class"
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_nk)) value: (string (string_content) @name))
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context)))
  (#eq? @_nk "name") (#eq? @_ck "class")) @item

; "class" then "id" (numeric)
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context))
    (pair key: (key (string (string_content) @_ik)) value: (number) @name))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; "id" (numeric) then "class"
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ik)) value: (number) @name)
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; === Unquoted keys, double-quoted values ===

; class then id
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context))
    (pair key: (key (identifier) @_ik) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; id then class
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ik) value: (string (string_content) @name))
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; class then name
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context))
    (pair key: (key (identifier) @_nk) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_nk "name")) @item
; name then class
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_nk) value: (string (string_content) @name))
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context)))
  (#eq? @_nk "name") (#eq? @_ck "class")) @item

; class then id (numeric)
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context))
    (pair key: (key (identifier) @_ik) value: (number) @name))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; id (numeric) then class
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ik) value: (number) @name)
    (pair key: (key (identifier) @_ck) value: (string (string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; === Unquoted keys, single-quoted values ===

; class then id
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ck) value: (single_string (single_string_content) @context))
    (pair key: (key (identifier) @_ik) value: (single_string (single_string_content) @name)))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; id then class
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ik) value: (single_string (single_string_content) @name))
    (pair key: (key (identifier) @_ck) value: (single_string (single_string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; class then name
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ck) value: (single_string (single_string_content) @context))
    (pair key: (key (identifier) @_nk) value: (single_string (single_string_content) @name)))
  (#eq? @_ck "class") (#eq? @_nk "name")) @item
; name then class
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_nk) value: (single_string (single_string_content) @name))
    (pair key: (key (identifier) @_ck) value: (single_string (single_string_content) @context)))
  (#eq? @_nk "name") (#eq? @_ck "class")) @item

; === Mixed: quoted class key, unquoted id/name key ===

; "class" then id
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context))
    (pair key: (key (identifier) @_ik) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_ik "id")) @item
; id then "class"
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_ik) value: (string (string_content) @name))
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context)))
  (#eq? @_ik "id") (#eq? @_ck "class")) @item

; "class" then name
(entry command: (command) @context body: (object
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context))
    (pair key: (key (identifier) @_nk) value: (string (string_content) @name)))
  (#eq? @_ck "class") (#eq? @_nk "name")) @item
; name then "class"
(entry command: (command) @context body: (object
    (pair key: (key (identifier) @_nk) value: (string (string_content) @name))
    (pair key: (key (string (string_content) @_ck)) value: (string (string_content) @context)))
  (#eq? @_nk "name") (#eq? @_ck "class")) @item

; === "script" key as nested outline item ===

(pair key: (key (string (string_content) @name)) value: (triple_string)
  (#eq? @name "script")) @item
(pair key: (key (identifier) @name) value: (triple_string)
  (#eq? @name "script")) @item
(pair key: (key (string (string_content) @name)) value: (backtick_string)
  (#eq? @name "script")) @item
(pair key: (key (identifier) @name) value: (backtick_string)
  (#eq? @name "script")) @item
