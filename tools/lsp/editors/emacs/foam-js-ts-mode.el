;;; foam-js-ts-mode.el --- FOAM JavaScript with Java injection -*- lexical-binding: t; -*-

;; Copyright 2026 The FOAM Authors. All Rights Reserved.
;; Licensed under the Apache License, Version 2.0

;; Author: FOAM Authors
;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: languages tree-sitter foam javascript java
;; URL: https://github.com/kgrgreer/foam3

;;; Commentary:

;; Enhanced JavaScript tree-sitter mode that injects Java parsing
;; into backtick-string properties like javaCode:, javaFactory:,
;; javaPreSet:, etc.
;;
;; Requires:
;;   - Emacs 29.1+ with tree-sitter support
;;   - The javascript and java tree-sitter grammars
;;
;; Install grammars (one-time):
;;   M-x treesit-install-language-grammar RET javascript RET
;;   M-x treesit-install-language-grammar RET java RET
;;
;; Usage:
;;   (require 'foam-js-ts-mode)
;;   ;; Auto-activate for FOAM project .js files via .dir-locals.el:
;;   ((js-mode . ((mode . foam-js-ts))))

;;; Code:

(require 'treesit)
(require 'js)

(declare-function treesit-parser-create "treesit.c")

(defgroup foam-js-ts nil
  "FOAM JavaScript tree-sitter mode with Java injection."
  :group 'languages
  :prefix "foam-js-ts-")

(defvar foam-js-ts-mode--java-properties
  '("javaCode" "javaFactory" "javaGetter" "javaSetter"
    "javaPreSet" "javaPostSet" "javaAdapt"
    "javaCompare" "javaComparePropertyToObject" "javaComparePropertyToValue"
    "javaCloneProperty" "javaDiffProperty"
    "javaFormatJSON" "javaJSONParser" "javaCSVParser" "javaQueryParser"
    "javaToCSV" "javaToCSVLabel" "javaFromCSVLabelMapping"
    "javaAssertValue" "javaValidateObj"
    "javaCondition" "javaValue" "javaImports"
    "javaThrows" "javaGenerate" "javaInfoType" "javaType"
    "code" "serviceScript")
  "FOAM property names whose template-string values contain Java code.")

(defvar foam-js-ts-mode--java-property-regexp
  (concat "\\`" (regexp-opt foam-js-ts-mode--java-properties) "\\'")
  "Regexp matching FOAM Java property names.")

(defun foam-js-ts-mode--range-settings ()
  "Build range settings for Java injection.  Only if Java grammar available."
  (when (and (treesit-available-p)
             (treesit-language-available-p 'java t))
    (treesit-range-rules
     :embed 'java
     :host 'javascript
     :local t
     :offset '(1 . -1)
     `((pair
        key: (property_identifier) @_name
        value: (template_string) @capture
        (:match ,foam-js-ts-mode--java-property-regexp @_name))))))

(defun foam-js-ts-mode--java-font-lock-rules ()
  "Build Java font-lock rules for embedded code."
  (when (and (treesit-available-p)
             (treesit-language-available-p 'java t))
    (treesit-font-lock-rules
     :language 'java
     :feature 'java-keyword
     '((["abstract" "assert" "break" "case" "catch" "class"
         "continue" "default" "do" "else" "enum" "extends"
         "final" "finally" "for" "if" "implements" "import"
         "instanceof" "interface" "new" "package" "private"
         "protected" "public" "return" "static" "super"
         "switch" "synchronized" "this" "throw" "throws"
         "try" "void" "while"] @font-lock-keyword-face))

     :language 'java
     :feature 'java-type
     '((type_identifier) @font-lock-type-face)

     :language 'java
     :feature 'java-string
     '((string_literal) @font-lock-string-face)

     :language 'java
     :feature 'java-comment
     '((line_comment) @font-lock-comment-face
       (block_comment) @font-lock-comment-face)

     :language 'java
     :feature 'java-constant
     '([(true) (false) (null_literal)] @font-lock-constant-face)

     :language 'java
     :feature 'java-number
     '([(decimal_integer_literal)
        (hex_integer_literal)
        (decimal_floating_point_literal)] @font-lock-number-face))))

;;;###autoload
(define-derived-mode foam-js-ts-mode js-ts-mode "FOAM-JS"
  "Major mode for FOAM JavaScript files with embedded Java in backtick strings."
  :group 'foam-js-ts

  (when (treesit-language-available-p 'java t)
    (let ((java-rules (foam-js-ts-mode--java-font-lock-rules))
          (range-rules (foam-js-ts-mode--range-settings)))
      (when range-rules
        (setq-local treesit-range-settings range-rules))
      (when java-rules
        (setq-local treesit-font-lock-settings
                    (append treesit-font-lock-settings java-rules))
        (setq-local treesit-font-lock-feature-list
                    (append treesit-font-lock-feature-list
                            '((java-keyword java-type java-string
                               java-comment java-constant java-number)))))))

  (treesit-major-mode-setup))

;;;###autoload
(defun foam-js-ts-mode-install-grammars ()
  "Install both javascript and java tree-sitter grammars."
  (interactive)
  (dolist (lang '(javascript java))
    (unless (treesit-language-available-p lang)
      (treesit-install-language-grammar lang))))

(provide 'foam-js-ts-mode)
;;; foam-js-ts-mode.el ends here
