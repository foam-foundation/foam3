; ============================================================
; FOAM JavaScript — Language Injections
; Injects Java/FOAM CSS highlighting into FOAM model string literals
; ============================================================

; --- Java injection for backtick (template) strings ---

(pair
  key: (property_identifier) @_key
  value: (template_string
    (string_fragment) @injection.content)
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

; --- Java injection for single/double quoted strings ---

(pair
  key: (property_identifier) @_key
  value: (string
    (string_fragment) @injection.content)
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

; --- FOAM CSS injection for backtick strings ---

(pair
  key: (property_identifier) @_key
  value: (template_string
    (string_fragment) @injection.content)
  (#eq? @_key "css")
  (#set! injection.language "FOAM CSS"))
