#!/usr/bin/env bash
# Install FOAM LSP editor integration.
#
# Usage:
#   ./install.sh              # auto-detect editors and prompt
#   ./install.sh vscode       # install VS Code extension
#   ./install.sh emacs        # install Emacs lsp-foam.el
#   ./install.sh zed          # install Zed dev extension
#   ./install.sh all          # install all detected editors
#   ./install.sh --help       # show this help
#
# Can also be invoked via the build system:
#   ./build.sh lsp-install
#   ./build.sh lsp-install:vscode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDITORS_DIR="$SCRIPT_DIR/editors"

# Colors (if terminal supports them)
if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[32m'
  YELLOW='\033[33m'
  CYAN='\033[36m'
  RESET='\033[0m'
else
  BOLD='' GREEN='' YELLOW='' CYAN='' RESET=''
fi

show_help() {
  echo -e "${BOLD}FOAM LSP — Editor Integration Installer${RESET}"
  echo ""
  echo "Usage:"
  echo "  $0 [editor]         Install for a specific editor"
  echo "  $0 all              Install for all detected editors"
  echo "  $0                  Auto-detect and prompt"
  echo ""
  echo "Editors:"
  echo "  vscode              VS Code (builds .vsix and installs)"
  echo "  emacs               Emacs (eglot + lsp-mode)"
  echo "  zed                 Zed IDE (dev extension)"
  echo ""
  echo "Build system:"
  echo "  ./build.sh lsp-install              Same as $0"
  echo "  ./build.sh lsp-install:vscode       Same as $0 vscode"
}

detect_editors() {
  local found=()
  if command -v code &>/dev/null; then found+=("vscode"); fi
  if command -v emacs &>/dev/null; then found+=("emacs"); fi
  if command -v zed &>/dev/null; then found+=("zed"); fi
  echo "${found[@]}"
}

install_vscode() {
  echo -e "${CYAN}==> VS Code${RESET}"
  if [ ! -d "$EDITORS_DIR/vscode" ]; then
    echo "ERROR: VS Code extension not found at $EDITORS_DIR/vscode"
    return 1
  fi
  (cd "$EDITORS_DIR/vscode" && ./install.sh)
}

install_emacs() {
  echo -e "${CYAN}==> Emacs${RESET}"
  if [ ! -d "$EDITORS_DIR/emacs" ]; then
    echo "ERROR: Emacs integration not found at $EDITORS_DIR/emacs"
    return 1
  fi
  (cd "$EDITORS_DIR/emacs" && ./install.sh)
}

install_zed() {
  echo -e "${CYAN}==> Zed${RESET}"
  if [ ! -d "$EDITORS_DIR/zed-foam3" ]; then
    echo "ERROR: Zed extension not found at $EDITORS_DIR/zed-foam3"
    return 1
  fi
  (cd "$EDITORS_DIR/zed-foam3" && ./install.sh)
}

install_editor() {
  case "$1" in
    vscode|vs-code|code)  install_vscode ;;
    emacs)                install_emacs ;;
    zed)                  install_zed ;;
    *)
      echo "Unknown editor: $1"
      echo "Available: vscode, emacs, zed"
      return 1
      ;;
  esac
}

# Main
case "${1:-}" in
  --help|-h|help)
    show_help
    exit 0
    ;;
  all)
    echo -e "${BOLD}FOAM LSP — Installing for all detected editors${RESET}"
    echo ""
    detected=$(detect_editors)
    if [ -z "$detected" ]; then
      echo "No supported editors detected in PATH."
      echo "Supported: code (VS Code), emacs, zed"
      exit 1
    fi
    for editor in $detected; do
      echo ""
      install_editor "$editor"
    done
    echo ""
    echo -e "${GREEN}Done.${RESET}"
    ;;
  "")
    echo -e "${BOLD}FOAM LSP — Editor Integration Installer${RESET}"
    echo ""
    detected=$(detect_editors)
    if [ -z "$detected" ]; then
      echo "No supported editors detected in PATH."
      echo "Supported: code (VS Code), emacs, zed"
      echo ""
      echo "Run with a specific editor: $0 vscode"
      exit 1
    fi
    echo "Detected editors: $detected"
    echo ""
    echo "Which editor do you want to set up?"
    echo ""
    i=1
    for editor in $detected; do
      echo "  $i) $editor"
      i=$((i + 1))
    done
    echo "  a) all"
    echo "  q) quit"
    echo ""
    read -rp "Choice: " choice
    case "$choice" in
      q|Q) exit 0 ;;
      a|A)
        for editor in $detected; do
          echo ""
          install_editor "$editor"
        done
        ;;
      *)
        # Support both number and name
        if [[ "$choice" =~ ^[0-9]+$ ]]; then
          arr=($detected)
          idx=$((choice - 1))
          if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#arr[@]}" ]; then
            echo ""
            install_editor "${arr[$idx]}"
          else
            echo "Invalid choice: $choice"
            exit 1
          fi
        else
          echo ""
          install_editor "$choice"
        fi
        ;;
    esac
    echo ""
    echo -e "${GREEN}Done.${RESET}"
    ;;
  *)
    install_editor "$1"
    echo ""
    echo -e "${GREEN}Done.${RESET}"
    ;;
esac
