; ============================================================
; FOAM Journal — Language Injections
; Injects Java highlighting into journal entry string values
; ============================================================

; --- Java injection for triple-quoted strings (quoted keys) ---

(pair
  key: (key (string (string_content) @_key))
  value: (triple_string (triple_string_content) @injection.content)
  (#any-of? @_key
    "javaCode" "javaFactory"
    "javaGetter" "javaSetter"
    "javaPreSet" "javaPostSet"
    "javaAdapt" "javaCompare"
    "javaComparePropertyToObject" "javaComparePropertyToValue"
    "javaCloneProperty" "javaDiffProperty"
    "javaFormatJSON" "javaJSONParser"
    "javaCSVParser" "javaQueryParser"
    "javaToCSV" "javaToCSVLabel"
    "javaFromCSVLabelMapping"
    "javaAssertValue" "javaValidateObj"
    "javaCondition" "javaValue"
    "javaImports"
    "code" "serviceScript")
  (#set! injection.language "java"))

; --- Java injection for triple-quoted strings (unquoted keys) ---

(pair
  key: (key (identifier) @_key)
  value: (triple_string (triple_string_content) @injection.content)
  (#any-of? @_key
    "javaCode" "javaFactory"
    "javaGetter" "javaSetter"
    "javaPreSet" "javaPostSet"
    "javaAdapt" "javaCompare"
    "javaComparePropertyToObject" "javaComparePropertyToValue"
    "javaCloneProperty" "javaDiffProperty"
    "javaFormatJSON" "javaJSONParser"
    "javaCSVParser" "javaQueryParser"
    "javaToCSV" "javaToCSVLabel"
    "javaFromCSVLabelMapping"
    "javaAssertValue" "javaValidateObj"
    "javaCondition" "javaValue"
    "javaImports"
    "code" "serviceScript")
  (#set! injection.language "java"))

; --- Java injection for backtick strings (quoted keys) ---

(pair
  key: (key (string (string_content) @_key))
  value: (backtick_string (backtick_string_content) @injection.content)
  (#any-of? @_key
    "javaCode" "javaFactory"
    "javaGetter" "javaSetter"
    "javaPreSet" "javaPostSet"
    "javaAdapt" "javaCompare"
    "javaComparePropertyToObject" "javaComparePropertyToValue"
    "javaCloneProperty" "javaDiffProperty"
    "javaFormatJSON" "javaJSONParser"
    "javaCSVParser" "javaQueryParser"
    "javaToCSV" "javaToCSVLabel"
    "javaFromCSVLabelMapping"
    "javaAssertValue" "javaValidateObj"
    "javaCondition" "javaValue"
    "javaImports"
    "code" "serviceScript")
  (#set! injection.language "java"))

; --- Java injection for backtick strings (unquoted keys) ---

(pair
  key: (key (identifier) @_key)
  value: (backtick_string (backtick_string_content) @injection.content)
  (#any-of? @_key
    "javaCode" "javaFactory"
    "javaGetter" "javaSetter"
    "javaPreSet" "javaPostSet"
    "javaAdapt" "javaCompare"
    "javaComparePropertyToObject" "javaComparePropertyToValue"
    "javaCloneProperty" "javaDiffProperty"
    "javaFormatJSON" "javaJSONParser"
    "javaCSVParser" "javaQueryParser"
    "javaToCSV" "javaToCSVLabel"
    "javaFromCSVLabelMapping"
    "javaAssertValue" "javaValidateObj"
    "javaCondition" "javaValue"
    "javaImports"
    "code" "serviceScript")
  (#set! injection.language "java"))

; ============================================================
; JSON injection for `client` values — nested FObject specs
; are authored as JSON literals inside triple-quoted or
; backtick-delimited strings.
; ============================================================

; --- JSON injection for triple-quoted strings (quoted keys) ---

(pair
  key: (key (string (string_content) @_key))
  value: (triple_string (triple_string_content) @injection.content)
  (#eq? @_key "client")
  (#set! injection.language "json"))

; --- JSON injection for triple-quoted strings (unquoted keys) ---

(pair
  key: (key (identifier) @_key)
  value: (triple_string (triple_string_content) @injection.content)
  (#eq? @_key "client")
  (#set! injection.language "json"))

; --- JSON injection for backtick strings (quoted keys) ---

(pair
  key: (key (string (string_content) @_key))
  value: (backtick_string (backtick_string_content) @injection.content)
  (#eq? @_key "client")
  (#set! injection.language "json"))

; --- JSON injection for backtick strings (unquoted keys) ---

(pair
  key: (key (identifier) @_key)
  value: (backtick_string (backtick_string_content) @injection.content)
  (#eq? @_key "client")
  (#set! injection.language "json"))
