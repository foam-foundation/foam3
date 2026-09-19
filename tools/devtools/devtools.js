/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Elements sidebar (view stack) and the main FOAM panel (Why and Tree tabs).
chrome.devtools.panels.elements.createSidebarPane('FOAM', function(pane) {
  pane.setPage('sidebar.html');
});
chrome.devtools.panels.create('FOAM', '', 'panel.html', function() {});
