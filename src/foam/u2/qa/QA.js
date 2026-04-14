/**
 * QA Compiler v2 — Decision Matrix
 *
 * Compiles foam.QA() definitions in the decision matrix format into a
 * foam.CLASS() with:
 *   - Typed input properties (from properties:)
 *   - String answer properties (from questions:, default '')
 *   - Output properties (inferred from outcomes)
 *   - QUESTIONS / OUTCOMES constants
 *   - Runtime methods for candidate filtering, information gain, and
 *     question selection
 *
 * A decision matrix has three sections:
 *   - properties:  Typed inputs (system data) and outputs (result fields)
 *   - questions:   User-facing prompts with choices (default Yes/No → TRUE/FALSE)
 *   - outcomes:    Rows with AQL predicate strings, compiled to mlang at runtime
 *
 * Question ordering is computed at runtime by the wizard via maximum
 * information gain over the remaining candidate set.
 *
 * Predicate compilation is deferred to runtime because the AQL parser requires
 * the generated class (for property resolution), which doesn't exist yet at
 * compile time. Each outcome's predicate string is parsed and split on
 * top-level AND lazily on first access.
 *
 * Example:
 *
 *   foam.QA({
 *     package: 'com.example',
 *     name: 'RestaurantPicker',
 *
 *     properties: [
 *       // Input
 *       { class: 'Boolean', name: 'allergicToSeafood' },
 *       { class: 'Float',   name: 'priceLimit' },
 *       // Output
 *       { class: 'String',  name: 'name' }
 *     ],
 *
 *     questions: [
 *       { name: 'cuisine',
 *         prompt: 'What type of cuisine?',
 *         choices: ['Asian', 'Italian', 'Mexican'] },
 *
 *       // Yes/No choices are the default; omit for boolean questions
 *       { name: 'spicy',
 *         prompt: 'Do you enjoy spicy food?' }
 *     ],
 *
 *     outcomes: [
 *       { name: 'Sushi Place',
 *         predicate: 'allergicToSeafood IS FALSE AND cuisine = Asian AND spicy = FALSE AND priceLimit >= 30' },
 *       { name: 'Thai Restaurant',
 *         predicate: 'cuisine = Asian AND spicy = TRUE AND priceLimit >= 20' },
 *       { name: 'Pizza Trattoria',
 *         predicate: 'cuisine = Italian AND priceLimit < 25' },
 *       { name: 'Taco Truck',
 *         predicate: 'cuisine = Mexican AND spicy = TRUE AND priceLimit < 15' }
 *     ]
 *   });
 *
 * Usage:
 *
 *   var picker = com.example.RestaurantPicker.create({
 *     allergicToSeafood: false,
 *     priceLimit: 25
 *   });
 *
 *   // Properties are resolved immediately, narrowing candidates.
 *   // Then loop: ask questions, set answers, converge.
 *   var q = picker.selectNextQuestion();   // -> { name: 'cuisine', ... }
 *   picker.cuisine = 'Asian';
 *
 *   q = picker.selectNextQuestion();       // -> { name: 'spicy', ... }
 *   picker.spicy = 'TRUE';
 *
 *   var results = picker.getCandidates();  // -> [{ name: 'Thai Restaurant', ... }]
 *   picker.applyOutcome(results[0]);       // sets picker.name = 'Thai Restaurant'
 */


// =============================================================================
// foam.QA() entry point
// =============================================================================

foam.LIB({
  name: 'foam',

  methods: [
    function QA2(model) {
      var compiler = foam.u2.qa.QACompiler.create();
      return compiler.compile(model);
    }
  ]
});


// =============================================================================
// QACompiler
// =============================================================================

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QACompiler',

  documentation: `
    Compiles a decision matrix QA definition into a foam.CLASS().

    The generated class holds all input properties, question answer properties,
    and output properties. Questions and outcomes are stored as constants.
    Runtime methods provide candidate filtering and entropy-based question
    selection for the wizard UI.

    Predicate strings are stored as-is and compiled to mlang lazily at runtime,
    since the AQL parser needs the generated class for property resolution.
  `,

  methods: [

    function compile(model) {
      var pkg        = model.package;
      var name       = model.name;
      var properties = model.properties || [];
      var questions  = model.questions  || [];
      var outcomes   = model.outcomes   || [];

      questions = questions.map(this.normalizeQuestion_.bind(this));

      var classDef = this.buildClass_(pkg, name, properties, questions, outcomes);
      return foam.CLASS(classDef);
    },


    // =========================================================================
    // Question normalization
    // =========================================================================

    /**
     * Default Yes/No choices map to string 'TRUE'/'FALSE' so that boolean
     * questions use the same unanswered-detection as all other questions:
     * value === '' means not yet answered.
     */
    function normalizeQuestion_(q) {
      var normalized = Object.assign({}, q);

      if ( ! q.choices ) {
        normalized.choices = [
          ['Yes',  'TRUE'],
          ['No',   'FALSE']
        ];
      } else {
        normalized.choices = q.choices.map(function(c) {
          return foam.Array.isInstance(c) ? c : [c, c];
        });
      }

      return normalized;
    },


    // =========================================================================
    // CLASS Builder
    // =========================================================================

    function buildClass_(pkg, name, properties, questions, outcomes) {
      var props = [];
      var existingNames = {};

      // 1. Declared properties (inputs + outputs)
      properties.forEach(function(p) {
        var copy = Object.assign({}, p);
        existingNames[p.name] = true;
        props.push(copy);
      });

      // 2. Question answer properties (all Strings, default '')
      questions.forEach(function(q) {
        if ( ! existingNames[q.name] ) {
          existingNames[q.name] = true;
          props.push({
            class: 'String',
            name:  q.name,
            label: q.prompt
          });
        }
      });

      // 3. Ensure output properties from outcomes exist
      outcomes.forEach(function(o) {
        Object.keys(o).forEach(function(key) {
          if ( key === 'predicate' || key === 'terms' ) return;
          if ( ! existingNames[key] ) {
            existingNames[key] = true;
            props.push({ class: 'String', name: key });
          }
        });
      });

      return {
        package: pkg,
        name:    name,

        requires: [
          'foam.parse.SimpleQueryParser',
          'foam.mlang.predicate.And'
        ],

        constants: {
          QUESTIONS: questions,
          OUTCOMES:  outcomes
        },

        properties: props,

        methods: [

          /**
           * Lazily compile an outcome's predicate string into mlang terms.
           * Called on first access; results are cached on the outcome object.
           * Splits top-level And into individual terms, each tagged with
           * the property it references via .arg1.
           */
          function ensureCompiled(outcome) {
            if ( outcome.terms ) return;

            var parser = this.SimpleQueryParser.create({ of: this.cls_ });
            var mlang  = parser.parseString(outcome.predicate || '');
            var args   = this.And.isInstance(mlang) ? mlang.args : [mlang];

            outcome.terms = args.map(function(term) {
              return {
                mlang:    term,
                property: term.arg1 && term.arg1.name ? term.arg1.name : ''
              };
            });
          },

          /**
           * Return all outcomes whose predicate terms are consistent with
           * current property and answer values. A term is consistent if:
           *   - The property it references has not been answered yet (value === '')
           *   - The term evaluates to true against the current value
           */
          function getCandidates() {
            var self = this;
            return this.OUTCOMES.filter(function(outcome) {
              self.ensureCompiled(outcome);
              return outcome.terms.every(function(term) {
                return self.isTermConsistent(term);
              });
            });
          },

          /**
           * Check if a single predicate term is consistent with current state.
           * Returns true if the property is unanswered or the term matches.
           */
          function isTermConsistent(term) {
            var val = this[term.property];

            // Unanswered question — term is still possible
            if ( val === '' || val === undefined || val === null ) return true;

            // Evaluate the mlang term against this object
            return term.mlang.f(this);
          },

          /**
           * Select the unanswered question with the highest information gain.
           * Returns the question axiom, or null if no questions remain.
           */
          function selectNextQuestion() {
            var candidates = this.getCandidates();
            if ( candidates.length <= 1 ) return null;

            var self      = this;
            var questions = this.QUESTIONS;
            var bestQ     = null;
            var bestGain  = -1;

            for ( var i = 0 ; i < questions.length ; i++ ) {
              var q = questions[i];

              // Skip answered questions
              if ( self[q.name] !== '' ) continue;

              var gain = self.computeInfoGain(q, candidates);

              // Prefer higher gain, then fewer choices, then earlier declaration
              if ( gain > bestGain ||
                   ( gain === bestGain && bestQ &&
                     q.choices.length < bestQ.choices.length ) ) {
                bestGain = gain;
                bestQ    = q;
              }
            }

            // Don't ask questions with zero information gain
            return bestGain > 0 ? this.cls_.getAxiomByName(bestQ.name) : null;
          },

          /**
           * Compute the information gain of asking a question against the
           * current candidate set. Uses partition sizes to estimate entropy
           * reduction.
           *
           * For each possible answer choice, count how many candidates would
           * survive. The best question is the one that most evenly splits
           * the candidates (maximum entropy of the partition).
           */
          function computeInfoGain(question, candidates) {
            var self          = this;
            var buckets       = {};
            var dontCareCount = 0;

            // Initialize buckets for each choice
            question.choices.forEach(function(c) {
              var value = foam.Array.isInstance(c) ? c[1] : c;
              buckets[value] = 0;
            });

            // Count candidates per bucket
            candidates.forEach(function(outcome) {
              self.ensureCompiled(outcome);

              // Find if this outcome has a term referencing this question
              var term = null;
              for ( var i = 0 ; i < outcome.terms.length ; i++ ) {
                if ( outcome.terms[i].property === question.name ) {
                  term = outcome.terms[i];
                  break;
                }
              }

              if ( ! term ) {
                // Don't-care: outcome survives regardless of answer
                dontCareCount++;
              } else {
                // Try each choice and see if the term would match
                var self_ = this;
                question.choices.forEach(function(c) {
                  var value = foam.Array.isInstance(c) ? c[1] : c;
                  // Temporarily set the value to test the term
                  var prev = self_[question.name];
                  self_[question.name] = value;
                  if ( term.mlang.f(self_) ) {
                    buckets[value]++;
                  }
                  self_[question.name] = prev;
                });
              }
            }.bind(this));

            // Add don't-care outcomes to every bucket
            var total = candidates.length;
            var entropy = 0;

            question.choices.forEach(function(c) {
              var value = foam.Array.isInstance(c) ? c[1] : c;
              var count = buckets[value] + dontCareCount;
              if ( count > 0 && count < total ) {
                var p = count / total;
                entropy -= p * Math.log2(p);
              }
            });

            return entropy;
          },

          /**
           * Apply a resolved outcome to this object. Copies all non-internal
           * fields from the outcome to this object's properties.
           */
          function applyOutcome(outcome) {
            var skip = { predicate: true, terms: true };
            var keys = Object.keys(outcome);
            for ( var i = 0 ; i < keys.length ; i++ ) {
              if ( ! skip[keys[i]] ) {
                try { this[keys[i]] = outcome[keys[i]]; } catch(e) {}
              }
            }
          },

          /**
           * Rank outcomes by match quality against current state.
           * Returns outcomes sorted by: number of matching terms descending,
           * then specificity (total terms) descending.
           */
          function rankOutcomes(outcomes) {
            var self = this;

            var scored = outcomes.map(function(outcome) {
              self.ensureCompiled(outcome);
              var matching = 0;
              var resolved = 0;

              outcome.terms.forEach(function(term) {
                var val = self[term.property];
                if ( val !== '' && val !== undefined && val !== null ) {
                  resolved++;
                  if ( term.mlang.f(self) ) matching++;
                }
              });

              return {
                outcome:     outcome,
                matching:    matching,
                resolved:    resolved,
                specificity: outcome.terms.length
              };
            });

            scored.sort(function(a, b) {
              if ( b.matching !== a.matching ) return b.matching - a.matching;
              return b.specificity - a.specificity;
            });

            return scored.map(function(s) { return s.outcome; });
          }
        ]
      };
    }
  ]
});
