;;; foam-jrl-ts-mode.el --- Tree-sitter mode for FOAM Journal files  -*- lexical-binding: t; -*-

;; Copyright 2026 The FOAM Authors. All Rights Reserved.
;; Licensed under the Apache License, Version 2.0

;; Author: FOAM Authors
;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: languages tree-sitter foam
;; URL: https://github.com/kgrgreer/foam3

;;; Commentary:

;; Major mode for FOAM Journal (.jrl) files using tree-sitter.
;; Provides syntax highlighting for p/c/r/v commands, property keys,
;; string values, numbers, class references, and template variables.
;;
;; Requires the `foam_journal` tree-sitter grammar.
;; Install it with: M-x foam-jrl-ts-install-grammar
;;
;; Usage:
;;   (require 'foam-jrl-ts-mode)
;;   ;; .jrl files automatically use this mode if tree-sitter is available

;;; Code:

(require 'treesit)

(defgroup foam-jrl nil
  "FOAM Journal tree-sitter mode."
  :group 'languages
  :prefix "foam-jrl-")

(defvar foam-jrl-ts--grammar-source
  '(foam_journal "https://github.com/ajeetgill/foam-journal-syntax-zed"
                 nil "grammars/tree-sitter-foam-journal/src")
  "Tree-sitter grammar source for FOAM Journal.")

;;;###autoload
(defun foam-jrl-ts-install-grammar ()
  "Install the tree-sitter grammar for FOAM Journal files."
  (interactive)
  (let ((treesit-language-source-alist (list foam-jrl-ts--grammar-source)))
    (treesit-install-language-grammar 'foam_journal)))

(defvar foam-jrl-ts--font-lock-rules
  '(;; Comments
    :language foam_journal
    :feature comment
    ((comment) @font-lock-comment-face)

    ;; Commands: p=blue, r=red, c=green, v=yellow
    :language foam_journal
    :feature keyword
    (((command) @font-lock-function-name-face
      (:equal @font-lock-function-name-face "p"))
     ((command) @font-lock-warning-face
      (:equal @font-lock-warning-face "r"))
     ((command) @font-lock-type-face
      (:equal @font-lock-type-face "c"))
     ((command) @font-lock-variable-use-face
      (:equal @font-lock-variable-use-face "v")))

    ;; "class" key with value as type
    :language foam_journal
    :feature type
    :override t
    ((pair
      key: (key (identifier) @font-lock-builtin-face
                (:equal @font-lock-builtin-face "class"))
      value: (string (string_content) @font-lock-type-face))
     (pair
      key: (key (string (string_content) @font-lock-builtin-face
                        (:equal @font-lock-builtin-face "class")))
      value: (string (string_content) @font-lock-type-face)))

    ;; "id" and "name" keys with special values
    :language foam_journal
    :feature type
    :override t
    ((pair
      key: (key (identifier) @font-lock-builtin-face
                (:match "\\`\\(id\\|name\\)\\'" @font-lock-builtin-face))
      value: (string (string_content) @font-lock-constant-face))
     (pair
      key: (key (string (string_content) @font-lock-builtin-face
                        (:match "\\`\\(id\\|name\\)\\'" @font-lock-builtin-face)))
      value: (string (string_content) @font-lock-constant-face)))

    ;; Property keys (unquoted)
    :language foam_journal
    :feature property
    ((pair key: (key (identifier) @font-lock-property-name-face)))

    ;; Property keys (quoted)
    :language foam_journal
    :feature property
    ((pair key: (key (string (string_content) @font-lock-property-name-face))))

    ;; Strings
    :language foam_journal
    :feature string
    ([(string) (single_string) (triple_string) (backtick_string)]
     @font-lock-string-face)

    ;; Numbers
    :language foam_journal
    :feature number
    ((number) @font-lock-number-face)

    ;; Boolean and null
    :language foam_journal
    :feature constant
    ([(true) (false) (null)] @font-lock-constant-face)

    ;; Escape sequences
    :language foam_journal
    :feature escape
    ((escape_sequence) @font-lock-escape-face)

    ;; Template variables: {varName}
    :language foam_journal
    :feature variable
    ((template_variable) @font-lock-variable-use-face)

    ;; DAO prefix
    :language foam_journal
    :feature variable
    ((prefixed_entry dao: (identifier) @font-lock-variable-name-face))

    ;; Brackets and punctuation
    :language foam_journal
    :feature bracket
    (["(" ")" "{" "}" "[" "]"] @font-lock-bracket-face)

    :language foam_journal
    :feature delimiter
    ([":" "," "."] @font-lock-delimiter-face))
  "Tree-sitter font-lock rules for FOAM Journal.")

;;;###autoload
(define-derived-mode foam-jrl-ts-mode prog-mode "FOAM-JRL"
  "Major mode for editing FOAM Journal files, powered by tree-sitter."
  :group 'foam-jrl
  :syntax-table (let ((st (make-syntax-table)))
                  (modify-syntax-entry ?/ ". 12" st)
                  (modify-syntax-entry ?\n ">" st)
                  (modify-syntax-entry ?\" "\"" st)
                  (modify-syntax-entry ?' "\"" st)
                  st)

  (unless (treesit-ready-p 'foam_journal t)
    (error "Tree-sitter grammar for `foam_journal' is not installed.
Run M-x foam-jrl-ts-install-grammar to install it"))

  (setq-local treesit-font-lock-settings
              (apply #'treesit-font-lock-rules foam-jrl-ts--font-lock-rules))

  (setq-local treesit-font-lock-feature-list
              '((comment)
                (keyword type)
                (property string number constant variable)
                (escape bracket delimiter)))

  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local indent-tabs-mode nil)
  (setq-local tab-width 2)

  (treesit-major-mode-setup))

;; Auto-mode association
;;;###autoload
(when (treesit-available-p)
  (add-to-list 'auto-mode-alist '("\\.jrl\\'" . foam-jrl-ts-mode)))

(provide 'foam-jrl-ts-mode)
;;; foam-jrl-ts-mode.el ends here
