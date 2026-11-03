/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'CenteredDashboardCitationView',
  extends: 'foam.dashboard.view.DashboardCitationView',
  css: `
    << {
      align-items: center;
      margin: auto;
      width: 75%;
      height: 100%;
      padding: 0;
    }

    <<id {
      font-size: 1.5rem;
      font-weight: $font-normal;
    }

    <<value {
      font-size: 1.5rem;
      font-weight: $font-normal;
    }
  `
});
