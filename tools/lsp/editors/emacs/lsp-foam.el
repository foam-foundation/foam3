;;; lsp-foam.el --- LSP client for FOAM3 framework  -*- lexical-binding: t; -*-

;; Copyright 2026 The FOAM Authors. All Rights Reserved.
;; Licensed under the Apache License, Version 2.0

;; Author: FOAM Authors
;; Version: 0.1.0
;; Package-Requires: ((emacs "27.1") (lsp-mode "8.0.0"))
;; Keywords: languages lsp foam
;; URL: https://github.com/kgrgreer/foam3

;;; Commentary:

;; LSP client for the FOAM3 modeling framework.
;; Provides code intelligence for foam.CLASS, foam.ENUM, and foam.INTERFACE
;; definitions via the FOAM Language Server.
;;
;; The FOAM LSP server provides:
;;   - Autocomplete (property types, class names, this. members)
;;   - Hover (class docs, method signatures, property types)
;;   - Go-to-definition (class source files, type definitions)
;;   - Diagnostics (unknown classes, wrong types, Java import validation)
;;   - Document symbols, workspace symbols, find references
;;   - Semantic tokens, code actions, folding ranges
;;   - JRL (FOAM Journal) file support
;;
;; Usage with lsp-mode:
;;   (require 'lsp-foam)
;;   (add-hook 'js-mode-hook #'lsp-deferred)
;;
;; Usage with eglot (no package needed):
;;   (with-eval-after-load 'eglot
;;     (add-to-list 'eglot-server-programs
;;                  '((js-mode js-ts-mode) . ("node" "foam3/tools/lsp-start.js"))))

;;; Code:

(require 'lsp-mode)

(defgroup lsp-foam nil
  "LSP support for FOAM3."
  :group 'lsp-mode
  :link '(url-link "https://github.com/kgrgreer/foam3")
  :tag "FOAM3 LSP")

(defcustom lsp-foam-server-command '("node" "foam3/tools/lsp-start.js")
  "Command to start the FOAM LSP server.
The server must be started from the FOAM project root (the directory
containing pom.js).  Adjust this if your project layout differs."
  :type '(repeat string)
  :group 'lsp-foam)

(defcustom lsp-foam-server-args '()
  "Extra arguments passed to the FOAM LSP server.
The first extra argument is the POM path (defaults to \"pom\" in cwd)."
  :type '(repeat string)
  :group 'lsp-foam)

(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection
                   (lambda ()
                     (append lsp-foam-server-command lsp-foam-server-args)))
  :activation-fn (lsp-activate-on "javascript")
  :server-id 'foam-lsp
  :priority -1
  :initialized-fn (lambda (_workspace)
                    (message "FOAM LSP: ready"))))

(lsp-consistency-check lsp-foam)

(provide 'lsp-foam)
;;; lsp-foam.el ends here
