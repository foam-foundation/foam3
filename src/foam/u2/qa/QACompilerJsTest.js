/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Throwaway questionnaire used only by QACompilerJsTest.
 *
 * Covers the four storage shapes the compiler has to tell apart when deciding
 * whether a question has been answered:
 *   - a value-backed Boolean       (flag)
 *   - a value-backed Int question  (count)
 *   - a String choice whose value is '0' (pick)
 *   - a factory-backed array       (regions)
 * plus an expression-backed property that reports "cannot derive yet" with ''.
 *
 * colour exists so that scoring has something to probe: computeInfoGain only
 * sets/restores a question when some surviving outcome references it.
 */
foam.QA2({
  package: 'foam.u2.qa',
  name: 'AnsweredProbeQA',

  properties: [
    { class: 'Boolean', name: 'flag' },
    { class: 'String',  name: 'note',
      expression: function(flag) { return flag ? 'SET' : ''; } }
  ],

  questions: [
    { name: 'colour', prompt: 'Colour?',
      choices: [ [ 'RED', 'Red' ], [ 'BLUE', 'Blue' ] ] },
    { name: 'pick',   prompt: 'Pick?',
      choices: [ [ '0', 'Zero' ], [ '1', 'One' ] ] },
    { name: 'count',   class: 'Int',         prompt: 'How many?' },
    { name: 'regions', class: 'StringArray', prompt: 'Regions?' }
  ],

  outcomes: [
    { name: 'FLAG_TRUE',  predicate: 'flag IS TRUE' },
    { name: 'FLAG_FALSE', predicate: 'flag IS FALSE' },
    { name: 'RED',        predicate: 'colour = RED' },
    { name: 'BLUE',       predicate: 'colour = BLUE' }
  ],

  // Required: the compiler spreads model.methods without a fallback, unlike
  // properties/questions/outcomes which each default to []. Omitting this
  // fails the whole build with "model.methods is not iterable".
  methods: []
});


foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QACompilerJsTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    Covers how foam.QA2() decides a question has been answered.

    The rule is "a value was stored", not "the value looks truthy". Judging by
    truthiness makes a Boolean answered false, an Int answered 0 and a choice
    whose value is '0' indistinguishable from never-answered, so they never rule
    an outcome out and their questions get re-asked forever.
  `,

  requires: [ 'foam.u2.qa.AnsweredProbeQA' ],

  methods: [
    {
      name: 'runTest',
      code: function(x) {
        var self = this;

        function qa(props) { return self.AnsweredProbeQA.create(props || {}, x); }

        // Surviving outcome names, sorted, as a comparable string.
        function candidates(q) {
          return q.getCandidates().map(function(o) { return o.name; }).sort().join(',');
        }

        function question(q, name) {
          return q.QUESTIONS.filter(function(e) { return e.name === name; })[0];
        }

        // ---- Boolean: the value that collides with a truthiness test --------

        x.test(candidates(qa()) === 'BLUE,FLAG_FALSE,FLAG_TRUE,RED',
          'nothing answered: every outcome is still possible');

        var falseFlag = qa();
        falseFlag.flag = false;
        x.test(candidates(falseFlag).indexOf('FLAG_TRUE') === -1,
          'flag stored as false rules out the IS TRUE outcome ' +
          '(got: ' + candidates(falseFlag) + ')');
        x.test(candidates(falseFlag).indexOf('FLAG_FALSE') !== -1,
          'flag stored as false keeps the IS FALSE outcome');

        var trueFlag = qa();
        trueFlag.flag = true;
        x.test(candidates(trueFlag).indexOf('FLAG_FALSE') === -1,
          'flag stored as true rules out the IS FALSE outcome');

        // An untouched Boolean reads false too, but nobody stored it, so it
        // must still rule nothing out. This is the case truthiness got right
        // and the one an is-set test must not regress.
        x.test(candidates(qa()).indexOf('FLAG_TRUE') !== -1,
          'an untouched Boolean rules nothing out');

        // ---- Int 0 and the choice value '0' ---------------------------------

        var zeroInt = qa();
        x.test(zeroInt.isQuestionAnswered(question(zeroInt, 'count')) === false,
          'an untouched Int question is unanswered');
        zeroInt.count = 0;
        x.test(zeroInt.isQuestionAnswered(question(zeroInt, 'count')) === true,
          'an Int question answered 0 is answered');

        var zeroPick = qa();
        zeroPick.pick = '0';
        x.test(zeroPick.isQuestionAnswered(question(zeroPick, 'pick')) === true,
          'a choice whose value is the string "0" is answered');

        // ---- Arrays: factory-backed, so reading one stores it ---------------

        var arr = qa();
        x.test(arr.isQuestionAnswered(question(arr, 'regions')) === false,
          'an empty multi-select is unanswered even after being read');
        arr.regions = [ 'D' ];
        x.test(arr.isQuestionAnswered(question(arr, 'regions')) === true,
          'a multi-select with a selection is answered');

        // ---- Scoring must leave no trace ------------------------------------
        // computeInfoGain sets a question to each of its choices and restores.
        // Restoring by assigning the old value back STORES the default, which
        // would make every probed question look answered-with-nothing and
        // eliminate the outcomes that reference it.

        var scored = qa();
        var before = candidates(scored);
        scored.selectNextQuestion();
        x.test(scored.isQuestionAnswered(question(scored, 'colour')) === false,
          'scoring leaves the probed question unanswered');
        x.test(candidates(scored) === before,
          'scoring eliminates no outcomes (before: ' + before +
          ' after: ' + candidates(scored) + ')');

        // ---- Ranking judges answered-ness the same way ----------------------
        // rankOutcomes counts an outcome's answered-and-matching terms. An
        // unanswered Boolean reads its default false; if that default counted
        // as an answer, FLAG_FALSE would outscore outcomes built from answers
        // the user actually gave — and the top-ranked outcome is auto-applied.

        function rankedFor(q, name) {
          return q.rankOutcomes(q.getCandidates()).filter(function(r) {
            return r.outcome.name === name;
          })[0];
        }

        x.test(rankedFor(qa(), 'FLAG_FALSE').matching === 0,
          'ranking: an untouched Boolean\'s default false is not a matching term');

        var rankedFalse = qa();
        rankedFalse.flag = false;
        x.test(rankedFor(rankedFalse, 'FLAG_FALSE').matching === 1,
          'ranking: flag stored as false is a matching term');

        // ---- Expression sentinel --------------------------------------------
        // Last, because isAnswered_ is the method this behaviour is built on:
        // where it is absent the assertions above have already reported.

        var derived = qa();
        x.test(derived.isAnswered_('note') === false,
          'an expression computing the "cannot derive yet" sentinel is unanswered');
        derived.flag = true;
        x.test(derived.isAnswered_('note') === true,
          'an expression computing a real value is answered');
      }
    }
  ]
});
