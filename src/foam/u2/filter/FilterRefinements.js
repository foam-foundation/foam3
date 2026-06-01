/**
* @license
* Copyright 2020 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'PropertyRefinement',
  refines: 'foam.lang.Property',

  properties: [
    {
      // Set this field to override the default logic for choosing a view.
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.StringFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'StringRefinement',
  refines: 'foam.lang.String',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.StringFilterView' }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'StringArrayRefinement',
  refines: 'foam.lang.StringArray',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.StringArrayFilterView' }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'BooleanRefinement',
  refines: 'foam.lang.Boolean',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.BooleanFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'ReferenceRefinement',
  refines: 'foam.lang.Reference',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.ReferenceFilterView' }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'EnumRefinement',
  refines: 'foam.lang.Enum',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.EnumFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'UnitValueRefinement',
  refines: 'foam.lang.UnitValue',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.search.CurrencySearchView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'DateRefinement',
  refines: 'foam.lang.Date',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.DateFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'DateTimeRefinement',
  refines: 'foam.lang.DateTime',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.DateTimeFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'IntRefinement',
  refines: 'foam.lang.Int',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.IntegerFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'ShortRefinement',
  refines: 'foam.lang.Short',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.IntegerFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'LongRefinement',
  refines: 'foam.lang.Long',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.IntegerFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'ByteRefinement',
  refines: 'foam.lang.Byte',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.IntegerFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'FloatRefinement',
  refines: 'foam.lang.Float',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.FloatFilterView' }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'DAOPropertyRefinement',
  refines: 'foam.dao.DAOProperty',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: null
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'ManyToManyRelationshipPropertyRefinement',
  refines: 'foam.dao.ManyToManyRelationshipProperty',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: null
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'ReferenceRefinement',
  refines: 'foam.lang.Reference',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      expression: function(of) {
        return of.ID.searchView;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.filter',
  name: 'CurrencyCodeRefinement',
  refines: 'foam.lang.CurrencyCode',

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'searchView',
      value: { class: 'foam.u2.filter.properties.CurrencyFilterView' }
    }
  ]
});
