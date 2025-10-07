/**
* @license
* Copyright 2020 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'FilterController',

  documentation: `
    This file will be deprecating the SearchManager.
    The FilterController controls the final predicate the DAO will use. This
    predicate is constructed from the various PropertyFilterViews.
  `,

  implements: [
    'foam.mlang.Expressions'
  ],

  properties: [
    {
      class: 'Map',
      name: 'criterias',
      documentation: `Map containing all criterias
      Criterias are a set of predicates applied at a time to a dao
      The idea is to eventually let users save these to make custom "filter views"
      For now filter controller only uses one criteria.
      `,
      factory: function() {
        // Example structure
        // {
        //   0: {
        //     views: { name: ... },
        //     subs: { name: ... },
        //     predicates: { name: ... },
        //     memorable: { name: <Boolean>, ... }
        //   }
        // }
        return {};
      }
    },
    {
      name: 'finalPredicate',
      factory: function() {
        return this.TRUE;
      }
    },
    {
      name: 'mementoPredicate',
      factory: function() {
        return this.TRUE;
      }
    },
    {
      name: 'dao',
      documentation: 'The unfiltered DAO as a basis for the criterias'
    },
    {
      class: 'Int',
      name: 'activeFilterCount',
      expression: function(activeFilters) {
        return Object.values(activeFilters)?.filter(v => v).length ?? 0;
      }
    },
    {
      class: 'Map',
      name: 'activeFilters'
    }
  ],

  methods: [
    function init() {
      this.addCriteria();
    },

    function and(predicates) {
      return this.And.create({
        args: Object.values(predicates).filter((predicate) => { return predicate !== undefined; })
      }).partialEval();
    },

    function addCriteria(key) {
      var criterias = this.criterias;
      var keys = Object.keys(criterias);
      var newKey;
      if ( key ) {
        newKey = key;
      } else {
        newKey = keys.length > 0 ? Number.parseInt(keys[keys.length - 1]) + 1 : 0;
      }
      this.criterias$set(newKey, {
        views: {},
        subs: {},
        predicates: {},
        memorable: {}
      });
    },

    function add(view, name, criteriaKey, memorable) {
      var criterias = this.criterias;
      criterias[criteriaKey].views[name] = view;
      criterias[criteriaKey].memorable[name] = memorable ?? true;
      criterias[criteriaKey].subs[name] = view.predicate$.sub(() => {
        this.onViewPredicateUpdate(criteriaKey, name);
      });
      this.onViewPredicateUpdate(criteriaKey, name);
    },

    function onViewPredicateUpdate(criteriaKey, name) {
      var criteria = this.criterias[criteriaKey];
      var predicate = criteria.views[name].predicate;
      if ( predicate != this.TRUE && criteria.memorable[name] ) {
        this.activeFilters$set(name, true);
      } else {
        this.activeFilters$set(name, false);
      }
      criteria.predicates[name] = predicate;

      this.reciprocateInCriteria(criteriaKey);
    },

    function reciprocateInCriteria(criteriaKey) {
      // This function reciprocates the other filters
      var criteria = this.criterias[criteriaKey];
      var predicates = criteria.predicates;
      foam.Object.forEach(predicates, function(_, name) {
        var temp = {};
        foam.Object.forEach(predicates, function(predicate, n) {
          if ( name === n ) return;
          temp[n] = predicate;
        });
        // Temp now holds all the other views. Combine all their predicates to
        // get the reciprocal predicate for this view.
        if ( criteria.views[name] ) {
          criteria.views[name].dao = this.dao.where(this.and(temp));
        }
      }.bind(this));
      this.updateFilterPredicate();
    },

    function updateFilterPredicate() {
      var criterias = this.criterias;
      var orPredicate = this.Or.create({
        args: Object.values(criterias).map((criteria) => { return this.and(criteria.predicates); })
      }).partialEval();
      if ( orPredicate === this.FALSE ) orPredicate = this.TRUE;
      if ( foam.util.equals(orPredicate, this.finalPredicate) ) return;

      this.mementoPredicate = this.Or.create({
        args: Object.values(criterias)
                .map((criteria) => {
                  let temp = {}
                  Object.keys(criteria.predicates).forEach(key => {
                    if ( criteria.memorable[key] )
                      temp[key] = criteria.predicates[key];
                   })
                  return this.and(temp);
                })
      }).partialEval();

      this.finalPredicate = orPredicate;
    },

    function getExistingPredicate(criteriaKey, property) {
      // Check if there is an existing predicate to rebuild from
      var propertyName = typeof property === 'string' ? property : property.name;
      var criteria = this.criterias[criteriaKey];
      if ( ! criteria ) return null;

      // Existing view can come from criterias
      var existingPredicate;
      if ( criteria ) {
        existingPredicate = criteria.predicates[propertyName]
        if ( existingPredicate && existingPredicate !== this.TRUE ) return existingPredicate;
      }

      return null;
    },

    function setExistingPredicate(criteriaKey, property, predicate) {
      var propertyName = typeof property === 'string' ? property : property.name;
      var criteria = this.criterias[criteriaKey];

      if ( ! criteria ) {
        this.addCriteria(criteriaKey);
        criteria = this.criterias[criteriaKey];
      }
      if ( criteria ) {
        criteria.predicates[propertyName] = predicate;
      }

      this.updateFilterPredicate();
    },

    function clear(viewOrName, criteria, remove) {
      var view;
      var name;
      // Get the right map to remove from
      var criterias = this.criterias;

      if ( typeof viewOrName === 'string' ) {
        // If view name given, obtain it from map
        view = criterias[criteria].views[viewOrName];
        name = viewOrName;
      } else {
        // If view given, less work. Just assign name for crosscheck
        // Name may be from TextSearchView as well
        view = viewOrName;
        name = view.property ? view.property.name : view.name;
      }

      // Don't clear if view does not exist or crosscheck fails
      if ( ! view || ! criterias[criteria].views[name] ) return;

      // There could be a case where the view's data is for reconstruction
      // Therefore, there won't be a method called clear
      if ( criterias[criteria].views[name].clear ) criterias[criteria].views[name].clear();
      criterias[criteria].predicates[name] = this.TRUE;
      if ( remove ) {
        // There could be a case where the view's data is for reconstruction
        // Therefore, there won't be any subs
        if ( criterias[criteria].subs[name] ) criterias[criteria].subs[name].detach();
        delete criterias[criteria].views[name];
        delete criterias[criteria].subs[name];
        delete criterias[criteria].predicates[name];
      }
    },

    function clearCriteria(criteria, remove) {
      var criterias = this.criterias;
      Object.values(criterias[criteria].views).forEach((view) => {
        this.clear(view, criteria, remove);
      });
      if ( remove ) {
        this.criterias$remove(criteria);
      }

      this.updateFilterPredicate();
    },

    function clearAll(remove) {
      // Get the right map to clear
      var criterias = this.criterias;
      // Clear each criteria properly (Which includes detaching subs)
      Object.keys(criterias).forEach((key) => {
        this.clearCriteria(key, remove);
      });
      this.mementoPredicate = undefined;
      this.finalPredicate   = undefined;
      // Readd blank 1st criteria
      if ( remove ) this.addCriteria();
      this.activeFilterCount = 0;
    }
  ]
});
