/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Slice 1 registers only the Elements sidebar pane. The main FOAM panel
// (chrome.devtools.panels.create) arrives with the card in slice 2.
chrome.devtools.panels.elements.createSidebarPane('FOAM', function(pane) {
  pane.setPage('sidebar.html');
});
